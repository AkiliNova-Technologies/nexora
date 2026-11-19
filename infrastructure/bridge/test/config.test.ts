import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { loadConfig } from "../src/config.js";

test("requires TLS for public MQTT", () => {
  const directory = mkdtempSync(join(tmpdir(), "nexora-config-"));
  const ca = join(directory, "ca.pem");
  writeFileSync(ca, "fixture");
  const base = { NEXORA_API_BASE_URL: "https://example.com", NEXORA_GATEWAY_ID: "gateway", NEXORA_GATEWAY_CREDENTIAL: "secret", MQTT_USERNAME: "bridge", MQTT_PASSWORD: "secret", MQTT_CA_FILE: ca };
  assert.throws(() => loadConfig({ ...base, MQTT_URL: "mqtt://broker:1883" }), /mqtts/);
  assert.equal(loadConfig({ ...base, MQTT_URL: "mqtts://broker:8883" }).pollIntervalMs, 3000);
  rmSync(directory, { recursive: true });
});
