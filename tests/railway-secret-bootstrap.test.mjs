import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const broker = await readFile(new URL("../infrastructure/mosquitto/entrypoint.sh", import.meta.url), "utf8");
const bridge = await readFile(new URL("../infrastructure/bridge/entrypoint.sh", import.meta.url), "utf8");

test("broker materializes every protected input atomically and removes it from the daemon environment", () => {
  for (const name of ["MQTT_CERT_PEM_B64", "MQTT_KEY_PEM_B64", "MQTT_CA_PEM_B64", "MQTT_CONTROLLER_REGISTRY_JSON_B64", "MQTT_CREDENTIALS_JSON_B64"]) {
    assert.match(broker, new RegExp(`materialize_secret ${name}`));
  }
  assert.match(broker, /chmod 0600 "\$temporary"/);
  assert.match(broker, /mv "\$temporary" "\$destination"/);
  assert.match(broker, /unset MQTT_CERT_PEM_B64 MQTT_KEY_PEM_B64 MQTT_CA_PEM_B64 MQTT_CONTROLLER_REGISTRY_JSON_B64 MQTT_CREDENTIALS_JSON_B64/);
});

test("bridge materializes only the public CA and unsets its source", () => {
  assert.match(bridge, /MQTT_CA_PEM_B64/);
  assert.match(bridge, /chmod 0600 "\$temporary"/);
  assert.match(bridge, /chown bridge:bridge "\$ca_file"/);
  assert.match(bridge, /unset MQTT_CA_PEM_B64/);
  assert.doesNotMatch(bridge, /MQTT_KEY_PEM_B64/);
});
