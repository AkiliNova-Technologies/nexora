import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import test from "node:test";

import { decryptWifiPassword, encryptWifiPassword, wifiCredentialError, wifiSecretKey } from "../src/lib/controllers/wifi-secret.ts";

const key = randomBytes(32);

test("a Wi-Fi password round-trips for its own request only", () => {
  const secret = encryptWifiPassword("correct-horse-battery", "request-1", key);
  assert.ok(!secret.ciphertext.includes("correct"), "ciphertext must not contain the password");
  assert.equal(decryptWifiPassword(secret, "request-1", key), "correct-horse-battery");
  assert.throws(() => decryptWifiPassword(secret, "request-2", key), "a ciphertext cannot be moved to another request");
  assert.throws(() => decryptWifiPassword(secret, "request-1", randomBytes(32)), "the wrong key must fail");
  const tampered = { ...secret, ciphertext: Buffer.from("x".repeat(21)).toString("base64") };
  assert.throws(() => decryptWifiPassword(tampered, "request-1", key), "tampering must be detected");
});

test("the server key must be configured as 64 hex characters", () => {
  assert.throws(() => wifiSecretKey({}), /NEXORA_WIFI_SECRET_KEY/);
  assert.throws(() => wifiSecretKey({ NEXORA_WIFI_SECRET_KEY: "abc" }), /NEXORA_WIFI_SECRET_KEY/);
  assert.equal(wifiSecretKey({ NEXORA_WIFI_SECRET_KEY: "a".repeat(64) }).length, 32);
});

test("network credentials follow the same rules as the firmware", () => {
  assert.equal(wifiCredentialError("Estate-Office", "correct-horse"), null);
  assert.equal(wifiCredentialError("Cafe", ""), null, "open networks have no password");
  assert.match(wifiCredentialError("", "correct-horse"), /1 to 32/);
  assert.match(wifiCredentialError("x".repeat(33), "correct-horse"), /1 to 32/);
  assert.match(wifiCredentialError("Estate", "short"), /8 to 63/);
  assert.match(wifiCredentialError("Estate", "x".repeat(64)), /8 to 63/);
});
