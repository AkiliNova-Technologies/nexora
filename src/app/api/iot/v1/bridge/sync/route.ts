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
  const modes = await sql`select s.scope_type,s.scope_id,s.mode,s.version,s.updated_at,c.id controller_id from smart_estate.security_mode_sync s join smart_estate.controller c on c.gateway_id=${gateway.id} and c.revoked_at is null and c.registration_state='PAIRED' where (s.scope_type='ESTATE' and s.scope_id=c.estate_id) or (s.scope_type='HOUSE' and exists(select 1 from smart_estate.controller_house ch where ch.controller_id=c.id and ch.house_id=s.scope_id))`;
  // Per-sensor monitoring for house modes. Policy defaults match the table defaults:
  // enabled, not watched in ARMED_HOME, watched in ARMED_AWAY.
  const policies = await sql`select d.house_id,d.id device_id,coalesce(p.enabled,true) enabled,coalesce(p.monitor_armed_home,false) monitor_armed_home,coalesce(p.monitor_armed_away,true) monitor_armed_away,coalesce(p.version,0) version from smart_estate.device d left join smart_estate.security_sensor_policy p on p.house_id=d.house_id and p.device_id=d.id where d.retired_at is null and d.gateway_id=${gateway.id} and d.house_id is not null and d.type in ('MOTION_SENSOR','CONTACT_SENSOR','ULTRASONIC_SENSOR')`;
  const houseSensors = (scopeId: string, mode: string) => policies.filter((policy) => policy.house_id === scopeId).map((policy) => ({ deviceId: policy.device_id, monitored: Boolean(policy.enabled) && (mode === "ARMED_HOME" ? Boolean(policy.monitor_armed_home) : mode === "ARMED_AWAY" || mode === "ARMED" ? Boolean(policy.monitor_armed_away) : false) }));
  // Policy versions only grow, so adding them makes a policy change republish the mode.
  const policyVersion = (scopeId: string) => policies.filter((policy) => policy.house_id === scopeId).reduce((sum, policy) => sum + Number(policy.version), 0);
  const active = controllers.filter((controller) => !controller.revoked_at && controller.registration_state === "PAIRED");
  const issuedAt = new Date();
  return NextResponse.json({
    controllers: active.map((controller) => ({
      controllerId: controller.controller_id,
      scopes: [controller.estate_id, ...devices.filter((device) => device.controller_id === controller.controller_id).map((device) => device.scope_id)].filter((value, index, values) => values.indexOf(value) === index),
      devices: devices.filter((device) => device.controller_id === controller.controller_id).map((device) => ({ deviceId: device.device_id, scopeId: device.scope_id })),
    })),
    securityModes: modes.map((mode) => {
      const house = mode.scope_type === "HOUSE";
      return { controllerId: mode.controller_id, scopeId: mode.scope_id, mode: mode.mode, version: Number(mode.version) + (house ? policyVersion(mode.scope_id) : 0), issuedAt: issuedAt.toISOString(), expiresAt: new Date(issuedAt.getTime() + 60_000).toISOString(), ...(house ? { sensors: houseSensors(mode.scope_id, mode.mode) } : {}) };
    }),
    revokedControllerIds: controllers.filter((controller) => Boolean(controller.revoked_at) || controller.registration_state === "REVOKED").map((controller) => controller.controller_id),
  }, { headers: { "Cache-Control": "no-store" } });
}
