import { NextResponse, type NextRequest } from "next/server";
import { authenticateGateway } from "@/lib/cloud/security";
import { getSql } from "@/lib/cloud/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const gateway = authenticateGateway(request);
  if (!gateway) return NextResponse.json({ code: "UNAUTHORIZED", message: "Gateway authentication failed" }, { status: 401 });
  const sql = getSql();
  const controllers = await sql`select id controller_id,estate_id,registration_state,revoked_at from smart_estate.controller where gateway_id=${gateway.id}`;
  const devices = await sql`select controller_id,id device_id,coalesce(house_id,estate_id) scope_id from smart_estate.device where retired_at is null and gateway_id=${gateway.id}`;
  const modes = await sql`select s.scope_id,s.mode,s.version,s.updated_at,c.id controller_id from smart_estate.security_mode_sync s join smart_estate.controller c on c.gateway_id=${gateway.id} and c.revoked_at is null and c.registration_state='PAIRED' where (s.scope_type='ESTATE' and s.scope_id=c.estate_id) or (s.scope_type='HOUSE' and exists(select 1 from smart_estate.controller_house ch where ch.controller_id=c.id and ch.house_id=s.scope_id))`;
  const active = controllers.filter((controller) => !controller.revoked_at && controller.registration_state === "PAIRED");
  const issuedAt = new Date();
  return NextResponse.json({
    controllers: active.map((controller) => ({
      controllerId: controller.controller_id,
      scopes: [controller.estate_id, ...devices.filter((device) => device.controller_id === controller.controller_id).map((device) => device.scope_id)].filter((value, index, values) => values.indexOf(value) === index),
      devices: devices.filter((device) => device.controller_id === controller.controller_id).map((device) => ({ deviceId: device.device_id, scopeId: device.scope_id })),
    })),
    securityModes: modes.map((mode) => ({ controllerId: mode.controller_id, scopeId: mode.scope_id, mode: mode.mode, version: Number(mode.version), issuedAt: issuedAt.toISOString(), expiresAt: new Date(issuedAt.getTime() + 60_000).toISOString() })),
    revokedControllerIds: controllers.filter((controller) => Boolean(controller.revoked_at) || controller.registration_state === "REVOKED").map((controller) => controller.controller_id),
  }, { headers: { "Cache-Control": "no-store" } });
}
