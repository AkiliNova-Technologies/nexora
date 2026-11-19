import https from "node:https";
import { readFileSync } from "node:fs";

let delivered = false;
const accepted = [];
const command = { commandId: "11111111-1111-4111-8111-111111111111", controllerId: "controller-fixture-01", scopeId: "house-fixture-01", deviceId: "light-fixture-01", type: "TURN_ON", parameters: {}, issuedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 3600000).toISOString() };
const auth = (request) => request.headers["x-iot-gateway-id"] === "gateway-fixture" && request.headers.authorization === "Bearer gateway-credential-fixture-only";
const body = async (request) => { const chunks=[]; for await (const chunk of request) chunks.push(chunk); return JSON.parse(Buffer.concat(chunks).toString() || "{}"); };
const send = (response, status, value) => { response.writeHead(status, { "content-type": "application/json" }); response.end(JSON.stringify(value)); };

https.createServer({ key: readFileSync("/run/secrets/cloud-key.pem"), cert: readFileSync("/run/secrets/cloud-cert.pem") }, async (request, response) => {
  if (!auth(request)) return send(response, 401, { code: "UNAUTHORIZED" });
  if (request.url?.startsWith("/api/iot/v1/bridge/sync")) return send(response, 200, { controllers: [{ controllerId: "controller-fixture-01", scopes: ["house-fixture-01"], devices: [{ scopeId: "house-fixture-01", deviceId: "light-fixture-01" }] }], securityModes: [], revokedControllerIds: [] });
  if (request.url?.startsWith("/api/iot/v1/commands")) { const commands = delivered ? [] : [command]; delivered = true; return send(response, 200, { commands }); }
  if (request.url === "/api/iot/v1/events") { const value = await body(request); accepted.push(...value.events); return send(response, 200, { acceptedEventIds: value.events.map((event) => event.eventId) }); }
  if (request.url?.includes("/heartbeat")) return send(response, 200, { receivedAt: new Date().toISOString() });
  if (request.url === "/result") return send(response, 200, { accepted });
  return send(response, 404, {});
}).listen(8443, "0.0.0.0");
