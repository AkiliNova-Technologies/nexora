import { createHash, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

function equalSecret(left: string, right: string) {
  const a = createHash("sha256").update(left).digest();
  const b = createHash("sha256").update(right).digest();
  return timingSafeEqual(a, b);
}

export function authenticateGateway(request: NextRequest) {
  const expectedId = process.env.IOT_GATEWAY_ID;
  const expectedCredential = process.env.IOT_GATEWAY_CREDENTIAL;
  const actualId = request.headers.get("x-iot-gateway-id") || "";
  const authorization = request.headers.get("authorization") || "";
  const actualCredential = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!expectedId || !expectedCredential || !equalSecret(actualId, expectedId) || !equalSecret(actualCredential, expectedCredential)) return null;
  return { id: expectedId };
}

export function validateMutationRequest(request: NextRequest) {
  const origin = request.headers.get("origin");
  const expected = process.env.NEXT_PUBLIC_SITE_URL;
  if (origin && expected && origin !== new URL(expected).origin) return false;
  const header = request.headers.get("x-xsrf-token");
  const cookie = request.cookies.get("nexora-csrf")?.value;
  return Boolean(header && cookie && equalSecret(header, cookie));
}

