import { readFileSync } from "node:fs";

export type Config = ReturnType<typeof loadConfig>;

function required(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function integer(env: NodeJS.ProcessEnv, name: string, fallback: number, min: number, max: number) {
  const raw = env[name];
  const value = raw === undefined ? fallback : Number(raw);
  if (!Number.isSafeInteger(value) || value < min || value > max) throw new Error(`${name} must be an integer from ${min} to ${max}`);
  return value;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env) {
  const apiBaseUrl = new URL(required(env, "NEXORA_API_BASE_URL"));
  if (apiBaseUrl.protocol !== "https:" && apiBaseUrl.hostname !== "localhost") throw new Error("NEXORA_API_BASE_URL must use HTTPS");
  const mqttUrl = new URL(required(env, "MQTT_URL"));
  if (mqttUrl.protocol !== "mqtts:") throw new Error("MQTT_URL must use mqtts://; plaintext MQTT is prohibited");
  const caFile = required(env, "MQTT_CA_FILE");
  const mqttCa = readFileSync(caFile);
  return Object.freeze({
    apiBaseUrl: apiBaseUrl.toString().replace(/\/$/, ""),
    gatewayId: required(env, "NEXORA_GATEWAY_ID"),
    gatewayCredential: required(env, "NEXORA_GATEWAY_CREDENTIAL"),
    mqttUrl: mqttUrl.toString(),
    mqttUsername: required(env, "MQTT_USERNAME"),
    mqttPassword: required(env, "MQTT_PASSWORD"),
    mqttCa,
    storePath: env.BRIDGE_STORE_PATH?.trim() || "/data/bridge.sqlite",
    pollIntervalMs: integer(env, "BRIDGE_POLL_INTERVAL_MS", 3000, 500, 60000),
    maxBackoffMs: integer(env, "BRIDGE_MAX_BACKOFF_MS", 30000, 3000, 300000),
    healthPort: integer({ ...env, BRIDGE_HEALTH_PORT: env.BRIDGE_HEALTH_PORT ?? env.PORT }, "BRIDGE_HEALTH_PORT", 8080, 1, 65535),
    maxPayloadBytes: integer(env, "BRIDGE_MAX_PAYLOAD_BYTES", 16384, 1024, 262144),
    maxQueuedEvents: integer(env, "BRIDGE_MAX_QUEUED_EVENTS", 10000, 100, 1000000),
    eventRetentionDays: integer(env, "BRIDGE_EVENT_RETENTION_DAYS", 14, 1, 90),
  });
}
