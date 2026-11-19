import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { BridgeStore } from "../src/store.js";

test("event queue preserves identity and survives reopen", () => {
  const directory = mkdtempSync(join(tmpdir(), "nexora-bridge-"));
  const path = join(directory, "queue.sqlite");
  const event = { eventId: "controller:boot:1", scopeId: "house-1", deviceId: "light-1", kind: "state" as const, receivedAt: new Date().toISOString(), body: { eventId: "controller:boot:1", reported: { on: true } } };
  const first = new BridgeStore(path, 100);
  first.enqueueEvent(event);
  first.enqueueEvent(event);
  assert.equal(first.pendingEvents().length, 1);
  first.close();
  const second = new BridgeStore(path, 100);
  assert.deepEqual(second.pendingEvents()[0], event);
  second.acceptEvents([event.eventId]);
  assert.equal(second.pendingEvents().length, 0);
  second.close();
  rmSync(directory, { recursive: true });
});

test("interrupted publication becomes uncertain and is not claimable", () => {
  const directory = mkdtempSync(join(tmpdir(), "nexora-bridge-"));
  const store = new BridgeStore(join(directory, "queue.sqlite"), 100);
  const command = { commandId: "11111111-1111-4111-8111-111111111111", controllerId: "controller-1", scopeId: "estate-1", deviceId: "gate-1", type: "OPEN", parameters: {}, issuedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 30_000).toISOString() };
  store.recordClaim(command);
  store.setDeliveryState(command.commandId, "PUBLISHING");
  store.recoverInterrupted();
  const recovered = store.deliveryState(command.commandId);
  assert.equal(recovered?.state, "UNCERTAIN");
  assert.equal(recovered?.dangerous, 1);
  assert.equal(recovered?.expires_at, Date.parse(command.expiresAt));
  store.close();
  rmSync(directory, { recursive: true });
});
