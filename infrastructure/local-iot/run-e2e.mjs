import { createRequire } from "node:module";
const require = createRequire(new URL("../bridge/package.json", import.meta.url));
const { connect } = require("mqtt");

const ca = process.env.TEST_CA_FILE;
if (!ca) throw new Error("TEST_CA_FILE is required");
const client = connect("mqtts://localhost:18883", {
  clientId: "simulated-controller-e2e",
  username: "controller-fixture-01",
  password: "controller-password-fixture-only-000000000",
  ca: [await import("node:fs").then(({ readFileSync }) => readFileSync(ca))],
  rejectUnauthorized: true,
  reconnectPeriod: 0,
});
const topic = "smartestate/v1/house-fixture-01/light-fixture-01/command";
const timeout = setTimeout(() => { client.end(true); throw new Error("command_timeout"); }, 15000);

await new Promise((resolve, reject) => {
  client.once("error", reject);
  client.subscribe(topic, { qos: 1 }, async (error) => {
    if (error) return reject(error);
    const response = await fetch("https://localhost:8443/arm", { headers: { authorization: "Bearer gateway-credential-fixture-only", "x-iot-gateway-id": "gateway-fixture" } });
    if (!response.ok) return reject(new Error(`arm_${response.status}`));
    resolve();
  });
});

const outcome = await new Promise((resolve, reject) => {
  client.once("error", reject);
  client.once("message", (_topic, bytes) => {
    const command = JSON.parse(bytes.toString());
    const eventId = "controller-fixture-01:fixture-boot:100";
    const acknowledgement = { eventId, commandId: command.commandId, status: "EXECUTED", reported: { on: true }, occurredAt: new Date().toISOString() };
    const payload = JSON.stringify(acknowledgement);
    client.publish("smartestate/v1/house-fixture-01/light-fixture-01/ack", payload, { qos: 1, retain: false }, (error) => {
      if (error) return reject(error);
      client.publish("smartestate/v1/house-fixture-01/light-fixture-01/ack", payload, { qos: 1, retain: false }, (duplicateError) => duplicateError ? reject(duplicateError) : resolve({ command, acknowledgement }));
    });
  });
});
clearTimeout(timeout);
await new Promise((resolve) => client.end(false, {}, resolve));
const heartbeatClient = connect("mqtts://localhost:18883", {
  clientId: "simulated-controller-heartbeat",
  username: "controller-fixture-01",
  password: "controller-password-fixture-only-000000000",
  ca: [await import("node:fs").then(({ readFileSync }) => readFileSync(ca))],
  rejectUnauthorized: true,
  reconnectPeriod: 0,
});
await new Promise((resolve, reject) => heartbeatClient.once("connect", resolve).once("error", reject));
const heartbeatTopic = "smartestate/v1/controllers/controller-fixture-01/heartbeat";
const securityTopic = "smartestate/v1/controllers/controller-fixture-01/security-mode";
await new Promise((resolve, reject) => heartbeatClient.subscribe(securityTopic, { qos: 1 }, (error) => error ? reject(error) : resolve()));
const securityMode = new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error("security_mode_timeout")), 5000);
  heartbeatClient.on("message", (topic, bytes) => {
    if (topic !== securityTopic) return;
    clearTimeout(timer);
    resolve(JSON.parse(bytes.toString()));
  });
});
const heartbeat = (bootId, sequence, occurredAt) => ({ controllerId: "controller-fixture-01", bootId, sequence, uptimeSeconds: sequence, occurredAt });
await new Promise((resolve, reject) => heartbeatClient.publish(heartbeatTopic, JSON.stringify(heartbeat("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", 1, new Date(Date.now() - 120000).toISOString())), { qos: 1 }, (error) => error ? reject(error) : resolve()));
await new Promise((resolve, reject) => heartbeatClient.publish(heartbeatTopic, JSON.stringify(heartbeat("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", 2, new Date().toISOString())), { qos: 1 }, (error) => error ? reject(error) : resolve()));
const deliveredSecurityMode = await securityMode;
if (deliveredSecurityMode.version !== 7 || deliveredSecurityMode.mode !== "DISARMED") throw new Error("security_mode_reconciliation_failed");
await new Promise((resolve) => heartbeatClient.end(false, {}, resolve));
await new Promise((resolve) => setTimeout(resolve, 1500));
const result = await fetch("https://localhost:8443/result", { headers: { authorization: "Bearer gateway-credential-fixture-only", "x-iot-gateway-id": "gateway-fixture" } }).then((response) => response.json());
if (result.accepted.length !== 1 || !result.accepted.some((event) => event.eventId === outcome.acknowledgement.eventId && event.body.status === "EXECUTED")) throw new Error("acknowledgement_dedupe_failed");
if (result.heartbeats.length !== 1 || result.heartbeats[0].bootId !== "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb") throw new Error("stale_heartbeat_filter_failed");
process.stdout.write(`${JSON.stringify({ commandId: outcome.command.commandId, eventId: outcome.acknowledgement.eventId, acceptedCount: result.accepted.length, forwardedHeartbeats: result.heartbeats.length, securityModeVersion: deliveredSecurityMode.version })}\n`);
