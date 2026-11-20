import assert from "node:assert/strict";
import test from "node:test";
import {readFile} from "node:fs/promises";

const migration=await readFile(new URL("../supabase/migrations/20261120042138_controller_wifi_provisioning.sql",import.meta.url),"utf8");
const service=await readFile(new URL("../src/lib/controllers/service.ts",import.meta.url),"utf8");
const delivery=await readFile(new URL("../src/lib/controllers/provisioning.ts",import.meta.url),"utf8");
const bridge=await readFile(new URL("../infrastructure/bridge/src/bridge.ts",import.meta.url),"utf8");

test("provisioning queue is private, expiring, controller-specific, and single-active",()=>{
  assert.match(migration,/controller_provisioning_request enable row level security/);
  assert.match(migration,/revoke all on smart_estate\.controller_provisioning_request from public,anon,authenticated/);
  assert.match(migration,/foreign key\(controller_id,estate_id\)/);
  assert.match(migration,/where status in \('PENDING','CLAIMED','PUBLISHED'\)/);
  assert.match(migration,/expires_at timestamptz not null/);
});

test("administrator requests supersede older work and bridge awaits terminal controller acknowledgement",()=>{
  assert.match(service,/Superseded by a newer administrator request/);
  assert.match(delivery,/status='PUBLISHED'/);
  assert.match(delivery,/received==="ACCEPTED"\?"PUBLISHED"/);
  assert.match(bridge,/provisioning\/ack/);
  assert.match(bridge,/parsed\.body\.status!=="ACCEPTED"/);
});
