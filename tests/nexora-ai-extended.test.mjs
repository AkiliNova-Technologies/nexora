import assert from "node:assert/strict";
import test from "node:test";

import { normalizeCommand, parseCommand, resolveControlCommand } from "../src/lib/nexora-ai/command-engine.ts";
import { answerActivity, matchRoutine, splitSteps } from "../src/lib/nexora-ai/planner.ts";

const command = ["VIEW", "READ_STATE", "COMMAND"];
const strip = { id: "strip", estateId: "e1", name: "Perimeter strip", type: "RGB_LIGHT", capabilities: [{ type: "POWER" }, { type: "BRIGHTNESS", min: 0, max: 100 }, { type: "RGB_COLOR" }], allowedOperations: command };
const siren = { id: "siren", estateId: "e1", name: "Estate siren", type: "SIREN", capabilities: [{ type: "SIREN_CONTROL", maxDurationSeconds: 30 }], allowedOperations: command };
const bigFan = { id: "bigfan", estateId: "e1", name: "Clubhouse fan", type: "FAN", capabilities: [{ type: "POWER" }], allowedOperations: command };
const k1 = { id: "k1", houseId: "h1", name: "Kitchen light", type: "LIGHT", capabilities: [{ type: "POWER" }], allowedOperations: command };
const k2 = { id: "k2", houseId: "h2", name: "Kitchen light", type: "LIGHT", capabilities: [{ type: "POWER" }], allowedOperations: command };
const l1 = { id: "l1", houseId: "h1", name: "Living room light", type: "LIGHT", capabilities: [{ type: "POWER" }], allowedOperations: command };
const all = [strip, siren, bigFan, k1, k2, l1];
const scopes = { h1: ["House 1"], h2: ["House 2"] };

test("perimeter lights now include the RGB perimeter strip", () => {
  const result = resolveControlCommand(parseCommand("Turn on the perimeter lights"), all, []);
  assert.equal(result.kind, "resolved");
  assert.deepEqual(result.command.deviceIds, ["strip"]);
  assert.equal(result.command.command, "TURN_ON");
});

test("colour commands target the strip with RGB parameters", () => {
  const parsed = parseCommand("Make the perimeter strip red");
  assert.equal(parsed.action, "SET_COLOR");
  const result = resolveControlCommand(parsed, all, []);
  assert.equal(result.command.command, "SET_RGB");
  assert.deepEqual(result.command.parameters, { r: 255, g: 0, b: 0 });
  assert.equal(resolveControlCommand(parseCommand("change the strip to warm white"), all, []).command.parameters.g, 170);
});

test("colour on a plain light is refused clearly", () => {
  const result = resolveControlCommand(parseCommand("make the living room light blue"), all, []);
  assert.equal(result.kind, "unsupported");
  assert.match(result.message, /colour changes/);
});

test("an impossible request is refused instead of asking which device", () => {
  const plain = [k1, l1];
  const result = resolveControlCommand(parseCommand("make the light blue"), plain, []);
  assert.equal(result.kind, "unsupported");
  assert.match(result.message, /None of the matching devices support colour changes/);
});

test("brightness commands parse percentages and dim/brighten words", () => {
  assert.equal(resolveControlCommand(parseCommand("Dim the strip to 30%"), all, []).command.parameters.value, 30);
  assert.equal(resolveControlCommand(parseCommand("set the perimeter strip brightness to 80 percent"), all, []).command.parameters.value, 80);
  assert.equal(resolveControlCommand(parseCommand("dim the strip"), all, []).command.parameters.value, 25);
  assert.equal(resolveControlCommand(parseCommand("brighten the strip"), all, []).command.parameters.value, 100);
  assert.notEqual(parseCommand("set alarm time to 10").action, "SET_BRIGHTNESS");
});

test("siren commands are bounded by the device's maximum duration", () => {
  const sound = resolveControlCommand(parseCommand("Sound the siren for 5 seconds"), all, []);
  assert.equal(sound.command.command, "ACTIVATE_SIREN");
  assert.equal(sound.command.parameters.durationSeconds, 5);
  assert.equal(resolveControlCommand(parseCommand("test the siren for 99 seconds"), all, []).command.parameters.durationSeconds, 30);
  assert.equal(resolveControlCommand(parseCommand("sound the siren"), all, []).command.parameters.durationSeconds, 10);
  assert.equal(resolveControlCommand(parseCommand("stop the siren"), all, []).command.command, "STOP_SIREN");
  assert.equal(resolveControlCommand(parseCommand("silence the alarm"), all, []).command.command, "STOP_SIREN");
});

test("the big fan alias finds the shared estate fan", () => {
  const result = resolveControlCommand(parseCommand("turn on the big fan"), all, []);
  assert.deepEqual(result.command.deviceIds, ["bigfan"]);
});

test("everyday phrasings map to on and off", () => {
  assert.equal(parseCommand("kill the lights").action, "OFF");
  assert.equal(parseCommand("lights out").action, "OFF");
  assert.equal(parseCommand("turn the strip on").action, "ON");
  const dark = parseCommand("it's dark in the living room");
  assert.equal(dark.action, "ON");
  assert.deepEqual(resolveControlCommand(dark, all, []).command.deviceIds, ["l1"]);
});

