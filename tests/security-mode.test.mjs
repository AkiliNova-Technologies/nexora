import assert from "node:assert/strict";
import test from "node:test";

import { SmartEstateApiClient, ApiError } from "../src/lib/api/client.ts";
import {
  emptySecurityModeState,
  reconcileSecurityMode,
  beginSecurityModeLoad,
  completeSecurityModeLoad,
} from "../src/lib/security-mode-store.ts";

const disarmed = { houseId: "house-1", mode: "DISARMED", version: 0, updatedAt: "2026-10-14T00:00:00Z" };

test("security mode reconciliation rejects another house and older versions", () => {
  const armed = { ...disarmed, mode: "ARMED_AWAY", version: 2 };
  assert.deepEqual(reconcileSecurityMode(armed, { ...disarmed, version: 1 }, "house-1"), armed);
  assert.deepEqual(reconcileSecurityMode(armed, { ...disarmed, houseId: "house-2", version: 3 }, "house-1"), armed);
  assert.deepEqual(reconcileSecurityMode(disarmed, armed, "house-1"), armed);
});

test("house changes clear mode and stale asynchronous loads are ignored", () => {
  const loadingOne = beginSecurityModeLoad(emptySecurityModeState, "house-1", 1);
  const loadingTwo = beginSecurityModeLoad(loadingOne, "house-2", 2);
  assert.equal(loadingTwo.value, null);
  assert.strictEqual(completeSecurityModeLoad(loadingTwo, disarmed, "house-1", 1), loadingTwo);
  const houseTwo = { ...disarmed, houseId: "house-2" };
  assert.deepEqual(completeSecurityModeLoad(loadingTwo, houseTwo, "house-2", 2).value, houseTwo);
});

test("API reads and updates authoritative security mode using PUT and CSRF", async () => {
  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    if (String(url).endsWith("/csrf")) return Response.json({ token: "csrf" });
    return Response.json({ ...disarmed, mode: "ARMED_HOME", version: 1 });
  };
  try {
    const api = new SmartEstateApiClient("http://backend.test/api/v1");
    await api.securityMode("house-1");
    const result = await api.updateSecurityMode("house-1", { mode: "ARMED_HOME", expectedVersion: 0, clientRequestId: crypto.randomUUID() });
    assert.equal(result.mode, "ARMED_HOME");
    assert.equal(calls.at(-1).init.method, "PUT");
    assert.equal(calls.at(-1).init.headers["X-XSRF-TOKEN"], "csrf");
  } finally { globalThis.fetch = originalFetch; }
});

test("version conflicts remain structured for authoritative reload", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => String(url).endsWith("/csrf")
    ? Response.json({ token: "csrf" })
    : Response.json({ code: "SECURITY_MODE_VERSION_CONFLICT", message: "Mode changed" }, { status: 409 });
  try {
    const api = new SmartEstateApiClient("http://backend.test/api/v1");
    await assert.rejects(api.updateSecurityMode("house-1", { mode: "ARMED_AWAY", expectedVersion: 0, clientRequestId: crypto.randomUUID() }), error => error instanceof ApiError && error.status === 409 && error.code === "SECURITY_MODE_VERSION_CONFLICT");
  } finally { globalThis.fetch = originalFetch; }
});
