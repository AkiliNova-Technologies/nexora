import assert from "node:assert/strict";
import test from "node:test";

import { mockDevices, mockDeviceStates, mockRooms } from "../src/data/mock-smart-estate.ts";
import {
  consumeConfirmation,
  createConfirmation,
  describeStatus,
  normalizeCommand,
  parseCommand,
  permissionContextKey,
  resolveControlCommand,
  shouldProcessTranscript,
} from "../src/lib/nexora-ai/command-engine.ts";
import { buildEstateKnowledge, describeCapabilities } from "../src/lib/nexora-ai/estate-knowledge.ts";

test("normalizes punctuation, case, and whitespace", () => {
  assert.equal(normalizeCommand("  Turn ON,   the LIGHTS! "), "turn on the lights");
});

test("prevents duplicate finalized transcripts across time-bucket boundaries and prunes stale entries", () => {
  const recent = new Map();
  assert.equal(shouldProcessTranscript(recent, "Turn on kitchen lights", 2_999), true);
  assert.equal(shouldProcessTranscript(recent, " turn ON kitchen lights! ", 3_001), false);
  assert.equal(shouldProcessTranscript(recent, "Turn on kitchen lights", 8_001), true);
  assert.equal(recent.size, 1);
});

test("recognizes control, status, discovery, security, capability, and unknown intents", () => {
  assert.deepEqual(["Turn on the lights", "Is the gate open?", "Show connected devices", "What is the security status?", "help", "make tea"].map((value) => parseCommand(value).intent), ["CONTROL_DEVICE", "DEVICE_STATUS", "LIST_DEVICES", "SECURITY_STATUS", "CAPABILITIES", "UNKNOWN"]);
});

test("recognizes natural capability and example questions", () => {
  for (const prompt of ["What can you do?", "What commands do you support?", "How do I use Nexora?", "How can you help me?"]) assert.equal(parseCommand(prompt).intent, "CAPABILITIES");
  assert.equal(parseCommand("Give me examples of commands").helpTopic, "EXAMPLES");
});

test("recognizes fan aliases and rejects invented temperature control", () => {
  assert.equal(parseCommand("Turn on the AC").deviceType, "FAN");
  assert.equal(parseCommand("Switch off ventilation").deviceType, "FAN");
  assert.equal(parseCommand("Set the AC to 20 degrees").intent, "UNSUPPORTED_FEATURE");
});

test("recognizes house security changes and compound scope", () => {
  assert.deepEqual([parseCommand("Arm House One").intent, parseCommand("Disarm House Two").action], ["SECURITY_CONTROL", "DISARM"]);
  assert.equal(parseCommand("Arm the entire estate").group, "ESTATE");
});

test("extracts a room and resolves one authorized device", () => {
  const parsed = parseCommand("Switch off the lights in the kitchen");
  const result = resolveControlCommand(parsed, mockDevices, mockRooms);
  assert.equal(result.kind, "resolved");
  assert.equal(result.command.devices[0].id, "dev-kitchen-lights");
  assert.equal(result.command.command, "TURN_OFF");
});

test("matches a current house name without hardcoded identifiers", () => {
  const result = resolveControlCommand(parseCommand("Turn off Nexora Home kitchen lights"), mockDevices, mockRooms, [], ["Nexora Home"]);
  assert.equal(result.kind, "resolved");
  assert.equal(result.command.devices[0].id, "dev-kitchen-lights");
});

test("requests clarification instead of choosing an arbitrary light", () => {
  const result = resolveControlCommand(parseCommand("Turn on the lights"), mockDevices, mockRooms);
  assert.equal(result.kind, "ambiguous");
  assert.ok(result.candidates.length > 1);
});

test("resolves grouped lighting without implying one atomic device", () => {
  const result = resolveControlCommand(parseCommand("Turn off all interior lights"), mockDevices, mockRooms);
  assert.equal(result.kind, "resolved");
  assert.equal(result.command.grouped, true);
  assert.ok(result.command.devices.length >= 3);
  assert.ok(result.command.devices.every((device) => device.type === "LIGHT"));
});

test("all my lights stays inside the backend-authorized inventory", () => {
  const authorized = mockDevices.filter((device) => device.type === "LIGHT").slice(0, 2);
  const result = resolveControlCommand(parseCommand("Turn off all my lights"), authorized, mockRooms);
  assert.equal(result.kind, "resolved");
  assert.deepEqual(result.command.deviceIds.toSorted(), authorized.map((device) => device.id).toSorted());
});

