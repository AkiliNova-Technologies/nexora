import { NextResponse } from "next/server";
import { getSql } from "@/lib/cloud/db";
import { elapsedMs, logServerTiming } from "@/lib/cloud/timing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function diagnosticCode(error: unknown) {
  const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
  if (code === "28P01") return "AUTHENTICATION_FAILED";
  if (code === "3D000") return "DATABASE_NOT_FOUND";
  if (code === "ENOTFOUND" || code === "EAI_AGAIN") return "DNS_FAILED";
  if (code === "ECONNREFUSED") return "CONNECTION_REFUSED";
  if (code.includes("TIMEOUT")) return "CONNECTION_TIMEOUT";
  if (error instanceof Error && error.message === "DATABASE_URL is not configured") return "NOT_CONFIGURED";
  return "CONNECTION_FAILED";
}

export async function GET() {
  const startedAt = performance.now();
  try {
    const sql = getSql();
    await sql`select 1 as ready`;
    const latencyMs = elapsedMs(startedAt);
    logServerTiming("database.health", { outcome: "ready", totalMs: latencyMs });
    return NextResponse.json(
      { status: "ready", latencyMs },
      { headers: { "Cache-Control": "private, no-store, max-age=0" } },
    );
  } catch (error) {
    const code = diagnosticCode(error);
    console.error("Database readiness check failed", {
      code,
      totalMs: elapsedMs(startedAt),
    });
    return NextResponse.json(
      { status: "unavailable", code },
      { status: 503, headers: { "Cache-Control": "private, no-store, max-age=0" } },
    );
  }
}
