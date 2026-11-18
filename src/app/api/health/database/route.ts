import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { databaseTimeouts, getSql } from "@/lib/cloud/db";
import { executeDatabaseReadiness } from "@/lib/cloud/database-readiness";
import { elapsedMs, logServerTiming } from "@/lib/cloud/timing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function diagnosticCode(error: unknown) {
  const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
  if (code === "28P01") return "AUTHENTICATION_FAILED";
  if (code === "3D000") return "DATABASE_NOT_FOUND";
  if (code === "ENOTFOUND" || code === "EAI_AGAIN") return "DNS_FAILED";
  if (code === "ECONNREFUSED") return "CONNECTION_REFUSED";
  if (code === "QUEUE_TIMEOUT") return "CONNECTION_QUEUE_TIMEOUT";
  if (code === "QUERY_TIMEOUT" || code === "57014") return "QUERY_TIMEOUT";
  if (code === "CONNECT_TIMEOUT" || code.includes("TIMEOUT")) return "CONNECTION_TIMEOUT";
  if (error instanceof Error && error.message === "DATABASE_URL is not configured") return "NOT_CONFIGURED";
  return "CONNECTION_FAILED";
}

function responseHeaders(requestId: string) {
  return { "Cache-Control": "private, no-store, max-age=0", "X-Request-Id": requestId };
}

export async function GET() {
  const startedAt = performance.now();
  const requestId = randomUUID();
  let sql: ReturnType<typeof getSql> | undefined;
  const logStage = (stage: string, fields: Record<string, number | string | boolean | null> = {}) =>
    logServerTiming("database.health", { requestId, stage, elapsedMs: elapsedMs(startedAt), ...fields });

  logStage("handler_entry");
  try {
    logStage("client_init_start");
    sql = getSql();
    logStage("client_init_complete", {
      connections: sql.stats.connections,
      opening: sql.stats.opening,
      waiting: sql.stats.waiting,
    });
    await executeDatabaseReadiness(sql, (stage) => logStage(stage));
    const latencyMs = elapsedMs(startedAt);
    logStage("ready", { outcome: "ready", totalMs: latencyMs });
    return NextResponse.json(
      { status: "ready", latencyMs, requestId },
      { headers: responseHeaders(requestId) },
    );
  } catch (error) {
    const code = diagnosticCode(error);
    const stage = code.includes("TIMEOUT") ? "timeout" : "error";
    console.error(JSON.stringify({
      event: "database.health",
      stage,
      requestId,
      code,
      totalMs: elapsedMs(startedAt),
      deadlineMs: databaseTimeouts.querySeconds * 1000,
      connections: sql?.stats.connections ?? null,
      opening: sql?.stats.opening ?? null,
      leased: sql?.stats.leased ?? null,
      waiting: sql?.stats.waiting ?? null,
    }));
    return NextResponse.json(
      { status: "unavailable", code, requestId },
      { status: 503, headers: responseHeaders(requestId) },
    );
  }
}
