import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

export const AMAZON_AUTHORIZATION_URL = "https://www.amazon.com/ap/oa";
export const AMAZON_TOKEN_URL = "https://api.amazon.com/auth/o2/token";
export const ALEXA_API_HOSTS = new Set(["api.amazonalexa.com", "api.eu.amazonalexa.com", "api.fe.amazon.com"]);
export const LINK_TRANSACTION_TTL_SECONDS = 300;
export const STATUS_CACHE_SECONDS = 900;
const NETWORK_TIMEOUT_MS = 8_000;

export type AppLinkConfig = { skillId: string; stage: "development" | "live"; clientId: string; clientSecret: string; redirectUri: string; encryptionKey: Buffer };
export type AmazonTokens = { accessToken: string; refreshToken?: string; expiresIn: number };
export type EnablementStatus = "ENABLED" | "ENABLING" | "ENABLING_FAILED" | "DISABLED" | "DISABLING" | "DISABLING_FAILED" | "NO_ASSOCIATION";
export class AlexaApiError extends Error {
  status: number;
  code?: string;
  constructor(status: number, code?: string) { super(`Alexa API request failed (${status})`); this.status = status; this.code = code; }
}

export function appLinkConfig(): AppLinkConfig {
  const stage = process.env.ALEXA_SKILL_STAGE;
  const hexKey = process.env.ALEXA_APP_LINK_ENCRYPTION_KEY ?? "";
  const values = {
    skillId: process.env.ALEXA_SKILL_ID ?? "",
    clientId: process.env.ALEXA_APP_LINK_CLIENT_ID ?? "",
    clientSecret: process.env.ALEXA_APP_LINK_CLIENT_SECRET ?? "",
    redirectUri: process.env.ALEXA_APP_LINK_REDIRECT_URI ?? "",
  };
  if (!values.skillId.startsWith("amzn1.ask.skill.") || !["development", "live"].includes(stage ?? "") || !values.clientId || !values.clientSecret || !/^https:\/\//.test(values.redirectUri) || !/^[0-9a-fA-F]{64}$/.test(hexKey)) throw new Error("Alexa website linking is not configured");
  return { ...values, stage: stage as AppLinkConfig["stage"], encryptionKey: Buffer.from(hexKey, "hex") };
}

export const oauthState = () => randomBytes(32).toString("base64url");
export const pkceVerifier = () => randomBytes(64).toString("base64url");
export const pkceChallenge = (verifier: string) => createHash("sha256").update(verifier).digest("base64url");
export const stateHash = (state: string) => createHash("sha256").update(state).digest("hex");

export function validatedReturnPath(value: string | null) {
  return value === "/settings" || value?.startsWith("/settings?") ? value : "/settings?integration=alexa";
}

export function encryptCredential(plain: string, key: Buffer, context: string) {
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, nonce);
  cipher.setAAD(Buffer.from(context));
  const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return { ciphertext: ciphertext.toString("base64"), nonce: nonce.toString("base64"), tag: cipher.getAuthTag().toString("base64"), version: 1 };
}

export function decryptCredential(value: { ciphertext: string; nonce: string; tag: string; version: number }, key: Buffer, context: string) {
  if (value.version !== 1) throw new Error("Unsupported credential encryption version");
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(value.nonce, "base64"));
  decipher.setAAD(Buffer.from(context));
  decipher.setAuthTag(Buffer.from(value.tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(value.ciphertext, "base64")), decipher.final()]).toString("utf8");
}

export function amazonAuthorizationUrl(config: AppLinkConfig, state: string, challenge: string) {
  const url = new URL(AMAZON_AUTHORIZATION_URL);
  url.search = new URLSearchParams({ client_id: config.clientId, scope: "alexa::skills:account_linking", response_type: "code", redirect_uri: config.redirectUri, state, code_challenge: challenge, code_challenge_method: "S256" }).toString();
  return url;
}

async function amazonFetch(url: URL | string, init: RequestInit) {
  const target = new URL(url);
  if (!["www.amazon.com", "api.amazon.com", ...ALEXA_API_HOSTS].includes(target.hostname) || target.protocol !== "https:") throw new Error("Untrusted Amazon endpoint");
  return fetch(target, { ...init, redirect: "error", cache: "no-store", signal: AbortSignal.timeout(NETWORK_TIMEOUT_MS) });
}

