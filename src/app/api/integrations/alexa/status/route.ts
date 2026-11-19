import { getSql } from "@/lib/cloud/db";
import { requireUser } from "@/lib/supabase/server";
import { appLinkConfig, decryptCredential, disableAlexaSkill, encryptCredential, getAlexaStatus, refreshAmazonToken, STATUS_CACHE_SECONDS } from "@/lib/alexa/app-linking";
import { revokeAlexaGrant } from "@/lib/alexa/grants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const responseHeaders = { "Cache-Control": "no-store" };
type ConnectionRow = Record<string, unknown>;

function publicStatus(localGrant: boolean, row?: ConnectionRow) {
  const state = row ? String(row.state) : localGrant ? "connection_unavailable" : "not_connected";
  return { connected: localGrant && state === "connected" && row?.amazon_status === "ENABLED" && row?.account_link_status === "LINKED", state, localGrantActive: localGrant, amazonEnabled: row?.amazon_status === "ENABLED", amazonLinked: row?.account_link_status === "LINKED", connectedAt: row?.created_at ?? null, lastVerifiedAt: row?.last_verified_at ?? null, capabilities: ["Power control", "Device state", "Connectivity health"] };
}
async function encryptedRefresh(row: ConnectionRow, userId: string, config: ReturnType<typeof appLinkConfig>) {
  if (!row.refresh_ciphertext || !row.refresh_nonce || !row.refresh_tag) throw new Error("Amazon refresh credential is unavailable");
  return decryptCredential({ ciphertext: String(row.refresh_ciphertext), nonce: String(row.refresh_nonce), tag: String(row.refresh_tag), version: Number(row.encryption_version) }, config.encryptionKey, `alexa-refresh:${userId}:${config.skillId}:${config.stage}`);
}
async function persistReplacement(row: ConnectionRow, userId: string, config: ReturnType<typeof appLinkConfig>, refreshToken?: string) {
  if (!refreshToken) return;
  const value = encryptCredential(refreshToken, config.encryptionKey, `alexa-refresh:${userId}:${config.skillId}:${config.stage}`);
  const sql = getSql();
  await sql`update smart_estate.alexa_connection set refresh_ciphertext=${value.ciphertext},refresh_nonce=${value.nonce},refresh_tag=${value.tag},encryption_version=${value.version},updated_at=now() where id=${String(row.id)}::uuid`;
}

export async function GET() {
  const user = await requireUser();
  if (!user) return Response.json({ code: "UNAUTHENTICATED" }, { status: 401, headers: responseHeaders });
  const sql = getSql();
  const grantRows = await sql`select id,created_at from smart_estate.oauth_grant where user_id=${user.id}::uuid and client_id=${process.env.ALEXA_OAUTH_CLIENT_ID ?? ""} and revoked_at is null order by created_at desc limit 1`;
  let localGrantActive = Boolean(grantRows[0]);
  let config: ReturnType<typeof appLinkConfig>;
  try { config = appLinkConfig(); } catch { return Response.json({ ...publicStatus(localGrantActive), state: localGrantActive ? "connection_unavailable" : "not_connected" }, { headers: responseHeaders }); }
  const rows = await sql`select * from smart_estate.alexa_connection where user_id=${user.id}::uuid and skill_id=${config.skillId} and skill_stage=${config.stage} limit 1`;
  const row = rows[0] as ConnectionRow | undefined;
  if (!row) return Response.json(publicStatus(localGrantActive), { headers: responseHeaders });
  const verified = row.last_verified_at ? new Date(String(row.last_verified_at)).getTime() : 0;
  if (row.state === "verification_pending" || Date.now() - verified > STATUS_CACHE_SECONDS * 1000) {
    try {
      const refreshed = await refreshAmazonToken(config, await encryptedRefresh(row, user.id, config));
      await persistReplacement(row, user.id, config, refreshed.refreshToken);
      const remote = await getAlexaStatus(config, String(row.api_endpoint), refreshed.accessToken);
      const nextState = remote.status === "ENABLED" && remote.accountLink?.status === "LINKED" ? "connected" : remote.status === "ENABLING" ? "verification_pending" : "relink_required";
      if (nextState === "relink_required" && row.oauth_grant_id) { await revokeAlexaGrant(String(row.oauth_grant_id)); localGrantActive = false; }
      const amazonStatus = remote.status ?? null;
      await sql`update smart_estate.alexa_connection set state=${nextState},amazon_status=${amazonStatus},account_link_status=${remote.accountLink?.status ?? null},last_verified_at=now(),last_error_code=null,updated_at=now() where id=${String(row.id)}::uuid`;
      row.state = nextState; row.amazon_status = remote.status; row.account_link_status = remote.accountLink?.status ?? null; row.last_verified_at = new Date().toISOString();
    } catch { if (row.state === "verification_pending") row.state = "connection_unavailable"; }
  }
  return Response.json(publicStatus(localGrantActive, row), { headers: responseHeaders });
}

export async function DELETE(request: Request) {
  if (request.headers.get("sec-fetch-site") === "cross-site") return Response.json({ code: "CSRF_INVALID" }, { status: 403, headers: responseHeaders });
  const user = await requireUser();
  if (!user) return Response.json({ code: "UNAUTHENTICATED" }, { status: 401, headers: responseHeaders });
  const sql = getSql();
  await sql.begin(async tx => {
    const grants = await tx`update smart_estate.oauth_grant set revoked_at=coalesce(revoked_at,now()) where user_id=${user.id}::uuid and client_id=${process.env.ALEXA_OAUTH_CLIENT_ID ?? ""} returning id`;
    for (const grant of grants) { await tx`update smart_estate.oauth_access_token set revoked_at=coalesce(revoked_at,now()) where grant_id=${grant.id}`; await tx`update smart_estate.oauth_refresh_token set revoked_at=coalesce(revoked_at,now()) where grant_id=${grant.id}`; }
    await tx`update smart_estate.alexa_connection set state='unlink_pending',unlink_pending_since=coalesce(unlink_pending_since,now()),updated_at=now() where user_id=${user.id}::uuid`;
  });
  try {
    const config = appLinkConfig();
    const rows = await sql`select * from smart_estate.alexa_connection where user_id=${user.id}::uuid and skill_id=${config.skillId} and skill_stage=${config.stage} limit 1`;
    const row = rows[0] as ConnectionRow | undefined;
    if (row) {
      const refreshed = await refreshAmazonToken(config, await encryptedRefresh(row, user.id, config));
      await persistReplacement(row, user.id, config, refreshed.refreshToken);
      await disableAlexaSkill(config, String(row.api_endpoint), refreshed.accessToken);
      await sql`update smart_estate.alexa_connection set state='locally_revoked',refresh_ciphertext=null,refresh_nonce=null,refresh_tag=null,amazon_status='DISABLED',account_link_status='NOT_LINKED',last_verified_at=now(),unlink_pending_since=null,last_error_code=null,updated_at=now() where id=${String(row.id)}::uuid`;
      return new Response(null, { status: 204, headers: responseHeaders });
    }
  } catch { await sql`update smart_estate.alexa_connection set state='unlink_pending',last_error_code='REMOTE_UNLINK_PENDING',updated_at=now() where user_id=${user.id}::uuid`; return Response.json({ state: "unlink_pending" }, { status: 202, headers: responseHeaders }); }
  return new Response(null, { status: 204, headers: responseHeaders });
}
