import assert from "node:assert/strict";
import test from "node:test";
import {readFile} from "node:fs/promises";
import {heartbeatAvailability} from "../src/lib/controllers/availability.ts";

const migration=await readFile(new URL("../supabase/migrations/20261119150000_controller_management.sql",import.meta.url),"utf8");
const service=await readFile(new URL("../src/lib/controllers/service.ts",import.meta.url),"utf8");

test("controller schema is estate-scoped, RLS protected and secret-safe",()=>{
  for(const table of ["controller","controller_house","controller_pairing","controller_event","estate_security_event"]) assert.match(migration,new RegExp(`alter table smart_estate\\.${table} enable row level security`));
  assert.match(migration,/is_estate_admin/);
  assert.doesNotMatch(migration,/wifi_password|mqtt_password/);
  assert.match(migration,/proof_of_possession_hash/);
});

test("pairing is expiring, single-use, attempt-limited and does not issue credentials",()=>{
  assert.match(service,/interval '10 minutes'/);
  assert.match(service,/consumed_at/);
  assert.match(service,/max_attempts/);
  assert.match(service,/credentialProvisioning: "PENDING"/);
  assert.match(service,/timingSafeEqual/);
});

test("revocation marks controller devices offline and leaves broker work pending",()=>{
  assert.match(service,/registration_state='REVOKED'/);
  assert.match(service,/device_state[\s\S]*connectivity='OFFLINE'/);
  assert.match(service,/brokerRevocation: "PENDING"/);
});
test("heartbeat freshness distinguishes online, degraded, offline and unknown",()=>{
  const now=Date.parse("2026-11-19T12:00:00Z");
  assert.equal(heartbeatAvailability(null,now),"UNKNOWN");
  assert.equal(heartbeatAvailability("2026-11-19T11:59:40Z",now),"ONLINE");
  assert.equal(heartbeatAvailability("2026-11-19T11:59:24Z",now),"DEGRADED");
  assert.equal(heartbeatAvailability("2026-11-19T11:59:10Z",now),"OFFLINE");
});
