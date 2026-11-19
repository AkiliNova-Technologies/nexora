import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const migration = await readFile(new URL("../supabase/migrations/20261119150000_controller_management.sql", import.meta.url), "utf8");
const repository = await readFile(new URL("../src/lib/cloud/repository.ts", import.meta.url), "utf8");
const bridge = await readFile(new URL("../infrastructure/bridge/src/bridge.ts", import.meta.url), "utf8");

test("command delivery uses bounded identity-paired leases", () => {
  assert.match(migration, /delivery_lease_id uuid/);
  assert.match(migration, /delivery_lease_expires_at timestamptz/);
  assert.match(repository, /least\(c\.expires_at,now\(\)\+interval '15 seconds'\)/);
  assert.match(repository, /delivery_lease_id=\$\{leaseId\}::uuid/);
  assert.match(repository, /gateway_id=\$\{gatewayId\}/);
  assert.doesNotMatch(repository, /delivery_lease_id=null/);
});

test("bridge persists before confirmation and confirms before publication", () => {
  const persist = bridge.indexOf("this.store.recordClaim(command)");
  const confirm = bridge.indexOf("await this.cloud.confirmCommand(command.commandId, command.leaseId)");
  const publish = bridge.indexOf("await publishQos1(this.mqtt, commandTopic(command)");
  assert.ok(persist >= 0 && persist < confirm && confirm < publish);
  assert.match(bridge, /this\.store\.pendingClaims\(\)/);
});
