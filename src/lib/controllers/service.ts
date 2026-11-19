import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { getSql } from "@/lib/cloud/db";
import { heartbeatAvailability } from "./availability";

export class ControllerAuthorizationError extends Error {}
export class ControllerConflictError extends Error {}

const tokenHash = (value: string) => createHash("sha256").update(value).digest("hex");
const safeEqual = (left: string, right: string) => {
  const a = Buffer.from(left), b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
};

async function requireEstateAdmin(userId: string, estateId: string) {
  const sql = getSql();
  const rows = await sql`select smart_estate.is_estate_admin(${userId}::uuid,${estateId}) allowed`;
  if (!rows[0]?.allowed) throw new ControllerAuthorizationError("Estate administrator permission is required");
}

export async function listControllers(userId: string, estateId: string) {
  await requireEstateAdmin(userId, estateId);
  const sql = getSql();
  const rows=await sql`select c.id,c.estate_id "estateId",c.gateway_id "gatewayId",c.name,c.hardware_identity "hardwareIdentity",c.registration_state "registrationState",c.pairing_state "pairingState",c.firmware_version "firmwareVersion",c.credential_version "credentialVersion",c.revoked_at "revokedAt",c.wifi_ssid "wifiSsid",c.wifi_rssi "wifiRssi",c.network_state "networkState",c.mqtt_state "mqttState",c.last_heartbeat_at "lastHeartbeatAt",c.last_seen_at "lastSeenAt",c.created_at "createdAt",c.updated_at "updatedAt" from smart_estate.controller c where c.estate_id=${estateId} order by c.name`;
  return rows.map(row=>({...row,availability:row.revokedAt?"OFFLINE":heartbeatAvailability(row.lastSeenAt?String(row.lastSeenAt):null)}));
}

export async function controllerDetails(userId: string, controllerId: string) {
  const sql = getSql();
  const rows = await sql`select c.*,smart_estate.is_estate_admin(${userId}::uuid,c.estate_id) allowed from smart_estate.controller c where c.id=${controllerId}`;
  if (!rows[0]?.allowed) throw new ControllerAuthorizationError("Controller was not found in an administered estate");
  const houses = await sql`select h.id,h.name from smart_estate.controller_house ch join smart_estate.house h on h.id=ch.house_id where ch.controller_id=${controllerId} order by h.name`;
  const devices = await sql`select id,house_id "houseId",estate_id "estateId",name,type,capabilities,execution_mode "executionMode" from smart_estate.device where controller_id=${controllerId} order by name`;
  const controller={...rows[0]};
  delete controller.allowed;delete controller.credential_reference;delete controller.proof_of_possession_hash;
  return { controller, houses, devices };
}

export async function createPendingController(userId: string, input: { id: string; estateId: string; gatewayId: string; name: string; hardwareIdentity: string; proofOfPossessionHash: string }) {
  await requireEstateAdmin(userId, input.estateId);
  if (![input.id,input.gatewayId,input.name,input.hardwareIdentity].every(value => typeof value === "string" && value.trim().length >= 3)) throw new ControllerConflictError("Controller identity fields are required");
  const sql = getSql();
  if(!/^[a-f0-9]{64}$/i.test(input.proofOfPossessionHash)) throw new ControllerConflictError("A SHA-256 proof-of-possession hash is required");
  const rows = await sql`insert into smart_estate.controller(id,estate_id,gateway_id,name,hardware_identity,proof_of_possession_hash) values(${input.id.trim()},${input.estateId},${input.gatewayId.trim()},${input.name.trim()},${input.hardwareIdentity.trim()},${input.proofOfPossessionHash.toLowerCase()}) on conflict do nothing returning id,estate_id "estateId",name,registration_state "registrationState",pairing_state "pairingState"`;
  if (!rows[0]) throw new ControllerConflictError("Controller ID or hardware identity already exists");
  await sql`insert into smart_estate.controller_event(id,controller_id,estate_id,actor_id,type,occurred_at,payload) values(${randomUUID()},${input.id},${input.estateId},${userId}::uuid,'REGISTRATION_CREATED',now(),'{}'::jsonb)`;
  return rows[0];
}

