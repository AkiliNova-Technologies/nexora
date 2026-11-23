import { NextResponse, type NextRequest } from "next/server";
import { getSql } from "@/lib/cloud/db";
import { requireUser } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const headers = { "Cache-Control": "no-store" };

async function authorizedEstate(estateId: string, userId: string) {
  const sql = getSql();
  const rows = await sql`select e.id from smart_estate.estate e where e.id=${estateId} and exists(select 1 from smart_estate.estate_admin a where a.estate_id=e.id and a.user_id=${userId}::uuid and a.active) limit 1`;
  return Boolean(rows[0]);
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ estateId: string }> }) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ code: "UNAUTHENTICATED" }, { status: 401, headers });
  const { estateId } = await params;
  if (!await authorizedEstate(estateId, user.id)) return NextResponse.json({ code: "ESTATE_NOT_FOUND" }, { status: 404, headers });
  const sql = getSql();
  const rows = await sql`select mode,version,updated_at from smart_estate.security_mode_sync where scope_type='ESTATE' and scope_id=${estateId} limit 1`;
  const row = rows[0];
  return NextResponse.json({ estateId, mode: row?.mode ?? "DISARMED", version: Number(row?.version ?? 0), updatedAt: row?.updated_at ?? null }, { headers });
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ estateId: string }> }) {
  const origin = request.headers.get("origin");
  const expectedOrigin = process.env.NEXT_PUBLIC_SITE_URL ? new URL(process.env.NEXT_PUBLIC_SITE_URL).origin : null;
  if (request.headers.get("sec-fetch-site") === "cross-site" || (origin && expectedOrigin && origin !== expectedOrigin)) {
    return NextResponse.json({ code: "CSRF_INVALID" }, { status: 403, headers });
  }
  const user = await requireUser();
  if (!user) return NextResponse.json({ code: "UNAUTHENTICATED" }, { status: 401, headers });
  const { estateId } = await params;
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ code: "INVALID_JSON" }, { status: 400, headers }); }
  const input = body && typeof body === "object" ? body as Record<string, unknown> : {};
  const mode = input.mode;
  const expectedVersion = input.expectedVersion;
  const clientRequestId = input.clientRequestId;
  if ((mode !== "ARMED" && mode !== "DISARMED") || !Number.isSafeInteger(expectedVersion) || Number(expectedVersion) < 0 || typeof clientRequestId !== "string" || !uuidPattern.test(clientRequestId)) {
    return NextResponse.json({ code: "INVALID_SECURITY_MODE", message: "A valid perimeter mode, expected version, and request ID are required" }, { status: 400, headers });
  }

  const sql = getSql();
  try {
    const result = await sql.begin(async tx => {
      const allowed = await tx`select e.id from smart_estate.estate e where e.id=${estateId} and exists(select 1 from smart_estate.estate_admin a where a.estate_id=e.id and a.user_id=${user.id}::uuid and a.active) for update`;
      if (!allowed[0]) return { kind: "not_found" as const };
      await tx`insert into smart_estate.security_mode_sync(scope_type,scope_id,mode,version,updated_at) values('ESTATE',${estateId},'DISARMED',0,now()) on conflict(scope_type,scope_id) do nothing`;
      const currentRows = await tx`select mode,version,updated_at from smart_estate.security_mode_sync where scope_type='ESTATE' and scope_id=${estateId} for update`;
      const current = currentRows[0];
      const prior = await tx`select details from smart_estate.audit_record where actor_id=${user.id}::uuid and estate_id=${estateId} and resource_type='estate_security_mode' and resource_id=${estateId} and details->>'clientRequestId'=${clientRequestId} limit 1`;
      if (prior[0]) {
        const details = prior[0].details as Record<string, unknown>;
        if (details.mode !== mode || Number(details.expectedVersion) !== Number(expectedVersion)) return { kind: "idempotency_conflict" as const, current };
        return { kind: "ok" as const, mode: String(details.mode), version: Number(details.version), updatedAt: current.updated_at };
      }
      if (Number(current.version) !== Number(expectedVersion)) return { kind: "version_conflict" as const, current };
      if (current.mode === mode) return { kind: "ok" as const, mode: String(current.mode), version: Number(current.version), updatedAt: current.updated_at };
      const nextVersion = Number(current.version) + 1;
      const updated = await tx`update smart_estate.security_mode_sync set mode=${mode},version=${nextVersion},updated_at=now() where scope_type='ESTATE' and scope_id=${estateId} returning mode,version,updated_at`;
      await tx`insert into smart_estate.audit_record(id,actor_id,house_id,estate_id,action,resource_type,resource_id,details) values(gen_random_uuid(),${user.id}::uuid,null,${estateId},'ESTATE_PERIMETER_SECURITY_MODE_CHANGED','estate_security_mode',${estateId},${tx.json({ mode, previousMode: current.mode, expectedVersion: Number(expectedVersion), version: nextVersion, clientRequestId })})`;
      return { kind: "ok" as const, mode: String(updated[0].mode), version: Number(updated[0].version), updatedAt: updated[0].updated_at };
    });
    if (result.kind === "not_found") return NextResponse.json({ code: "ESTATE_NOT_FOUND" }, { status: 404, headers });
    if (result.kind === "idempotency_conflict") return NextResponse.json({ code: "SECURITY_MODE_IDEMPOTENCY_CONFLICT", message: "Request ID was already used for a different perimeter mode change" }, { status: 409, headers });
    if (result.kind === "version_conflict") return NextResponse.json({ code: "SECURITY_MODE_VERSION_CONFLICT", message: "Perimeter mode changed; reload the authoritative state", current: { mode: result.current.mode, version: Number(result.current.version) } }, { status: 409, headers });
    return NextResponse.json({ estateId, mode: result.mode, version: result.version, updatedAt: result.updatedAt }, { headers });
  } catch (error) {
    console.error("Estate perimeter security mode update failed", { estateId, message: error instanceof Error ? error.message : "unknown" });
    return NextResponse.json({ code: "SECURITY_MODE_UNAVAILABLE", message: "Perimeter security mode is unavailable" }, { status: 503, headers });
  }
}