test("the current house wins when a name exists in several houses", () => {
  const ambiguous = resolveControlCommand(parseCommand("turn on the kitchen light"), all, [], [], [], scopes);
  assert.equal(ambiguous.kind, "ambiguous");
  const preferred = resolveControlCommand(parseCommand("turn on the kitchen light"), all, [], [], [], scopes, { preferHouseId: "h2" });
  assert.deepEqual(preferred.command.deviceIds, ["k2"]);
  const named = resolveControlCommand(parseCommand("turn on the kitchen light in house 1"), all, [], [], [], scopes, { preferHouseId: "h2" });
  assert.deepEqual(named.command.deviceIds, ["k1"]);
});

test("all lights means the current house unless the estate is named", () => {
  const house = resolveControlCommand(parseCommand("turn off all lights"), all, [], [], [], scopes, { scopeHouseId: "h1" });
  assert.deepEqual(house.command.deviceIds.toSorted(), ["k1", "l1"]);
});

test("multi-step requests split only on new actions", () => {
  assert.deepEqual(splitSteps("turn off the lights and arm House 1"), ["turn off the lights", "arm House 1"]);
  assert.deepEqual(splitSteps("turn off the lights and fans"), ["turn off the lights and fans"]);
  assert.deepEqual(splitSteps("turn on the kitchen light then make the strip blue"), ["turn on the kitchen light", "make the strip blue"]);
  assert.equal(splitSteps("which devices are offline, and is the gate open").length, 2);
});

test("routines build plans from what the user can control", () => {
  const ctx = { houseName: "House 1", isAdmin: false, houseDeviceTypes: new Set(["LIGHT"]), hasPerimeterStrip: true, hasGate: true };
  assert.deepEqual(matchRoutine(normalizeCommand("Goodnight Nexora"), ctx), { name: "Goodnight", steps: ["turn off all lights", "arm House 1"] });
  assert.deepEqual(matchRoutine(normalizeCommand("I'm home"), ctx).steps, ["disarm House 1", "turn on all lights"]);
  assert.equal(matchRoutine(normalizeCommand("lockdown"), ctx), null, "residents cannot run the estate lockdown");
  const admin = matchRoutine(normalizeCommand("lock down the estate"), { ...ctx, isAdmin: true });
  assert.deepEqual(admin.steps, ["arm all houses", "arm the perimeter", "close the gate", "turn on the perimeter strip"]);
  assert.equal(matchRoutine(normalizeCommand("turn on the kitchen light"), ctx), null);
});

test("activity questions are recognised without breaking status questions", () => {
  const kinds = ["Which devices are offline?", "When was motion last detected in House 1?", "Any alarms today?", "What happened while I was away?", "Who opened the gate?", "Is the controller online?"].map((text) => parseCommand(text).activity?.kind);
  assert.deepEqual(kinds, ["OFFLINE_DEVICES", "LAST_MOTION", "ALARMS", "SUMMARY", "DEVICE_HISTORY", "CONTROLLER_STATUS"]);
  assert.equal(parseCommand("Any alarms today?").activity.hours, 0);
  assert.equal(parseCommand("What is the security status?").intent, "SECURITY_STATUS");
  assert.equal(parseCommand("Is the gate open?").intent, "DEVICE_STATUS");
});

test("activity answers use only the supplied authorized data", () => {
  const now = Date.parse("2026-11-25T12:00:00Z");
  const data = {
    now,
    events: [
      { type: "MOTION_DETECTED", occurredAt: "2026-11-25T11:50:00Z", deviceId: "pir1", houseId: "h1" },
      { type: "SECURITY_ALARM", severity: "CRITICAL", occurredAt: "2026-11-25T10:00:00Z", deviceId: "pir1", houseId: "h1", zone: "HOUSE_1_SECURITY" },
    ],
    commands: [{ deviceId: "gate", deviceName: "Main gate", type: "OPEN_GATE", status: "EXECUTED", requestedAt: "2026-11-25T11:00:00Z", requestedByName: "Amina" }],
    devices: [{ id: "pir1", name: "Hall motion sensor", houseId: "h1", type: "MOTION_SENSOR" }, { id: "gate", name: "Main gate", type: "GATE" }, { id: "k2", name: "Kitchen light", houseId: "h2", type: "LIGHT" }],
    states: { pir1: { connectivity: "ONLINE" }, gate: { connectivity: "ONLINE" }, k2: { connectivity: "OFFLINE" } },
    houses: [{ id: "h1", name: "House 1" }, { id: "h2", name: "House 2" }],
    controllers: [{ name: "Estate controller", networkState: "ONLINE", lastHeartbeatAt: "2026-11-25T11:59:50Z" }],
  };
  const ask = (text) => answerActivity(parseCommand(text).activity, normalizeCommand(text), data);
  assert.match(ask("Which devices are offline?"), /1 device is offline: Kitchen light \(House 2\)/);
  assert.match(ask("When was motion last detected?"), /10 minutes ago by Hall motion sensor in House 1/);
  assert.match(ask("Any alarms in the last 6 hours?"), /1 alarm .* 2 hours ago in house 1 security/);
  assert.match(ask("Any alarms in house 2?"), /No alarms/);
  assert.match(ask("Who opened the main gate?"), /Main gate was opened 1 hour ago by Amina/);
  assert.match(ask("Is the controller online?"), /Estate controller is online/);
  assert.match(ask("What happened in the last 24 hours?"), /1 motion event, 1 alarm and 1 device command/);
  assert.match(answerActivity({ kind: "CONTROLLER_STATUS" }, "", { ...data, controllers: undefined }), /estate administrators/);
});
