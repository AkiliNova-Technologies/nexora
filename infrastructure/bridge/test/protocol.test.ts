import test from "node:test";
import assert from "node:assert/strict";
import { parseInbound } from "../src/protocol.js";

const sync = {
  controllers: [{ controllerId: "controller-1", scopes: ["house-1"], devices: [{ deviceId: "light-1", scopeId: "house-1" }] }],
  securityModes: [],
  revokedControllerIds: [],
};

test("accepts a registered device event", () => {
  const parsed = parseInbound("smartestate/v1/house-1/light-1/state", Buffer.from(JSON.stringify({ eventId: "controller-1:boot:1", reported: { on: true } })), sync, 4096);
  assert.equal(parsed.type, "device");
  if (parsed.type === "device") assert.equal(parsed.event.deviceId, "light-1");
});

test("rejects cross-controller and malformed topics", () => {
  assert.throws(() => parseInbound("smartestate/v1/house-2/light-1/state", Buffer.from('{"eventId":"event-1"}'), sync, 4096), /unauthorized/);
  assert.throws(() => parseInbound("smartestate/v1/house-1/light-1/command", Buffer.from('{"eventId":"event-1"}'), sync, 4096), /invalid_topic/);
});

test("rejects oversized payloads", () => {
  assert.throws(() => parseInbound("smartestate/v1/house-1/light-1/state", Buffer.alloc(4097), sync, 4096), /payload_too_large/);
});
