import https from "node:https";
import { readFileSync } from "node:fs";

const fixtureDir = process.env.FIXTURE_DIR || "/run/secrets";
let delivered = false;
let armed = false;
let expired = false;
const accepted = [];
const heartbeats = [];
const command = { commandId: "11111111-1111-4111-8111-111111111111", controllerId: "controller-fixture-01", scopeId: "house-fixture-01", deviceId: "light-fixture-01", type: "TURN_ON", parameters: {}, issuedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 3600000).toISOString() };
const auth = (request) => request.headers["x-iot-gateway-id"] === "gateway-fixture" && request.headers.authorization === "Bearer gateway-credential-fixture-only";
const body = async (request) => { const chunks=[]; for await (const chunk of request) chunks.push(chunk); return JSON.parse(Buffer.concat(chunks).toString() || "{}"); };
const send = (response, status, value) => { response.writeHead(status, { "content-type": "application/json" }); response.end(JSON.stringify(value)); };

https.createServer({ key: readFileSync(`${fixtureDir}/cloud-key.pem`), cert: readFileSync(`${fixtureDir}/cloud-cert.pem`) }, async (request, response) => {
  if (!auth(request)) return send(response, 401, { code: "UNAUTHORIZED" });
  if (request.url?.startsWith("/api/iot/v1/bridge/sync")) return send(response, 200, { controllers: [{ controllerId: "controller-fixture-01", scopes: ["house-fixture-01"], devices: [{ scopeId: "house-fixture-01", deviceId: "light-fixture-01" }] }], securityModes: [{ controllerId: "controller-fixture-01", scopeId: "house-fixture-01", mode: "DISARMED", version: 7, issuedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 60000).toISOString() }], revokedControllerIds: [] });
  if (request.url?.startsWith("/api/iot/v1/commands")) { const commands = armed && !delivered ? [{ ...command, expiresAt: expired ? new Date(Date.now() - 1000).toISOString() : command.expiresAt }] : []; if (commands.length) delivered = true; return send(response, 200, { commands }); }
  if (request.url === "/api/iot/v1/events") { const value = await body(request); for (const event of value.events) if (!accepted.some((item) => item.eventId === event.eventId)) accepted.push(event); return send(response, 200, { acceptedEventIds: value.events.map((event) => event.eventId) }); }
  if (request.url?.includes("/heartbeat")) { heartbeats.push(await body(request)); return send(response, 200, { receivedAt: new Date().toISOString() }); }
  if (request.url === "/arm") { armed = true; return send(response, 200, { armed: true }); }
  if (request.url === "/arm-expired") { armed = true; expired = true; return send(response, 200, { armed: true, expired: true }); }
  if (request.url === "/result") return send(response, 200, { accepted, heartbeats });
  return send(response, 404, {});
}).listen(8443, "0.0.0.0");
