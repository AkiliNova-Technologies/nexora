import assert from "node:assert/strict";
import test from "node:test";

import { mockDevices, mockDeviceStates, mockRooms } from "../src/data/mock-smart-estate.ts";
import { getCapability, supportsCommand, validateCommand } from "../src/lib/device-capabilities.ts";
import { DeviceStore } from "../src/lib/device-store.ts";
import { MockDeviceSimulator } from "../src/lib/simulation/device-simulator.ts";

test("device identities and room relationships are consistent", () => {
  assert.equal(new Set(mockDevices.map(({ id }) => id)).size, mockDevices.length);
  const roomIds = new Set(mockRooms.map(({ id }) => id));
  for (const device of mockDevices) {
    assert.ok(!device.roomId || roomIds.has(device.roomId));
  }
});

test("three room lights use stable independent identities and room mappings", () => {
  assert.deepEqual(
    mockDevices.filter(({ id }) => ["dev-living-lights", "dev-kitchen-lights", "dev-bedroom-lights"].includes(id)).map(({ id, roomId }) => [id, roomId]),
    [["dev-living-lights", "room-living"], ["dev-kitchen-lights", "room-kitchen"], ["dev-bedroom-lights", "room-bedroom"]],
  );
});

test("switching one physical room light does not change the others", async () => {
  const store = new DeviceStore(mockDevices, mockDeviceStates, new MockDeviceSimulator({ status: "EXECUTED" }, 1));
  await store.sendCommand("dev-kitchen-lights", "TURN_ON");
  assert.equal(store.getSnapshot().states["dev-kitchen-lights"].reported.on, true);
  assert.equal(store.getSnapshot().states["dev-bedroom-lights"].reported.on, false);
  assert.equal(store.getSnapshot().states["dev-living-lights"].reported.on, true);
});

test("fan and thermostat expose distinct validated controls", () => {
  const fan = mockDevices.find(({ type }) => type === "FAN");
  const thermostat = mockDevices.find(({ type }) => type === "THERMOSTAT");
  assert.ok(fan && thermostat);
  assert.ok(getCapability(fan, "FAN_SPEED"));
  assert.equal(getCapability(fan, "TARGET_TEMPERATURE"), undefined);
  assert.ok(getCapability(thermostat, "TARGET_TEMPERATURE"));
  assert.equal(getCapability(thermostat, "FAN_SPEED"), undefined);
  assert.equal(validateCommand(fan, "SET_FAN_SPEED", 101), "Value must be between 0 and 100");
  assert.equal(validateCommand(thermostat, "SET_TARGET_TEMPERATURE", 23), null);
  assert.equal(supportsCommand(thermostat, "SET_FAN_SPEED"), false);
});

test("one store synchronizes state and reports the simulated lifecycle", async () => {
  const store = new DeviceStore(mockDevices, mockDeviceStates, new MockDeviceSimulator({ status: "EXECUTED" }, 1));
  const statuses = [];
  store.subscribe(() => statuses.push(store.getSnapshot().states["dev-living-lights"].commandStatus));

  const promise = store.sendCommand("dev-living-lights", "TURN_OFF");
  assert.equal(store.getSnapshot().states["dev-living-lights"].reported.on, true);
  assert.equal(store.getSnapshot().states["dev-living-lights"].desired.on, false);
  await promise;

  assert.deepEqual(statuses, ["PENDING", "ACCEPTED", "EXECUTED"]);
  assert.equal(store.getSnapshot().states["dev-living-lights"].reported.on, false);
  assert.equal(store.getSnapshot().states["dev-living-lights"].desired, null);
});

test("offline devices reject commands without changing reported state", async () => {
  const store = new DeviceStore(mockDevices, mockDeviceStates);
  await assert.rejects(store.sendCommand("dev-garage-camera", "TURN_ON"), /offline/);
  assert.equal(store.getSnapshot().states["dev-garage-camera"].reported.on, false);
});

test("failed execution preserves reported state and clears desired state", async () => {
  const store = new DeviceStore(
    mockDevices,
    mockDeviceStates,
    new MockDeviceSimulator({ status: "FAILED", error: "Simulated failure" }, 1),
  );
  await store.sendCommand("dev-office-fan", "TURN_ON");
  const state = store.getSnapshot().states["dev-office-fan"];
  assert.equal(state.commandStatus, "FAILED");
  assert.equal(state.reported.on, false);
  assert.equal(state.desired, null);
});

test("timed-out execution is terminal and does not claim reported success", async () => {
  const store = new DeviceStore(
    mockDevices,
    mockDeviceStates,
    new MockDeviceSimulator({ status: "TIMEOUT", error: "No device acknowledgment" }, 1),
  );
  await store.sendCommand("dev-living-lights", "TURN_OFF");
  const state = store.getSnapshot().states["dev-living-lights"];
  assert.equal(state.commandStatus, "TIMEOUT");
  assert.equal(state.reported.on, true);
  assert.equal(state.desired, null);
});
