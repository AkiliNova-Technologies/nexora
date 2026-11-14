import { randomUUID } from "node:crypto";
import { getSql } from "./db";

type User = { id: string; email: string };
const commandTypes = new Set(["TURN_ON", "TURN_OFF", "SET_BRIGHTNESS", "SET_FAN_SPEED", "SET_TARGET_TEMPERATURE", "LOCK", "UNLOCK", "OPEN", "CLOSE", "STOP", "START_RECORDING", "STOP_RECORDING", "OPEN_GATE", "CLOSE_GATE", "GET_GATE_STATUS"]);
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function profile(user: User) {
  const sql = getSql();
  const rows = await sql`select id, display_name, email from smart_estate.profile where id = ${user.id}::uuid`;
  const row = rows[0];
  return row ? { id: row.id, name: row.display_name, email: row.email, role: "USER" } : { id: user.id, name: user.email.split("@")[0], email: user.email, role: "USER" };
}

export async function houses(userId: string) {
  const sql = getSql();
  return sql`select distinct h.id, h.name, h.timezone from smart_estate.house h left join smart_estate.house_access a on a.house_id=h.id and a.user_id=${userId}::uuid and a.active where h.owner_id=${userId}::uuid or a.can_view order by h.name`;
}

export async function rooms(userId: string, houseId: string) {
  const sql = getSql();
  return sql`select r.id, r.house_id as "houseId", r.name from smart_estate.room r where r.house_id=${houseId} and smart_estate.can_view_house(${userId}::uuid,r.house_id) order by r.name`;
}

export async function devices(userId: string, houseId: string) {
  const sql = getSql();
  const rows = await sql`select d.id,d.house_id,d.estate_id,d.room_id,d.name,d.type,d.capabilities,d.execution_mode,smart_estate.can_control_house(${userId}::uuid,d.house_id) can_command from smart_estate.device d where d.house_id=${houseId} and smart_estate.can_view_house(${userId}::uuid,d.house_id) order by d.name`;
  return rows.map((row) => ({ id: row.id, houseId: row.house_id, estateId: row.estate_id, roomId: row.room_id, name: row.name, type: row.type, capabilities: row.capabilities, executionMode: row.execution_mode, allowedOperations: row.can_command ? ["VIEW", "READ_STATE", "COMMAND"] : ["VIEW", "READ_STATE"] }));
}

export async function deviceState(userId: string, deviceId: string) {
  const sql = getSql();
  const rows = await sql`select s.device_id,s.connectivity,s.desired,s.reported,s.command_status,s.last_reported_at from smart_estate.device_state s join smart_estate.device d on d.id=s.device_id where s.device_id=${deviceId} and ((d.house_id is not null and smart_estate.can_view_house(${userId}::uuid,d.house_id)) or (d.estate_id is not null and smart_estate.can_view_estate(${userId}::uuid,d.estate_id)))`;
  const row = rows[0]; if (!row) return null;
  return { deviceId: row.device_id, connectivity: row.connectivity, desired: row.desired, reported: row.reported, commandStatus: row.command_status, lastReportedAt: row.last_reported_at };
}

export async function dashboard(userId: string, houseId: string) {
  const sql = getSql();
  const rows = await sql`select ${houseId}::text "houseId",count(d.id)::int "totalDevices",count(d.id) filter(where s.connectivity='ONLINE')::int "onlineDevices",0::int "activeAutomations",coalesce(m.mode,'DISARMED') "securityMode",0::numeric "energyTodayKwh" from smart_estate.house h left join smart_estate.device d on d.house_id=h.id left join smart_estate.device_state s on s.device_id=d.id left join smart_estate.house_security_state m on m.house_id=h.id where h.id=${houseId} and smart_estate.can_view_house(${userId}::uuid,h.id) group by m.mode`;
  return rows[0] ?? null;
}

export async function submitCommand(userId: string, deviceId: string, body: Record<string, unknown>) {
  const sql = getSql();
  const type = typeof body.command === "string" ? body.command : "";
  const requestId = typeof body.clientRequestId === "string" ? body.clientRequestId : "";
  if (!commandTypes.has(type) || !requestId || requestId.length > 120) throw new Error("INVALID_COMMAND");
  const parameters = body.parameters && typeof body.parameters === "object" ? body.parameters : null;
  const rows = await sql.begin(async (tx) => {
    const allowed = await tx`select d.id,d.gateway_id,d.type,d.house_id,d.estate_id from smart_estate.device d where d.id=${deviceId} and d.gateway_id is not null and ((d.house_id is not null and smart_estate.can_control_house(${userId}::uuid,d.house_id)) or (d.estate_id is not null and smart_estate.can_control_estate_device(${userId}::uuid,d.estate_id,d.type))) for update`;
    if (!allowed[0]) return [];
    const commandId = randomUUID();
    const inserted = await tx`insert into smart_estate.device_command(id,device_id,gateway_id,client_request_id,type,parameters,status,requested_by,requested_at,expires_at) values(${commandId}::uuid,${deviceId},${allowed[0].gateway_id},${requestId},${type},${tx.json(parameters)},'PENDING',${userId}::uuid,now(),now()+interval '30 seconds') on conflict(device_id,client_request_id) do update set client_request_id=excluded.client_request_id returning id,device_id,type,parameters,status,requested_at,completed_at,error,requested_by`;
    if (inserted[0]?.id === commandId) {
      await tx`update smart_estate.device_state set command_status='PENDING',desired=${tx.json(parameters)},version=version+1 where device_id=${deviceId}`;
      await tx`insert into smart_estate.audit_record(id,actor_id,house_id,estate_id,action,resource_type,resource_id,details) values(${randomUUID()}::uuid,${userId}::uuid,${allowed[0].house_id},${allowed[0].estate_id},'DEVICE_COMMAND_SUBMITTED','device_command',${commandId},${tx.json({ deviceId, type })})`;
    }
    return inserted;
  });
  const row = rows[0]; if (!row) return null;
  return commandDto(row);
}

