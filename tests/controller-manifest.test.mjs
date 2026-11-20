import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const manifest=JSON.parse(await readFile(new URL("../config/controller-registration.manifest.production.json",import.meta.url),"utf8"));
test("production manifest contains the authoritative 13 unique devices",()=>{
  assert.equal(manifest.devices.length,13);
  assert.equal(new Set(manifest.devices.map(device=>device.id)).size,13);
  assert.deepEqual(manifest.devices.find(device=>device.id==="dev-estate-big-fan"),{id:"dev-estate-big-fan",logicalName:"estate.bigFan",scope:"estate",type:"FAN",capabilities:[{type:"POWER"}],gpio:21});
  assert.equal(manifest.controller.hardwareIdentity,"00:70:07:a2:2d:84");
});
