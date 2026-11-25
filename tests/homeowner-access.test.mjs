import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const route = await readFile(new URL("../src/app/api/v1/[...path]/route.ts", import.meta.url), "utf8");
const repository = await readFile(new URL("../src/lib/cloud/repository.ts", import.meta.url), "utf8");

test("house owners can view and command the estate gate", () => {
  const gateQuery = route.slice(route.indexOf('path[2] === "gate"'), route.indexOf("GATE_NOT_FOUND"));
  assert.match(gateQuery, /owner_house\.owner_id=\$\{user\.id\}::uuid\)\) can_control_gate/);
  assert.match(gateQuery, /d\.type='GATE' and d\.retired_at is null and \(.*owner_house\.owner_id=\$\{user\.id\}/);
  assert.match(repository, /d\.type='GATE' and exists\(select 1 from smart_estate\.house owner_house/);
});

test("administrators can assign any signed-in resident by ID or email", () => {
  assert.match(route, /assignHouseOwner\(user\.id,path\[2\],ownerEmail\?\{ownerEmail\}:\{ownerId\}\)/);
  assert.match(repository, /lower\(email\)=\$\{target\.ownerEmail\.toLowerCase\(\)\}/);
  assert.doesNotMatch(repository, /is not eligible in this estate/);
});

test("an assigned homeowner becomes an estate resident with gate access", () => {
  assert.match(repository, /insert into smart_estate\.estate_member\(estate_id,user_id,active,can_view_shared_devices,can_control_gate\)/);
  assert.match(repository, /on conflict\(estate_id,user_id\) do update set active=true,can_view_shared_devices=true,can_control_gate=true/);
});

test("a profile is created on first sign-in so residents can be found", () => {
  assert.match(repository, /insert into smart_estate\.profile\(id,display_name,email\)/);
});

const sync = await readFile(new URL("../src/app/api/iot/v1/bridge/sync/route.ts", import.meta.url), "utf8");

test("house security modes carry per-sensor policy to the controller", () => {
  assert.match(sync, /sensors: houseSensors\(mode\.scope_id, mode\.mode\)/);
  assert.match(sync, /mode === "ARMED_HOME" \? Boolean\(policy\.monitor_armed_home\)/);
  assert.match(sync, /version: Number\(mode\.version\) \+ \(house \? policyVersion\(mode\.scope_id\) : 0\)/);
});

test("house sensors get a default policy so owners can configure them", () => {
  assert.match(route, /insert into smart_estate\.security_sensor_policy\(house_id,device_id\) select/);
});
