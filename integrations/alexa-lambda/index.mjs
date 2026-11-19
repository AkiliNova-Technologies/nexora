import { createHmac } from "node:crypto";

const backendUrl = process.env.NEXORA_ALEXA_API_URL;
const sharedSecret = process.env.NEXORA_ALEXA_SHARED_SECRET;
const configuredTimeoutMs = Number(process.env.NEXORA_ALEXA_TIMEOUT_MS ?? 7000);
const timeoutMs = Number.isFinite(configuredTimeoutMs)
  ? Math.min(7000, Math.max(1000, Math.trunc(configuredTimeoutMs)))
  : 7000;

export async function handler(event) {
  if (!backendUrl || !sharedSecret || !backendUrl.startsWith("https://")) return alexaError(event, "BRIDGE_UNREACHABLE", "The Nexora integration is not configured.");
  const raw = JSON.stringify(event);
  const timestamp = Date.now().toString();
  const signature = createHmac("sha256", sharedSecret).update(`${timestamp}.${raw}`).digest("hex");
  try {
    const response = await fetch(backendUrl, { method: "POST", headers: { "content-type": "application/json", "x-nexora-timestamp": timestamp, "x-nexora-signature": signature }, body: raw, signal: AbortSignal.timeout(timeoutMs) });
    if (!response.ok) return alexaError(event, response.status === 401 ? "INVALID_AUTHORIZATION_CREDENTIAL" : "BRIDGE_UNREACHABLE", "Nexora could not process the request.");
    return await response.json();
  } catch { return alexaError(event, "BRIDGE_UNREACHABLE", "Nexora is temporarily unavailable."); }
}

function alexaError(event, type, message) {
  const correlationToken = event?.directive?.header?.correlationToken;
  return { event: { header: { namespace: "Alexa", name: "ErrorResponse", payloadVersion: "3", messageId: crypto.randomUUID(), ...(correlationToken ? { correlationToken } : {}) }, payload: { type, message } } };
}
