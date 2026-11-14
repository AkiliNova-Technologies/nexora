import assert from "node:assert/strict";
import test from "node:test";

import { SmartEstateApiClient, ApiError } from "../src/lib/api/client.ts";
import { mockDevices, mockDeviceStates } from "../src/data/mock-smart-estate.ts";
import { DeviceStore } from "../src/lib/device-store.ts";

test("API mutations acquire CSRF and include cookies and the token", async () => {
  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    if (String(url).endsWith("/csrf")) return Response.json({ token: "csrf-token" });
    return Response.json({ id: "u1", name: "Resident", email: "r@example.com", role: "USER" });
  };
  try {
    const client = new SmartEstateApiClient("http://backend.test/api/v1");
    await client.login({ email: "r@example.com", password: "password" });
    assert.equal(calls.length, 2);
    assert.equal(calls[0].init.credentials, "include");
    assert.equal(calls[1].init.credentials, "include");
    assert.equal(calls[1].init.headers["X-XSRF-TOKEN"], "csrf-token");
  } finally { globalThis.fetch = originalFetch; }
});

test("API errors preserve backend status, code, and field errors", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => Response.json({ code: "VALIDATION_ERROR", message: "Invalid request", fieldErrors: { email: "invalid" } }, { status: 400 });
  try {
    const client = new SmartEstateApiClient("http://backend.test/api/v1");
    await assert.rejects(client.me(), (error) => error instanceof ApiError && error.status === 400 && error.code === "VALIDATION_ERROR" && error.fieldErrors.email === "invalid");
  } finally { globalThis.fetch = originalFetch; }
});

test("API mutations refresh a stale CSRF token once", async () => {
  const calls = [];
  let csrfCount = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    if (String(url).endsWith("/csrf")) return Response.json({ token: `csrf-${++csrfCount}` });
    if (init.headers["X-XSRF-TOKEN"] === "csrf-1") {
      return Response.json({ code: "CSRF_INVALID", message: "Request validation failed" }, { status: 403 });
    }
    return Response.json({ id: "u1", name: "Resident", email: "r@example.com", role: "USER" });
  };
  try {
    const client = new SmartEstateApiClient("http://backend.test/api/v1");
    await client.login({ email: "r@example.com", password: "password" });
    assert.equal(calls.length, 4);
    assert.equal(calls[1].init.headers["X-XSRF-TOKEN"], "csrf-1");
    assert.equal(calls[3].init.headers["X-XSRF-TOKEN"], "csrf-2");
  } finally { globalThis.fetch = originalFetch; }
});

test("backend command mode remains accepted until an SSE state reconciles it", async () => {
  const store = new DeviceStore(mockDevices, mockDeviceStates);
  store.setCommandSender(async (deviceId, type, value, id) => ({ id, deviceId, type, parameters: value === undefined ? null : { value }, status: "ACCEPTED", requestedAt: new Date().toISOString(), completedAt: null, error: null }));
  await store.sendCommand("dev-living-lights", "TURN_OFF");
  assert.equal(store.getSnapshot().states["dev-living-lights"].commandStatus, "ACCEPTED");
  assert.equal(store.getSnapshot().states["dev-living-lights"].reported.on, true);
  store.reconcileState({ ...store.getSnapshot().states["dev-living-lights"], desired: null, reported: { on: false }, commandStatus: "EXECUTED" });
  assert.equal(store.getSnapshot().states["dev-living-lights"].reported.on, false);
});

test("a timed-out backend command cannot leave the toggle at an unconfirmed state", async () => {
  const store = new DeviceStore(mockDevices, mockDeviceStates);
  store.setCommandSender(async (deviceId, type, value, id) => ({ id, deviceId, type, parameters: value === undefined ? null : { value }, status: "ACCEPTED", requestedAt: new Date().toISOString(), completedAt: null, error: null }));
  const accepted = await store.sendCommand("dev-living-lights", "TURN_OFF");
  store.reconcileCommand({ ...accepted, status: "TIMEOUT", completedAt: new Date().toISOString(), error: "MQTT acknowledgment timeout" });
  store.reconcileState({ ...store.getSnapshot().states["dev-living-lights"], desired: null, reported: { on: true }, commandStatus: "TIMEOUT" });
  const state = store.getSnapshot().states["dev-living-lights"];
  assert.equal(state.reported.on, true);
  assert.equal(state.desired, null);
  assert.equal(state.commandStatus, "TIMEOUT");
});

test("SSE state for an unknown or other-house device cannot mutate inventory", () => {
  const store = new DeviceStore(mockDevices, mockDeviceStates);
  const before = store.getSnapshot();
  store.reconcileState({ ...mockDeviceStates[0], deviceId: "other-house-light", reported: { on: false } });
  assert.strictEqual(store.getSnapshot(), before);
  assert.equal(store.getSnapshot().states["dev-living-lights"].reported.on, true);
});
