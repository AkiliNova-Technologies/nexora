import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseRouteClient, requireUser } from "@/lib/supabase/server";
import { adminOverview, assignHouseOwner,CommandSubmissionError, dashboard, deviceState, devices, estateDevices, houses, markStaleControllerDevicesOffline, profile, rooms, submitCommand } from "@/lib/cloud/repository";
import { getSql } from "@/lib/cloud/db";
import { validateMutationRequest } from "@/lib/cloud/security";
import { diagnosticRoute, elapsedMs, logServerTiming } from "@/lib/cloud/timing";
import { associateHouse, cancelProvisioning, requestWifiChange, requestWifiScan, ControllerAuthorizationError, ControllerConflictError, controllerDetails, createPendingController, initiatePairing, listControllers, provisioningStatus, requestProvisioning, revokeController } from "@/lib/controllers/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ path: string[] }> };
const jsonError = (status: number, code: string, message: string) => NextResponse.json({ code, message }, { status });
// 22P02 = invalid_text_representation, e.g. a non-UUID path segment cast to uuid.
// That is a client error, not a database outage.
const isInvalidIdentifier = (error: unknown) => Boolean(error && typeof error === "object" && "code" in error && (error as { code?: unknown }).code === "22P02");

async function authenticated() {
  const user = await requireUser();
  if (!user) return null;
  const metadata = user.claims.user_metadata as { display_name?: unknown } | undefined;
  return { id: user.id, email: user.email, name: typeof metadata?.display_name === "string" ? metadata.display_name : undefined };
}

