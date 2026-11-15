import test from "node:test";
import assert from "node:assert/strict";
import { cloudSyncDelay } from "../src/lib/cloud-sync.ts";

test("cloud synchronization backs off after failures and caps database pressure", () => {
  assert.equal(cloudSyncDelay(0, false), 4_000);
  assert.equal(cloudSyncDelay(1, false), 8_000);
  assert.equal(cloudSyncDelay(2, false), 16_000);
  assert.equal(cloudSyncDelay(3, false), 30_000);
  assert.equal(cloudSyncDelay(20, false), 30_000);
});

test("cloud synchronization pauses at the maximum interval while hidden", () => {
  assert.equal(cloudSyncDelay(0, true), 30_000);
});
