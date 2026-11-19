import { createServer } from "node:http";
import { loadConfig } from "./config.js";
import { BridgeStore } from "./store.js";
import { CloudClient } from "./cloud.js";
import { connectBroker } from "./broker.js";
import { Bridge } from "./bridge.js";
import { log } from "./log.js";

const config = loadConfig();
const store = new BridgeStore(config.storePath, config.maxQueuedEvents);
let acknowledge: Parameters<typeof connectBroker>[1] = (_topic, _payload, _packet, done) => done(new Error("bridge_not_ready"), 128);
const mqtt = connectBroker(config, (topic, payload, packet, done) => acknowledge?.(topic, payload, packet, done));
const bridge = new Bridge(new CloudClient(config.apiBaseUrl, config.gatewayId, config.gatewayCredential), mqtt, store, config.pollIntervalMs, config.maxBackoffMs, config.maxPayloadBytes, config.eventRetentionDays);
acknowledge = (topic, payload, _packet, done) => bridge.persistBeforeMqttAck(topic, payload, done);
const server = createServer((request, response) => {
  const health = bridge.health();
  const readiness = request.url === "/readyz";
  response.writeHead(readiness && !health.ready ? 503 : 200, { "content-type": "application/json", "cache-control": "no-store" });
  response.end(JSON.stringify(health));
});
server.listen(config.healthPort, "0.0.0.0", () => log("info", "health_server_started", { port: config.healthPort }));

let stopping = false;
async function shutdown(signal: string) {
  if (stopping) return;
  stopping = true;
  log("info", "shutdown_started", { signal });
  server.close();
  await bridge.stop();
}
process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
void bridge.start().catch((error) => { log("error", "bridge_stopped", { error: error instanceof Error ? error.message : "unknown" }); process.exitCode = 1; });
