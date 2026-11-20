import { createHmac } from "node:crypto";
import { getSql } from "@/lib/cloud/db";
import { commandDto, submitCommand } from "@/lib/cloud/repository";
import { tokenHash } from "./oauth";
import type { AlexaAuthorizedInventory, AlexaControlContext } from "./smart-home";
import type { Device, DeviceCommand, DeviceState, Room } from "@/domain/smart-estate";

type TokenSubject = { userId: string; grantId: string };

export async function validateAlexaAccessToken(raw: string): Promise<TokenSubject | null> {
  const sql = getSql();
  const rows = await sql`select t.user_id,t.grant_id from smart_estate.oauth_access_token t join smart_estate.oauth_grant g on g.id=t.grant_id where t.token_hash=${tokenHash(raw)} and t.expires_at>now() and t.revoked_at is null and g.revoked_at is null and ${"alexa:smart_home"}=any(t.scopes) limit 1`;
  return rows[0] ? { userId: rows[0].user_id, grantId: rows[0].grant_id } : null;
}

async function inventory(userId: string): Promise<AlexaAuthorizedInventory> {
  const sql = getSql();
  const deviceRows = await sql`select d.id,d.house_id,d.estate_id,d.room_id,d.name,d.type,d.capabilities,d.execution_mode,smart_estate.can_control_house(${userId}::uuid,d.house_id) can_command from smart_estate.device d where d.house_id is not null and smart_estate.can_view_house(${userId}::uuid,d.house_id) and d.type in ('LIGHT','FAN')`;
  const roomRows = await sql`select r.id,r.house_id "houseId",r.name from smart_estate.room r where smart_estate.can_view_house(${userId}::uuid,r.house_id)`;
  const stateRows = await sql`select s.device_id,s.connectivity,s.desired,s.reported,s.command_status,s.last_reported_at from smart_estate.device_state s join smart_estate.device d on d.id=s.device_id where ((d.house_id is not null and smart_estate.can_view_house(${userId}::uuid,d.house_id)) or (d.estate_id is not null and smart_estate.can_view_estate(${userId}::uuid,d.estate_id)))`;
  const authorizedDevices = deviceRows.map(row => ({ id: String(row.id), houseId: row.house_id ? String(row.house_id) : undefined, estateId: row.estate_id ? String(row.estate_id) : undefined, roomId: row.room_id ? String(row.room_id) : undefined, name: String(row.name), type: row.type, capabilities: row.capabilities, executionMode: row.execution_mode, allowedOperations: row.can_command ? ["VIEW", "READ_STATE", "COMMAND"] : ["VIEW", "READ_STATE"] })) as Device[];
  const authorizedRooms = roomRows.map(row => ({ id: String(row.id), houseId: String(row.houseId), name: String(row.name) })) as Room[];
  const states = Object.fromEntries(stateRows.map(row => [String(row.device_id), { deviceId: String(row.device_id), connectivity: row.connectivity, desired: row.desired, reported: row.reported, commandStatus: row.command_status, lastReportedAt: String(row.last_reported_at) }])) as Record<string, DeviceState>;
  return { devices: authorizedDevices, rooms: authorizedRooms, states };
}

const endpointSecret = () => {
  const value = process.env.ALEXA_ENDPOINT_ID_SECRET;
  if (!value || value.length < 32) throw new Error("ALEXA_ENDPOINT_ID_SECRET must contain at least 32 characters");
  return value;
};
const endpointId = (deviceId: string) => `nx-${createHmac("sha256", endpointSecret()).update(deviceId).digest("base64url")}`;

export function createNexoraAlexaControl(): AlexaControlContext {
  const subjects = new Map<string, TokenSubject>();
  const inventories = new Map<string, AlexaAuthorizedInventory>();
  async function subject(token: string) {
    const cached = subjects.get(token);
    if (cached) return cached;
    const value = await validateAlexaAccessToken(token);
    if (!value) throw new Error("invalid token");
    subjects.set(token, value);
    return value;
  }
  return {
    async discover(token) { const auth = await subject(token); const value = await inventory(auth.userId); inventories.set(token, value); return value; },
    async command(token, deviceId, command, requestId) {
      const auth = await subject(token);
      const submitted = await submitCommand(auth.userId, deviceId, { command, clientRequestId: `alexa:${requestId}` });
      if (!submitted) throw new Error("unknown endpoint");
      const sql = getSql();
      // Leave room inside Alexa's eight-second response window for Lambda,
      // TLS, token validation, inventory queries, and response serialization.
      const deadline = Date.now() + 5000;
      let current = submitted as DeviceCommand;
      while (Date.now() < deadline && !["EXECUTED", "FAILED", "TIMEOUT"].includes(String(current.status))) {
        await new Promise(resolve => setTimeout(resolve, 250));
        const rows = await sql`select * from smart_estate.device_command where id=${String(submitted.id)}::uuid and requested_by=${auth.userId}::uuid`;
        if (rows[0]) current = commandDto(rows[0]) as DeviceCommand;
      }
      return current;
    },
    async isReplay(messageId) {
      const sql = getSql();
      return sql.begin(async tx => {
        // The expiry index keeps this bounded. Deleting here prevents an old
        // message ID from remaining blocked forever if scheduled cleanup lags.
        await tx`delete from smart_estate.alexa_directive where expires_at<=now()`;
        const rows = await tx`insert into smart_estate.alexa_directive(message_id,expires_at) values(${messageId},now()+interval '10 minutes') on conflict(message_id) do nothing returning message_id`;
        return !rows[0];
      });
    },
    endpointIdFor: endpointId,
    deviceIdFromEndpoint(value) {
      for (const valueInventory of inventories.values()) for (const device of valueInventory.devices) if (endpointId(device.id) === value) return device.id;
      return null;
    },
  };
}
