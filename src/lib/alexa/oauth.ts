import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export const ALEXA_SCOPE = "alexa:smart_home";
export const ACCESS_TOKEN_TTL_SECONDS = 900;
export const AUTHORIZATION_CODE_TTL_SECONDS = 300;

export const opaqueToken = (bytes = 32) => randomBytes(bytes).toString("base64url");
export const tokenHash = (value: string) => createHash("sha256").update(value).digest("hex");

export function constantTimeSecretMatches(value: string, expected: string) {
  const left = Buffer.from(value);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function parseBasicClient(request: Request, form: URLSearchParams) {
  const authorization = request.headers.get("authorization") ?? "";
  if (authorization.startsWith("Basic ")) {
    try {
      const decoded = Buffer.from(authorization.slice(6), "base64").toString("utf8");
      const separator = decoded.indexOf(":");
      if (separator > 0) return { clientId: decodeURIComponent(decoded.slice(0, separator)), clientSecret: decodeURIComponent(decoded.slice(separator + 1)) };
    } catch { return null; }
  }
  const clientId = form.get("client_id"), clientSecret = form.get("client_secret");
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}
