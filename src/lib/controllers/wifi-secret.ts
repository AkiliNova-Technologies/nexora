import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/** Encrypted Wi-Fi password, bound to one provisioning request. */
export type WifiSecret = { ciphertext: string; nonce: string; tag: string };

export class WifiSecretUnavailableError extends Error {}

/** 32-byte key from NEXORA_WIFI_SECRET_KEY (64 hex characters), server-only. */
export function wifiSecretKey(env: NodeJS.ProcessEnv = process.env) {
  const hex = env.NEXORA_WIFI_SECRET_KEY ?? "";
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) throw new WifiSecretUnavailableError("Remote Wi-Fi changes are not configured on the server (set NEXORA_WIFI_SECRET_KEY).");
  return Buffer.from(hex, "hex");
}

// The request ID is authenticated data, so a ciphertext cannot be replayed onto another request.
const context = (requestId: string) => Buffer.from(`nexora-wifi:${requestId}`);

export function encryptWifiPassword(password: string, requestId: string, key: Buffer): WifiSecret {
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, nonce);
  cipher.setAAD(context(requestId));
  const ciphertext = Buffer.concat([cipher.update(password, "utf8"), cipher.final()]);
  return { ciphertext: ciphertext.toString("base64"), nonce: nonce.toString("base64"), tag: cipher.getAuthTag().toString("base64") };
}

export function decryptWifiPassword(secret: WifiSecret, requestId: string, key: Buffer) {
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(secret.nonce, "base64"));
  decipher.setAAD(context(requestId));
  decipher.setAuthTag(Buffer.from(secret.tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(secret.ciphertext, "base64")), decipher.final()]).toString("utf8");
}

/** Same rules as the firmware: 1-32 byte name; open network or 8-63 character password. */
export function wifiCredentialError(ssid: string, password: string) {
  const ssidBytes = Buffer.byteLength(ssid, "utf8");
  if (ssidBytes < 1 || ssidBytes > 32) return "Network name must be 1 to 32 characters.";
  if (password.length !== 0 && (password.length < 8 || password.length > 63)) return "Wi-Fi passwords are 8 to 63 characters (leave it blank for an open network).";
  return null;
}
