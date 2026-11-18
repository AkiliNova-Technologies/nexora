import test from "node:test";
import assert from "node:assert/strict";
import { discoveryEndpoints, handleAlexaDirective } from "../src/lib/alexa/smart-home.ts";

const light = { id: "light-1", houseId: "house-1", roomId: "room-1", name: "Kitchen Light", type: "LIGHT", capabilities: [{ type: "POWER" }], allowedOperations: ["VIEW", "READ_STATE", "COMMAND"] };
const gate = { id: "gate-1", estateId: "estate-1", name: "Gate", type: "GATE", capabilities: [{ type: "GATE_CONTROL" }], allowedOperations: ["VIEW", "READ_STATE", "COMMAND"] };
const inventory = { devices: [light, gate], rooms: [{ id: "room-1", houseId: "house-1", name: "Kitchen" }], states: { "light-1": { deviceId: "light-1", connectivity: "ONLINE", desired: null, reported: { on: false }, commandStatus: "IDLE", lastReportedAt: new Date().toISOString() } } };
const directive = (namespace, name, endpointId) => ({ directive: { header: { namespace, name, payloadVersion: "3", messageId: `${namespace}-${name}`, correlationToken: "correlation" }, ...(endpointId ? { endpoint: { endpointId, scope: { type: "BearerToken", token: "linked-token" } } } : {}), payload: endpointId ? {} : { scope: { type: "BearerToken", token: "linked-token" } } } });

test("Alexa discovery exposes only supported authorized household controls", () => {
  const endpoints = discoveryEndpoints(inventory);
  assert.equal(endpoints.length, 1);
  assert.equal(endpoints[0].friendlyName, "Kitchen Light");
  assert.equal(endpoints[0].displayCategories[0], "LIGHT");
});

test("Alexa rejects unlinked directives", async () => {
  const result = await handleAlexaDirective({ directive: { header: { namespace: "Alexa.Discovery", name: "Discover", payloadVersion: "3", messageId: "one" }, payload: {} } }, { discover: async () => inventory, command: async () => { throw new Error(); }, isReplay: async () => false });
  assert.equal(result.event.payload.type, "INVALID_AUTHORIZATION_CREDENTIAL");
});

test("Alexa reports pending commands without claiming success", async () => {
  const result = await handleAlexaDirective(directive("Alexa.PowerController", "TurnOn", "nexora-device-light-1"), { discover: async () => inventory, command: async () => ({ id: "command", deviceId: "light-1", type: "TURN_ON", status: "PENDING", requestedAt: new Date().toISOString() }), isReplay: async () => false });
  assert.equal(result.event.payload.type, "ENDPOINT_BUSY");
});

test("Alexa rejects replayed directives before command submission", async () => {
  let submitted = false;
  const result = await handleAlexaDirective(directive("Alexa.PowerController", "TurnOn", "nexora-device-light-1"), { discover: async () => inventory, command: async () => { submitted = true; throw new Error(); }, isReplay: async () => true });
  assert.equal(result.event.payload.type, "INVALID_DIRECTIVE");
  assert.equal(submitted, false);
});

test("Alexa does not expose or control the estate gate", async () => {
  const result = await handleAlexaDirective(directive("Alexa.PowerController", "TurnOn", "nexora-device-gate-1"), { discover: async () => inventory, command: async () => { throw new Error(); }, isReplay: async () => false });
  assert.equal(result.event.payload.type, "NO_SUCH_ENDPOINT");
});

test("Alexa ReportState uses the authoritative reported power value", async () => {
  const result = await handleAlexaDirective(directive("Alexa", "ReportState", "nexora-device-light-1"), { discover: async () => inventory, command: async () => { throw new Error(); }, isReplay: async () => false });
  assert.equal(result.event.header.name, "StateReport");
  assert.equal(result.context.properties[0].value, "OFF");
});

test("Alexa rejects offline devices before command submission", async () => {
  const offline = { ...inventory, states: { "light-1": { ...inventory.states["light-1"], connectivity: "OFFLINE" } } };
  let submitted = false;
  const result = await handleAlexaDirective(directive("Alexa.PowerController", "TurnOff", "nexora-device-light-1"), { discover: async () => offline, command: async () => { submitted = true; throw new Error(); }, isReplay: async () => false });
  assert.equal(result.event.payload.type, "ENDPOINT_UNREACHABLE");
  assert.equal(submitted, false);
});
