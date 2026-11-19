import { createHmac, timingSafeEqual } from "node:crypto";
import { handleAlexaDirective, type AlexaDirective } from "@/lib/alexa/smart-home";
import { createNexoraAlexaControl } from "@/lib/alexa/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const MAX_SIGNATURE_AGE_MS = 5 * 60 * 1000;

function signatureIsValid(raw: string, signature: string | null, timestamp: string | null) {
  const secret = process.env.ALEXA_LAMBDA_SHARED_SECRET;
  if (!secret || !signature || !timestamp || !/^\d{13}$/.test(timestamp)) return false;
  const signedAt = Number(timestamp);
  if (!Number.isSafeInteger(signedAt) || Math.abs(Date.now() - signedAt) > MAX_SIGNATURE_AGE_MS) return false;
  const expected = createHmac("sha256", secret).update(`${timestamp}.${raw}`).digest("hex");
  const left = Buffer.from(signature), right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function POST(request: Request) {
  const raw = await request.text();
  if (!signatureIsValid(raw, request.headers.get("x-nexora-signature"), request.headers.get("x-nexora-timestamp"))) return Response.json({ error: "unauthorized" }, { status: 401 });
  let directive: AlexaDirective;
  try { directive = JSON.parse(raw) as AlexaDirective; }
  catch { return Response.json({ error: "invalid_json" }, { status: 400 }); }
  const result = await handleAlexaDirective(directive, createNexoraAlexaControl());
  return Response.json(result, { headers: { "Cache-Control": "no-store" } });
}
