import { NextResponse, type NextRequest } from "next/server";
import { confirmCommandLease, leaseCommands } from "@/lib/cloud/repository";
import { authenticateGateway } from "@/lib/cloud/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const gateway = authenticateGateway(request);
  if (!gateway) return NextResponse.json({ code: "UNAUTHORIZED", message: "Gateway authentication failed" }, { status: 401 });
  const requested = Number(request.nextUrl.searchParams.get("limit") || 20);
  const limit = Number.isInteger(requested) ? Math.min(100, Math.max(1, requested)) : 20;
  try { return NextResponse.json({ commands: await leaseCommands(gateway.id, limit) }, { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { console.error("Gateway command lease failed", { message: error instanceof Error ? error.message : "unknown" }); return NextResponse.json({ code: "GATEWAY_UNAVAILABLE", message: "Command queue is unavailable" }, { status: 503 }); }
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest) {
  const gateway = authenticateGateway(request);
  if (!gateway) return NextResponse.json({ code: "UNAUTHORIZED", message: "Gateway authentication failed" }, { status: 401 });
  const body = await request.json().catch(() => null) as { commandId?: unknown; leaseId?: unknown } | null;
  if (!body || typeof body.commandId !== "string" || typeof body.leaseId !== "string" || !uuidPattern.test(body.commandId) || !uuidPattern.test(body.leaseId)) return NextResponse.json({ code: "INVALID_CONFIRMATION", message: "A valid command and lease identity are required" }, { status: 400 });
  try {
    const confirmed = await confirmCommandLease(gateway.id, body.commandId, body.leaseId);
    return confirmed ? NextResponse.json({ confirmed: true }) : NextResponse.json({ code: "LEASE_REJECTED", message: "The command lease is invalid or expired" }, { status: 409 });
  } catch (error) {
    console.error("Gateway command confirmation failed", { message: error instanceof Error ? error.message : "unknown" });
    return NextResponse.json({ code: "GATEWAY_UNAVAILABLE", message: "Command queue is unavailable" }, { status: 503 });
  }
}