export async function GET(request: NextRequest, context: Context) {
  const startedAt = performance.now();
  const path = (await context.params).path;
  const route = diagnosticRoute(path);
  const authStartedAt = performance.now();
  const user = await authenticated();
  const authMs = elapsedMs(authStartedAt);
  if (!user) {
    logServerTiming("cloud.api.request", { method: "GET", route, outcome: "unauthenticated", authMs, totalMs: elapsedMs(startedAt) });
    return jsonError(401, "UNAUTHENTICATED", "Authentication is required");
  }
  let outcome = "completed";
  try {
    const sql = getSql();
    const returnsConnectivity = (path.length === 3 && ((path[0] === "houses" && path[2] === "sync") || (path[0] === "devices" && path[2] === "state") || (path[0] === "estates" && path[2] === "gate"))) || (path.length === 2 && path[0] === "admin" && path[1] === "overview");
    if (returnsConnectivity) await markStaleControllerDevicesOffline(sql);
    if (path.length === 1 && path[0] === "me") return NextResponse.json(await profile(user));
    if (path.length === 1 && path[0] === "houses") return NextResponse.json(await houses(user.id));
    if (path.length === 1 && path[0] === "estates") {
      const rows = await sql`select e.id,e.name,e.timezone from smart_estate.estate e where smart_estate.can_view_estate(${user.id}::uuid,e.id) or exists(select 1 from smart_estate.estate_admin a where a.estate_id=e.id and a.user_id=${user.id}::uuid and a.active) order by e.name`;
      return NextResponse.json(rows);
    }
    if (path.length === 2 && path[0] === "admin" && path[1] === "overview") {
      const value = await adminOverview(user.id,request.nextUrl.searchParams.get("estateId"));
      return value ? NextResponse.json(value) : jsonError(403,"ESTATE_ADMIN_REQUIRED","An active estate administrator assignment is required");
    }
    if (path.length === 3 && path[0] === "estates" && path[2] === "devices") return NextResponse.json(await estateDevices(user.id,path[1]));
    if (path.length === 1 && path[0] === "controllers") {
      const estateId = request.nextUrl.searchParams.get("estateId");
      if (!estateId) return jsonError(400,"ESTATE_REQUIRED","An estate ID is required");
      return NextResponse.json(await listControllers(user.id,estateId));
    }
    if (path.length === 2 && path[0] === "controllers") return NextResponse.json(await controllerDetails(user.id,path[1]));
    if (path.length === 3 && path[0] === "controllers" && path[2] === "provisioning") return NextResponse.json(await provisioningStatus(user.id,path[1]));
    if (path.length === 3 && path[0] === "houses" && path[2] === "rooms") return NextResponse.json(await rooms(user.id, path[1]));
    if (path.length === 3 && path[0] === "houses" && path[2] === "devices") return NextResponse.json(await devices(user.id, path[1]));
    if (path.length === 3 && path[0] === "houses" && path[2] === "dashboard") { const value = await dashboard(user.id, path[1]); return value ? NextResponse.json(value) : jsonError(404, "HOUSE_NOT_FOUND", "House was not found"); }
    if (path.length === 3 && path[0] === "houses" && path[2] === "sync") {
      const stateRows = await sql`select s.device_id,s.connectivity,s.desired,s.reported,s.command_status,s.last_reported_at from smart_estate.device_state s join smart_estate.device d on d.id=s.device_id where d.house_id=${path[1]} and smart_estate.can_view_house(${user.id}::uuid,d.house_id)`;
      const commandRows = await sql`select distinct on(c.device_id) c.id,c.device_id,c.type,c.parameters,c.status,c.requested_at,c.completed_at,c.error,c.requested_by from smart_estate.device_command c join smart_estate.device d on d.id=c.device_id where d.house_id=${path[1]} and smart_estate.can_view_house(${user.id}::uuid,d.house_id) and c.requested_at>now()-interval '10 minutes' order by c.device_id,c.requested_at desc`;
      return NextResponse.json({ states: stateRows.map((row) => ({ deviceId: row.device_id, connectivity: row.connectivity, desired: row.desired, reported: row.reported, commandStatus: row.command_status, lastReportedAt: row.last_reported_at })), commands: commandRows.map((row) => ({ id: row.id, deviceId: row.device_id, type: row.type, parameters: row.parameters, status: row.status, requestedAt: row.requested_at, completedAt: row.completed_at, error: row.error, requestedBy: row.requested_by })) }, { headers: { "Cache-Control": "no-store" } });
    }
    if (path.length === 3 && path[0] === "devices" && path[2] === "state") { const value = await deviceState(user.id, path[1]); return value ? NextResponse.json(value) : jsonError(404, "DEVICE_NOT_FOUND", "Device was not found"); }
    if (path.length === 2 && path[0] === "device-commands") {
      const rows = await sql`select c.id,c.device_id,c.type,c.parameters,c.status,c.requested_at,c.completed_at,c.error,c.requested_by from smart_estate.device_command c join smart_estate.device d on d.id=c.device_id left join smart_estate.house h on h.id=d.house_id where c.id=${path[1]}::uuid and ((d.house_id is not null and smart_estate.can_view_house(${user.id}::uuid,d.house_id)) or (d.estate_id is not null and smart_estate.can_view_estate(${user.id}::uuid,d.estate_id)) or exists(select 1 from smart_estate.estate_admin a where a.estate_id=coalesce(d.estate_id,h.estate_id) and a.user_id=${user.id}::uuid and a.active))`;
      const row = rows[0]; return row ? NextResponse.json({ id: row.id, deviceId: row.device_id, type: row.type, parameters: row.parameters, status: row.status, requestedAt: row.requested_at, completedAt: row.completed_at, error: row.error, requestedBy: row.requested_by, physicalPositionVerification: row.type === "OPEN_GATE" || row.type === "CLOSE_GATE" ? "UNVERIFIED" : null }) : jsonError(404, "COMMAND_NOT_FOUND", "Device command was not found");
    }
    if (path.length === 3 && path[0] === "houses" && path[2] === "security-mode") {
      const rows = await sql`select s.house_id "houseId",s.mode,s.version,s.updated_at "updatedAt" from smart_estate.house_security_state s join smart_estate.house h on h.id=s.house_id where s.house_id=${path[1]} and (smart_estate.can_view_house(${user.id}::uuid,s.house_id) or exists(select 1 from smart_estate.estate_admin a where a.estate_id=h.estate_id and a.user_id=${user.id}::uuid and a.active))`;
      return rows[0] ? NextResponse.json(rows[0]) : jsonError(404, "HOUSE_NOT_FOUND", "House was not found");
    }
    if (path.length === 3 && path[0] === "houses" && path[2] === "security-sensor-policies") {
      const rows = await sql`select p.house_id "houseId",p.device_id "deviceId",p.enabled,p.monitor_armed_home "monitorArmedHome",p.monitor_armed_away "monitorArmedAway",p.version,p.updated_at "updatedAt",p.metadata from smart_estate.security_sensor_policy p join smart_estate.house h on h.id=p.house_id where p.house_id=${path[1]} and (smart_estate.can_view_house(${user.id}::uuid,p.house_id) or exists(select 1 from smart_estate.estate_admin a where a.estate_id=h.estate_id and a.user_id=${user.id}::uuid and a.active)) order by p.device_id`;
      return NextResponse.json(rows);
    }
    if (path.length === 3 && path[0] === "houses" && path[2] === "security-events") {
      const requestedLimit = Number(request.nextUrl.searchParams.get("limit") || 50), limit = Number.isInteger(requestedLimit) ? Math.min(100, Math.max(1, requestedLimit)) : 50;
      const rows = await sql`select e.id,e.house_id "houseId",e.device_id "deviceId",e.type,e.severity,e.occurred_at "occurredAt",e.received_at "receivedAt",e.metadata,e.acknowledged_at "acknowledgedAt" from smart_estate.security_event e join smart_estate.house h on h.id=e.house_id where e.house_id=${path[1]} and (smart_estate.can_view_house(${user.id}::uuid,e.house_id) or exists(select 1 from smart_estate.estate_admin a where a.estate_id=h.estate_id and a.user_id=${user.id}::uuid and a.active)) order by e.occurred_at desc limit ${limit}`;
      return NextResponse.json(rows);
    }
    if (path.length === 4 && path[0] === "houses" && path[2] === "security-events" && path[3] === "page") {
      const requestedPage = Number(request.nextUrl.searchParams.get("page") || 0), page = Number.isSafeInteger(requestedPage) ? Math.min(10_000, Math.max(0, requestedPage)) : 0, pageSize = [10,20,50].includes(Number(request.nextUrl.searchParams.get("pageSize"))) ? Number(request.nextUrl.searchParams.get("pageSize")) : 20;
      const rows = await sql`select e.id,e.house_id "houseId",e.device_id "deviceId",e.type,e.severity,e.occurred_at "occurredAt",e.received_at "receivedAt",e.metadata,e.acknowledged_at "acknowledgedAt",count(*) over()::int total from smart_estate.security_event e join smart_estate.house h on h.id=e.house_id where e.house_id=${path[1]} and (smart_estate.can_view_house(${user.id}::uuid,e.house_id) or exists(select 1 from smart_estate.estate_admin a where a.estate_id=h.estate_id and a.user_id=${user.id}::uuid and a.active)) order by e.occurred_at desc limit ${pageSize} offset ${page * pageSize}`;
      const total = rows[0]?.total ?? 0; return NextResponse.json({ items: rows.map((row) => { const item = { ...row }; delete item.total; return item; }), page, pageSize, total, totalPages: Math.ceil(total / pageSize) });
    }
    if (path.length === 3 && path[0] === "estates" && path[2] === "gate") {
      const rows = await sql`select d.id,d.estate_id,d.name,d.type,d.capabilities,d.execution_mode,s.connectivity,s.desired,s.reported,s.command_status,s.last_reported_at,(smart_estate.can_control_estate_device(${user.id}::uuid,d.estate_id,d.type) or exists(select 1 from smart_estate.estate_admin a where a.estate_id=d.estate_id and a.user_id=${user.id}::uuid and a.active) or exists(select 1 from smart_estate.house owner_house where owner_house.estate_id=d.estate_id and owner_house.owner_id=${user.id}::uuid)) can_control_gate from smart_estate.device d join smart_estate.device_state s on s.device_id=d.id where d.estate_id=${path[1]} and d.type='GATE' and d.retired_at is null and (smart_estate.can_view_estate(${user.id}::uuid,d.estate_id) or exists(select 1 from smart_estate.estate_admin a where a.estate_id=d.estate_id and a.user_id=${user.id}::uuid and a.active) or exists(select 1 from smart_estate.house owner_house where owner_house.estate_id=d.estate_id and owner_house.owner_id=${user.id}::uuid)) limit 1`;
      const row = rows[0]; if (!row) return jsonError(404, "GATE_NOT_FOUND", "Estate gate was not found");
      return NextResponse.json({ device: { id: row.id, estateId: row.estate_id, name: row.name, type: row.type, capabilities: row.capabilities, executionMode: row.execution_mode, allowedOperations: row.can_control_gate ? ["VIEW","READ_STATE","COMMAND"] : ["VIEW","READ_STATE"] }, state: { deviceId: row.id, connectivity: row.connectivity, desired: row.desired, reported: row.reported, commandStatus: row.command_status, lastReportedAt: row.last_reported_at }, physicalPositionVerification: "UNVERIFIED" });
    }
    return jsonError(404, "NOT_FOUND", "API route was not found");
  } catch (error) {
    if (error instanceof ControllerAuthorizationError) return jsonError(404,"CONTROLLER_NOT_FOUND",error.message);
    if (error instanceof ControllerConflictError) return jsonError(409,"CONTROLLER_CONFLICT",error.message);
    if (isInvalidIdentifier(error)) { outcome = "not_found"; return jsonError(404, "NOT_FOUND", "Resource was not found"); }
    outcome = "database_unavailable";
    console.error("Cloud API read failed", { route, errorCode: error && typeof error === "object" && "code" in error ? String(error.code) : "UNKNOWN", authMs, totalMs: elapsedMs(startedAt) });
    return jsonError(503, "DATABASE_UNAVAILABLE", "Cloud data is unavailable");
  } finally {
    logServerTiming("cloud.api.request", { method: "GET", route, outcome, authMs, operationMs: elapsedMs(startedAt) - authMs, totalMs: elapsedMs(startedAt) });
  }
}

