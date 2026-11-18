import { requireUser } from "@/lib/supabase/server";
import { getSql } from "@/lib/cloud/db";

export const dynamic = "force-dynamic";
export async function GET() {
  const user = await requireUser();
  if (!user) return Response.json({ code: "UNAUTHENTICATED" }, { status: 401 });
  const sql = getSql();
  const rows = await sql`select id,created_at from smart_estate.oauth_grant where user_id=${user.id}::uuid and client_id=${process.env.ALEXA_OAUTH_CLIENT_ID ?? ""} and revoked_at is null order by created_at desc limit 1`;
  return Response.json({ connected: Boolean(rows[0]), connectedAt: rows[0]?.created_at ?? null, capabilities: ["Power control", "Device state", "Connectivity health"] }, { headers: { "Cache-Control": "no-store" } });
}
export async function DELETE(request: Request) {
  if (request.headers.get("sec-fetch-site") === "cross-site") return Response.json({ code: "CSRF_INVALID" }, { status: 403 });
  const user = await requireUser();
  if (!user) return Response.json({ code: "UNAUTHENTICATED" }, { status: 401 });
  const sql = getSql();
  await sql`update smart_estate.oauth_grant set revoked_at=coalesce(revoked_at,now()) where user_id=${user.id}::uuid and client_id=${process.env.ALEXA_OAUTH_CLIENT_ID ?? ""}`;
  return new Response(null, { status: 204 });
}