export function commandDto(row: Record<string, unknown>) { return { id: row.id, deviceId: row.device_id, type: row.type, parameters: row.parameters, status: row.status, requestedAt: row.requested_at, completedAt: row.completed_at, error: row.error, requestedBy: row.requested_by, physicalPositionVerification: row.type === "OPEN_GATE" || row.type === "CLOSE_GATE" ? "UNVERIFIED" : null }; }

export async function claimCommands(gatewayId: string, limit: number) {
  const sql = getSql();
  return sql.begin(async (tx) => {
    await tx`update smart_estate.device_command set status='TIMEOUT',completed_at=now(),error='Command expired before gateway delivery' where gateway_id=${gatewayId} and status in ('PENDING','ACCEPTED') and expires_at<=now()`;
    const rows = await tx`with selected as (select id from smart_estate.device_command where gateway_id=${gatewayId} and status='PENDING' and expires_at>now() order by requested_at for update skip locked limit ${limit}) update smart_estate.device_command c set status='ACCEPTED',accepted_at=coalesce(c.accepted_at,now()) from selected where c.id=selected.id returning c.id command_id,c.device_id,c.type,c.parameters,c.requested_at,c.expires_at,(select coalesce(d.house_id,d.estate_id) from smart_estate.device d where d.id=c.device_id) scope_id`;
    if (rows.length) await tx`update smart_estate.device_state set command_status='ACCEPTED',version=version+1 where device_id in ${tx(rows.map((row) => row.device_id))}`;
    return rows.map((row) => ({ commandId: row.command_id, scopeId: row.scope_id, deviceId: row.device_id, type: row.type, parameters: row.parameters, issuedAt: row.requested_at, expiresAt: row.expires_at }));
  });
}

type BridgeEvent = { eventId: string; scopeId: string; deviceId: string; kind: string; receivedAt: string; body: Record<string, unknown> };
export async function ingestEvents(gatewayId: string, events: BridgeEvent[]) {
  const sql = getSql();
  const accepted: string[] = [];
  for (const event of events.slice(0, 50)) {
    if (!event?.eventId || !event.deviceId || !["ack", "state", "status", "event"].includes(event.kind) || !event.body || typeof event.body !== "object") continue;
    if (event.kind === "ack" && (typeof event.body.commandId !== "string" || !uuidPattern.test(event.body.commandId))) continue;
    const inserted = await sql.begin(async (tx) => {
      const dedupe = await tx`insert into smart_estate.gateway_event(event_id,gateway_id,device_id,kind,payload,received_at) select ${event.eventId},${gatewayId},d.id,${event.kind},${tx.json(event.body)},now() from smart_estate.device d where d.id=${event.deviceId} and d.gateway_id=${gatewayId} and coalesce(d.house_id,d.estate_id)=${event.scopeId} on conflict(event_id) do nothing returning event_id`;
      if (!dedupe[0]) return false;
      if (event.kind === "ack") {
        const commandId = typeof event.body.commandId === "string" ? event.body.commandId : "";
        const status = typeof event.body.status === "string" && ["EXECUTED", "FAILED"].includes(event.body.status) ? event.body.status : "FAILED";
        await tx`update smart_estate.device_command set status=${status},completed_at=now(),error=${typeof event.body.error === "string" ? event.body.error : null} where id=${commandId}::uuid and device_id=${event.deviceId} and gateway_id=${gatewayId} and status='ACCEPTED'`;
        if (status === "EXECUTED" && event.body.reported && typeof event.body.reported === "object") await tx`update smart_estate.device_state set reported=${tx.json(event.body.reported)},desired=null,command_status='EXECUTED',last_reported_at=now(),version=version+1 where device_id=${event.deviceId}`;
        else if (status === "FAILED") await tx`update smart_estate.device_state set desired=null,command_status='FAILED',version=version+1 where device_id=${event.deviceId}`;
      } else if (event.kind === "state" && event.body.reported && typeof event.body.reported === "object") {
        await tx`update smart_estate.device_state set reported=${tx.json(event.body.reported)},last_reported_at=now(),connectivity='ONLINE',version=version+1 where device_id=${event.deviceId}`;
      } else if (event.kind === "status") {
        await tx`update smart_estate.device_state set connectivity=${event.body.status === "ONLINE" ? "ONLINE" : "OFFLINE"},last_seen_at=now(),version=version+1 where device_id=${event.deviceId}`;
      } else if (event.kind === "event") {
        const device = await tx`select house_id from smart_estate.device where id=${event.deviceId} and gateway_id=${gatewayId}`;
        if (device[0]?.house_id && typeof event.body.type === "string") await tx`insert into smart_estate.security_event(id,house_id,device_id,type,severity,occurred_at,metadata) values(${uuidPattern.test(event.eventId) ? event.eventId : randomUUID()}::uuid,${device[0].house_id},${event.deviceId},${event.body.type},${event.body.severity === "CRITICAL" || event.body.severity === "WARNING" ? event.body.severity : "INFO"},${typeof event.body.occurredAt === "string" ? event.body.occurredAt : event.receivedAt}::timestamptz,${tx.json(event.body)}) on conflict(id) do nothing`;
      }
      return true;
    });
    if (inserted) accepted.push(event.eventId);
    else accepted.push(event.eventId); // duplicate delivery is acknowledged idempotently
  }
  return accepted;
}