test("visible read-only devices are not treated as controllable", () => {
  const readOnly = { ...mockDevices.find((device) => device.type === "LIGHT"), allowedOperations: ["VIEW", "READ_STATE"] };
  assert.equal(resolveControlCommand(parseCommand("Turn on the light"), [readOnly], mockRooms).kind, "unsupported");
});

test("permission changes produce a new conversation isolation key", () => {
  const device = { ...mockDevices[0], allowedOperations: ["VIEW", "READ_STATE", "COMMAND"] };
  const before = permissionContextKey([device]);
  const after = permissionContextKey([{ ...device, allowedOperations: ["VIEW", "READ_STATE"] }]);
  assert.notEqual(before, after);
});

test("resolves duplicate room lights by actual house names", () => {
  const houses = [{ id: "h1", name: "House One", timezone: "UTC" }, { id: "h2", name: "House Two", timezone: "UTC" }];
  const rooms = [{ id: "k1", houseId: "h1", name: "Kitchen" }, { id: "k2", houseId: "h2", name: "Kitchen" }];
  const devices = houses.map((house, index) => ({ id: `light-${index + 1}`, houseId: house.id, roomId: rooms[index].id, name: "Kitchen Light", type: "LIGHT", capabilities: [{ type: "POWER" }] }));
  const result = resolveControlCommand(parseCommand("Turn on the kitchen light in House Two"), devices, rooms, [], [], { h1: ["House One"], h2: ["House Two"] });
  assert.equal(result.kind, "resolved");
  assert.equal(result.command.devices[0].houseId, "h2");
});

test("perimeter aliases resolve only registered outdoor lighting", () => {
  const perimeter = { id: "perimeter-1", estateId: "estate-1", name: "Perimeter LED Strip", type: "LIGHT", capabilities: [{ type: "POWER" }] };
  const result = resolveControlCommand(parseCommand("Turn on the fence lights"), [perimeter], []);
  assert.equal(result.kind, "resolved");
  assert.equal(result.command.devices[0].id, perimeter.id);
});

test("resolves follow-up pronouns only from explicit conversation context", () => {
  const result = resolveControlCommand(parseCommand("Turn it off"), mockDevices, mockRooms, ["dev-office-fan"]);
  assert.equal(result.kind, "resolved");
  assert.equal(result.command.devices[0].id, "dev-office-fan");
});

test("rejects unsupported operations rather than simulating success", () => {
  const sensor = mockDevices.find((device) => device.type === "MOTION_SENSOR");
  const result = resolveControlCommand(parseCommand("Turn on the motion sensor"), [sensor], mockRooms);
  assert.equal(result.kind, "unsupported");
});

test("gate confirmation is bound to a command and expires", () => {
  const gate = { id: "gate-1", estateId: "estate-1", name: "Main Gate", type: "GATE", capabilities: [{ type: "GATE_CONTROL" }] };
  const resolution = resolveControlCommand(parseCommand("Open the main gate"), [gate], []);
  assert.equal(resolution.kind, "resolved");
  const pending = createConfirmation(resolution.command, 1_000);
  assert.equal(consumeConfirmation(pending, 1_001)?.command.deviceIds[0], "gate-1");
  assert.equal(consumeConfirmation(pending, pending.expiresAt), null);
});

test("gate stop remains unsupported when firmware capability is absent", () => {
  const gate = { id: "gate-1", estateId: "estate-1", name: "Main Gate", type: "GATE", capabilities: [{ type: "GATE_CONTROL" }] };
  assert.equal(resolveControlCommand(parseCommand("Stop the gate"), [gate], []).kind, "unsupported");
});

test("capability response reports visible availability without disclosing absent resources", () => {
  const states = Object.fromEntries(mockDeviceStates.map((state) => [state.deviceId, state]));
  const knowledge = buildEstateKnowledge({ houses: [{ id: "house-nexora-demo", name: "House One", timezone: "UTC" }], rooms: mockRooms, devices: mockDevices, states });
  const response = describeCapabilities(knowledge);
  assert.match(response, /operational light/);
  assert.match(response, /currently offline/);
  assert.doesNotMatch(response, /second house|perimeter|ultrasonic/i);
});

test("authoritative device state is used for feedback", () => {
  const light = mockDevices.find((device) => device.id === "dev-kitchen-lights");
  const state = mockDeviceStates.find((item) => item.deviceId === light.id);
  assert.equal(describeStatus(light, state), "Kitchen Lights is off.");
  assert.equal(describeStatus(light, { ...state, connectivity: "OFFLINE" }), "Kitchen Lights is offline.");
});
