import { NextResponse, type NextRequest } from "next/server";
import { claimCommands } from "@/lib/cloud/repository";
import { authenticateGateway } from "@/lib/cloud/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const gateway = authenticateGateway(request);
  if (!gateway) return NextResponse.json({ code: "UNAUTHORIZED", message: "Gateway authentication failed" }, { status: 401 });
  const requested = Number(request.nextUrl.searchParams.get("limit") || 20);
  const limit = Number.isInteger(requested) ? Math.min(100, Math.max(1, requested)) : 20;
  try { return NextResponse.json({ commands: await claimCommands(gateway.id, limit) }, { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { console.error("Gateway command claim failed", { message: error instanceof Error ? error.message : "unknown" }); return NextResponse.json({ code: "GATEWAY_UNAVAILABLE", message: "Command queue is unavailable" }, { status: 503 }); }
}