export async function initiatePairing(userId: string, controllerId: string) {
  const sql = getSql();
  const controller = await sql`select id,estate_id,revoked_at from smart_estate.controller where id=${controllerId}`;
  if (!controller[0] || controller[0].revoked_at) throw new ControllerConflictError("Controller is unavailable for pairing");
  await requireEstateAdmin(userId, controller[0].estate_id);
  const recent = await sql`select count(*)::int count from smart_estate.controller_pairing where controller_id=${controllerId} and created_at>now()-interval '15 minutes'`;
  if ((recent[0]?.count ?? 0) >= 3) throw new ControllerConflictError("Pairing challenge rate limit reached");
  const challenge = randomBytes(32).toString("base64url"), id = randomUUID();
  await sql.begin(async tx => {
    await tx`update smart_estate.controller_pairing set consumed_at=coalesce(consumed_at,now()) where controller_id=${controllerId} and consumed_at is null`;
    await tx`insert into smart_estate.controller_pairing(id,controller_id,estate_id,initiated_by,challenge_hash,expires_at) values(${id}::uuid,${controllerId},${controller[0].estate_id},${userId}::uuid,${tokenHash(challenge)},now()+interval '10 minutes')`;
    await tx`update smart_estate.controller set pairing_state='CHALLENGE_ISSUED',updated_at=now() where id=${controllerId}`;
  });
  return { pairingId: id, challenge, expiresInSeconds: 600 };
}

export async function consumePairingChallenge(input: { pairingId: string; challenge: string; proof: string }) {
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.pairingId)) throw new ControllerAuthorizationError("Pairing challenge is invalid");
  const sql = getSql();
  const outcome=await sql.begin(async tx => {
    const rows = await tx`select * from smart_estate.controller_pairing where id=${input.pairingId}::uuid for update`;
    const pairing = rows[0];
    if (!pairing || pairing.consumed_at || new Date(pairing.expires_at).getTime() <= Date.now() || pairing.attempts >= pairing.max_attempts) return null;
    await tx`update smart_estate.controller_pairing set attempts=attempts+1 where id=${input.pairingId}::uuid`;
    const controller=await tx`select proof_of_possession_hash from smart_estate.controller where id=${pairing.controller_id} and revoked_at is null`;
    if (!safeEqual(pairing.challenge_hash, tokenHash(input.challenge)) || !controller[0] || !safeEqual(controller[0].proof_of_possession_hash,tokenHash(input.proof))) return null;
    await tx`update smart_estate.controller_pairing set proof_hash=${tokenHash(input.proof)},consumed_at=now() where id=${input.pairingId}::uuid`;
    await tx`update smart_estate.controller set pairing_state='PAIRED',registration_state='PENDING',updated_at=now() where id=${pairing.controller_id}`;
    return { controllerId: pairing.controller_id, pairingState: "PAIRED", credentialProvisioning: "PENDING" };
  });
  if(!outcome)throw new ControllerAuthorizationError("Pairing challenge or proof is invalid, expired, or exhausted");
  return outcome;
}

export async function associateHouse(userId: string, controllerId: string, houseId: string) {
  const sql = getSql();
  const rows = await sql`select c.estate_id,h.estate_id house_estate from smart_estate.controller c join smart_estate.house h on h.id=${houseId} where c.id=${controllerId}`;
  if (!rows[0] || rows[0].estate_id !== rows[0].house_estate) throw new ControllerConflictError("Controller and house must belong to the same estate");
  await requireEstateAdmin(userId, rows[0].estate_id);
  await sql`insert into smart_estate.controller_house(controller_id,controller_estate_id,house_id) values(${controllerId},${rows[0].estate_id},${houseId}) on conflict do nothing`;
  return { controllerId, houseId };
}

export async function revokeController(userId: string, controllerId: string) {
  const sql = getSql();
  const rows = await sql`select estate_id from smart_estate.controller where id=${controllerId}`;
  if (!rows[0]) throw new ControllerAuthorizationError("Controller not found");
  await requireEstateAdmin(userId, rows[0].estate_id);
  await sql.begin(async tx => {
    await tx`update smart_estate.controller set registration_state='REVOKED',pairing_state='REVOKED',revoked_at=now(),network_state='OFFLINE',mqtt_state='OFFLINE',updated_at=now() where id=${controllerId}`;
    await tx`update smart_estate.device_state s set connectivity='OFFLINE',version=version+1 where exists(select 1 from smart_estate.device d where d.id=s.device_id and d.controller_id=${controllerId})`;
    await tx`insert into smart_estate.controller_event(id,controller_id,estate_id,actor_id,type,severity,occurred_at,payload) values(${randomUUID()},${controllerId},${rows[0].estate_id},${userId}::uuid,'REVOKED','WARNING',now(),'{}'::jsonb)`;
  });
  return { controllerId, revoked: true, brokerRevocation: "PENDING" };
}