export async function exchangeAmazonCode(config: AppLinkConfig, code: string, verifier: string): Promise<AmazonTokens> {
  const body = new URLSearchParams({ grant_type: "authorization_code", code, client_id: config.clientId, client_secret: config.clientSecret, redirect_uri: config.redirectUri, code_verifier: verifier });
  const response = await amazonFetch(AMAZON_TOKEN_URL, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" }, body });
  const payload = await response.json().catch(() => null) as Record<string, unknown> | null;
  if (!response.ok || !payload || typeof payload.access_token !== "string" || typeof payload.expires_in !== "number") throw new Error("Amazon token exchange failed");
  return { accessToken: payload.access_token, refreshToken: typeof payload.refresh_token === "string" ? payload.refresh_token : undefined, expiresIn: payload.expires_in };
}

export async function refreshAmazonToken(config: AppLinkConfig, refreshToken: string): Promise<AmazonTokens> {
  const body = new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken, client_id: config.clientId, client_secret: config.clientSecret });
  const response = await amazonFetch(AMAZON_TOKEN_URL, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" }, body });
  const payload = await response.json().catch(() => null) as Record<string, unknown> | null;
  if (!response.ok || !payload || typeof payload.access_token !== "string" || typeof payload.expires_in !== "number") throw new Error("Amazon token refresh failed");
  return { accessToken: payload.access_token, refreshToken: typeof payload.refresh_token === "string" ? payload.refresh_token : undefined, expiresIn: payload.expires_in };
}

export async function discoverAlexaEndpoints(accessToken: string) {
  const response = await amazonFetch("https://api.amazonalexa.com/v1/alexaApiEndpoint", { headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" } });
  const payload = await response.json().catch(() => null) as { endpoints?: unknown; endpoint?: unknown } | null;
  if (response.status >= 500) return [...ALEXA_API_HOSTS].map(host => `https://${host}`);
  if (!response.ok) throw new Error("Alexa endpoint discovery failed");
  const candidates = [payload?.endpoint, ...(Array.isArray(payload?.endpoints) ? payload.endpoints : [])].filter(value => typeof value === "string") as string[];
  const endpoints = candidates.map(value => new URL(value.includes("://") ? value : `https://${value}`)).filter(url => url.protocol === "https:" && ALEXA_API_HOSTS.has(url.hostname));
  if (!endpoints.length) throw new Error("Alexa returned no trusted regional endpoint");
  return [...new Set(endpoints.map(url => url.origin))];
}

export async function discoverAlexaEndpoint(accessToken: string) { return (await discoverAlexaEndpoints(accessToken))[0]; }

export async function enableAlexaSkill(config: AppLinkConfig, endpoint: string, amazonAccessToken: string, nexoraCode: string) {
  const url = new URL(`/v1/users/~current/skills/${encodeURIComponent(config.skillId)}/enablement`, endpoint);
  if (!ALEXA_API_HOSTS.has(url.hostname)) throw new Error("Untrusted Alexa endpoint");
  const response = await amazonFetch(url, { method: "POST", headers: { Authorization: `Bearer ${amazonAccessToken}`, "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify({ stage: config.stage, accountLinkRequest: { redirectUri: config.redirectUri, authCode: nexoraCode, type: "AUTH_CODE" } }) });
  const payload = await response.json().catch(() => null) as { status?: EnablementStatus; accountLink?: { status?: string }; code?: string } | null;
  if (response.status !== 201 || !payload?.status) throw new AlexaApiError(response.status, payload?.code);
  return payload;
}

export async function getAlexaStatus(config: AppLinkConfig, endpoint: string, accessToken: string) {
  const url = new URL(`/v1/users/~current/skills/${encodeURIComponent(config.skillId)}/enablement`, endpoint);
  const response = await amazonFetch(url, { headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" } });
  const payload = await response.json().catch(() => null) as { status?: EnablementStatus; accountLink?: { status?: string } } | null;
  if (!response.ok || !payload?.status) throw new Error(`Alexa status failed (${response.status})`);
  return payload;
}

export async function disableAlexaSkill(config: AppLinkConfig, endpoint: string, accessToken: string) {
  const url = new URL(`/v1/users/~current/skills/${encodeURIComponent(config.skillId)}/enablement`, endpoint);
  const response = await amazonFetch(url, { method: "DELETE", headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" } });
  if (![200, 202, 204, 404].includes(response.status)) throw new Error(`Alexa unlink failed (${response.status})`);
}