async function mutation(request: NextRequest, context: Context) {
  const path = (await context.params).path;
  if (!validateMutationRequest(request)) return jsonError(403, "CSRF_INVALID", "Request validation failed");
  let body: Record<string, unknown> = {};
  try { if (request.body) body = await request.json(); } catch { return jsonError(400, "INVALID_JSON", "A valid JSON body is required"); }
  const routeClient = await createSupabaseRouteClient();
  const { supabase } = routeClient;
  try {
    if (path.join("/") === "auth/login") {
      const { data, error } = await supabase.auth.signInWithPassword({ email: String(body.email || ""), password: String(body.password || "") });
      if (error || !data.user) return jsonError(401, "INVALID_CREDENTIALS", "Email or password is incorrect");
      const email = data.user.email || "";
      const displayName = typeof data.user.user_metadata?.display_name === "string" && data.user.user_metadata.display_name.trim()
        ? data.user.user_metadata.display_name.trim()
        : email.split("@")[0];
      return routeClient.applyCookies(NextResponse.json({ id: data.user.id, name: displayName, email, role: "USER" }));
    }
    if (path.join("/") === "auth/register") {
      const emailRedirectTo = new URL("/auth/confirm?next=/dashboard", process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin).toString();
      const { data, error } = await supabase.auth.signUp({ email: String(body.email || ""), password: String(body.password || ""), options: { data: { display_name: String(body.name || "").trim() }, emailRedirectTo } });
      // Only surface password-policy feedback; other provider messages (e.g. "User
      // already registered") would let anyone enumerate accounts.
      if (error || !data.user) return jsonError(400, "REGISTRATION_FAILED", error?.code === "weak_password" ? error.message : "Registration failed. Check your details or try signing in.");
      return routeClient.applyCookies(NextResponse.json({ id: data.user.id, name: String(body.name || "").trim(), email: data.user.email || "", role: "USER", requiresEmailConfirmation: !data.session }, { status: 201 }));
    }
    if (path.join("/") === "auth/logout") { await supabase.auth.signOut(); return routeClient.applyCookies(new NextResponse(null, { status: 204 })); }
    const user = await authenticated(); if (!user) return jsonError(401, "UNAUTHENTICATED", "Authentication is required");
    const sql = getSql();
    if(request.method==="PUT"&&path.length===4&&path[0]==="admin"&&path[1]==="houses"&&path[3]==="owner"){
      const ownerId=String(body.ownerId??"").trim();
      const ownerEmail=String(body.ownerEmail??"").trim().toLowerCase();
      if(ownerEmail?!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ownerEmail):!/^[0-9a-f-]{36}$/i.test(ownerId))return jsonError(400,"INVALID_OWNER","A valid resident or account email is required");
      const result=await assignHouseOwner(user.id,path[2],ownerEmail?{ownerEmail}:{ownerId});
      return result?NextResponse.json(result):jsonError(404,"HOUSE_NOT_FOUND","House was not found in an administered estate");
    }
    if (path.length === 3 && path[0] === "devices" && path[2] === "commands") {
      const command = await submitCommand(user.id, path[1], body); return command ? NextResponse.json(command, { status: 202 }) : jsonError(404, "DEVICE_NOT_FOUND", "Device was not found");
    }
    if (request.method === "POST" && path.length === 1 && path[0] === "controllers") {
      return NextResponse.json(await createPendingController(user.id,{ id:String(body.id??""),estateId:String(body.estateId??""),gatewayId:String(body.gatewayId??""),name:String(body.name??""),hardwareIdentity:String(body.hardwareIdentity??""),proofOfPossessionHash:String(body.proofOfPossessionHash??"") }),{status:201});
    }
    if (request.method === "POST" && path.length === 3 && path[0] === "controllers" && path[2] === "pairing-challenges") return NextResponse.json(await initiatePairing(user.id,path[1]),{status:201});
    if (request.method === "POST" && path.length === 3 && path[0] === "controllers" && path[2] === "houses") return NextResponse.json(await associateHouse(user.id,path[1],String(body.houseId??"")));
    if (request.method === "POST" && path.length === 3 && path[0] === "controllers" && path[2] === "revoke") return NextResponse.json(await revokeController(user.id,path[1]));
    if (request.method === "POST" && path.length === 3 && path[0] === "controllers" && path[2] === "provisioning") return NextResponse.json(await requestProvisioning(user.id,path[1],Number(body.durationSeconds??300)),{status:202});
    if (request.method === "POST" && path.length === 4 && path[0] === "controllers" && path[2] === "provisioning" && path[3] === "cancel") return NextResponse.json(await cancelProvisioning(user.id,path[1]),{status:202});
    if (request.method === "POST" && path.length === 4 && path[0] === "controllers" && path[2] === "wifi" && path[3] === "scan") return NextResponse.json(await requestWifiScan(user.id,path[1]),{status:202});
    // The password is passed straight to encryption and is never logged or returned.
    if (request.method === "POST" && path.length === 3 && path[0] === "controllers" && path[2] === "wifi") return NextResponse.json(await requestWifiChange(user.id,path[1],typeof body.ssid==="string"?body.ssid:"",typeof body.password==="string"?body.password:""),{status:202});
    if (request.method === "PUT" && path.length === 3 && path[0] === "houses" && path[2] === "security-mode") {
      const mode = typeof body.mode === "string" && ["DISARMED","ARMED_HOME","ARMED_AWAY"].includes(body.mode) ? body.mode : null;
      const expectedVersion = Number(body.expectedVersion);
      if (!mode || !Number.isInteger(expectedVersion)) return jsonError(400, "INVALID_SECURITY_MODE", "A valid mode and version are required");
      // Controllers only receive modes from security_mode_sync (via the bridge),
      // so mirror the house mode there in the same statement/transaction.
      const rows = await sql`with changed as (update smart_estate.house_security_state s set mode=${mode},version=version+1,updated_at=now() from smart_estate.house h where h.id=s.house_id and s.house_id=${path[1]} and s.version=${expectedVersion} and (smart_estate.can_manage_house_security(${user.id}::uuid,s.house_id) or exists(select 1 from smart_estate.estate_admin a where a.estate_id=h.estate_id and a.user_id=${user.id}::uuid and a.active)) returning s.house_id,s.mode,s.version,s.updated_at),
        synced as (insert into smart_estate.security_mode_sync(scope_id,scope_type,mode,version,updated_at,updated_by) select house_id,'HOUSE',mode,version,updated_at,${user.id}::uuid from changed on conflict(scope_id) do update set mode=excluded.mode,version=excluded.version,updated_at=excluded.updated_at,updated_by=excluded.updated_by where smart_estate.security_mode_sync.scope_type='HOUSE' and smart_estate.security_mode_sync.version<excluded.version returning scope_id)
        select house_id "houseId",mode,version,updated_at "updatedAt" from changed`;
      return rows[0] ? NextResponse.json(rows[0]) : jsonError(409, "VERSION_CONFLICT", "Security mode changed; refresh and retry");
    }
    if (request.method === "PUT" && path.length === 4 && path[0] === "houses" && path[2] === "security-sensor-policies") {
      const expectedVersion = Number(body.expectedVersion);
      if (!Number.isInteger(expectedVersion) || typeof body.enabled !== "boolean" || typeof body.monitorArmedHome !== "boolean" || typeof body.monitorArmedAway !== "boolean") return jsonError(400, "INVALID_POLICY", "A valid policy and version are required");
      const rows = await sql`update smart_estate.security_sensor_policy p set enabled=${body.enabled},monitor_armed_home=${body.monitorArmedHome},monitor_armed_away=${body.monitorArmedAway},version=version+1,updated_at=now() from smart_estate.house h where h.id=p.house_id and p.house_id=${path[1]} and p.device_id=${path[3]} and p.version=${expectedVersion} and (smart_estate.can_manage_house_security(${user.id}::uuid,p.house_id) or exists(select 1 from smart_estate.estate_admin a where a.estate_id=h.estate_id and a.user_id=${user.id}::uuid and a.active)) returning p.house_id "houseId",p.device_id "deviceId",p.enabled,p.monitor_armed_home "monitorArmedHome",p.monitor_armed_away "monitorArmedAway",p.version,p.updated_at "updatedAt",p.metadata`;
      return rows[0] ? NextResponse.json(rows[0]) : jsonError(409, "VERSION_CONFLICT", "Sensor policy changed; refresh and retry");
    }
    return jsonError(404, "NOT_FOUND", "API route was not found");
  } catch (error) {
    if (error instanceof CommandSubmissionError) return jsonError(error.code === "DEVICE_OFFLINE" ? 409 : 400, error.code, error.message);
    if (error instanceof ControllerAuthorizationError) return jsonError(404,"CONTROLLER_NOT_FOUND",error.message);
    if (error instanceof ControllerConflictError) return jsonError(409,"CONTROLLER_CONFLICT",error.message);
    if (isInvalidIdentifier(error)) return jsonError(404, "NOT_FOUND", "Resource was not found");
    console.error("Cloud API mutation failed", { path: path.join("/"), message: error instanceof Error ? error.message : "unknown" }); return jsonError(503, "DATABASE_UNAVAILABLE", "Cloud operation is unavailable");
  }
}

export const POST = mutation;
export const PUT = mutation;
