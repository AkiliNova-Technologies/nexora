import { NextResponse, type NextRequest } from "next/server";
import { ingestEvents } from "@/lib/cloud/repository";
import { authenticateGateway } from "@/lib/cloud/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const gateway = authenticateGateway(request);
  if (!gateway) return NextResponse.json({ code: "UNAUTHORIZED", message: "Gateway authentication failed" }, { status: 401 });
  let payload: unknown;
  try { payload = await request.json(); } catch { return NextResponse.json({ code: "INVALID_JSON", message: "A JSON body is required" }, { status: 400 }); }
  const events = payload && typeof payload === "object" && Array.isArray((payload as { events?: unknown }).events) ? (payload as { events: never[] }).events : null;
  if (!events || events.length > 50) return NextResponse.json({ code: "INVALID_EVENTS", message: "Provide no more than 50 events" }, { status: 400 });
  try { return NextResponse.json({ acceptedEventIds: await ingestEvents(gateway.id, events) }); }
  catch (error) { console.error("Gateway event ingest failed", { message: error instanceof Error ? error.message : "unknown" }); return NextResponse.json({ code: "GATEWAY_UNAVAILABLE", message: "Event ingest is unavailable" }, { status: 503 }); }
}

