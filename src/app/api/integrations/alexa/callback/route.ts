import { NextResponse } from "next/server";
import { getSql } from "@/lib/cloud/db";
import { requireUser } from "@/lib/supabase/server";
import { AlexaApiError, appLinkConfig, decryptCredential, discoverAlexaEndpoints, enableAlexaSkill, encryptCredential, exchangeAmazonCode, stateHash } from "@/lib/alexa/app-linking";
import { hasAlexaEligibleControl, issueAlexaAuthorizationCode, revokeAlexaGrant, revokeOtherAlexaGrants } from "@/lib/alexa/grants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function finish(request: Request, result: string, returnPath = "/settings?integration=alexa") {
  const url = new URL(returnPath, request.url); url.searchParams.set("integration", "alexa"); url.searchParams.set("result", result);
  const response = NextResponse.redirect(url, 303); response.headers.set("Cache-Control", "no-store"); return response;
}

export async function GET(request: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.redirect(new URL("/login?next=/settings", request.url), 303);
  const params = new URL(request.url).searchParams;
  const state = params.get("state") ?? "";
  if (!state) return finish(request, "invalid_state");
  let config;
  try { config = appLinkConfig(); } catch { return finish(request, "unavailable"); }
  const sql = getSql();
  const rows = await sql`update smart_estate.alexa_link_transaction set consumed_at=now() where state_hash=${stateHash(state)} and user_id=${user.id}::uuid and consumed_at is null and expires_at>now() returning *`;
  const transaction = rows[0];
  if (!transaction) return finish(request, "invalid_state");
  const returnPath = String(transaction.return_path);
  if (params.get("error")) return finish(request, "cancelled", returnPath);
  if (!await hasAlexaEligibleControl(user.id)) return finish(request, "ineligible", returnPath);
  const amazonCode = params.get("code");
  if (!amazonCode) return finish(request, "amazon_error", returnPath);
  let grantId: string | undefined;
  try {
    const verifier = decryptCredential({ ciphertext: String(transaction.pkce_ciphertext), nonce: String(transaction.pkce_nonce), tag: String(transaction.pkce_tag), version: Number(transaction.encryption_version) }, config.encryptionKey, `alexa-link:${user.id}`);
    const amazon = await exchangeAmazonCode(config, amazonCode, verifier);
    const endpoints = await discoverAlexaEndpoints(amazon.accessToken);
    const issued = await issueAlexaAuthorizationCode(user.id, config.redirectUri); grantId = issued.grantId;
    const encrypted = amazon.refreshToken ? encryptCredential(amazon.refreshToken, config.encryptionKey, `alexa-refresh:${user.id}:${config.skillId}:${config.stage}`) : null;
    let endpoint = endpoints[0], enabled: Awaited<ReturnType<typeof enableAlexaSkill>> | undefined, lastFailure: unknown;
    await sql`insert into smart_estate.alexa_connection(user_id,oauth_grant_id,skill_id,skill_stage,api_endpoint,refresh_ciphertext,refresh_nonce,refresh_tag,encryption_version,state,last_error_code) values(${user.id}::uuid,${grantId}::uuid,${config.skillId},${config.stage},${endpoint},${encrypted?.ciphertext ?? null},${encrypted?.nonce ?? null},${encrypted?.tag ?? null},${encrypted?.version ?? 1},'verification_pending',null) on conflict(user_id,skill_id,skill_stage) do update set oauth_grant_id=excluded.oauth_grant_id,api_endpoint=excluded.api_endpoint,refresh_ciphertext=excluded.refresh_ciphertext,refresh_nonce=excluded.refresh_nonce,refresh_tag=excluded.refresh_tag,encryption_version=excluded.encryption_version,state='verification_pending',last_error_code=null,updated_at=now()`;
    for (const candidate of endpoints) { try { enabled = await enableAlexaSkill(config, candidate, amazon.accessToken, issued.code); endpoint = candidate; break; } catch (reason) { lastFailure = reason; if (!(reason instanceof AlexaApiError) || reason.code !== "incorrectEndpoint") break; } }
    if (!enabled) throw lastFailure ?? new Error("Alexa enablement failed");
    await sql`update smart_estate.alexa_connection set api_endpoint=${endpoint},updated_at=now() where user_id=${user.id}::uuid and skill_id=${config.skillId} and skill_stage=${config.stage}`;
    const connected = enabled.status === "ENABLED" && enabled.accountLink?.status === "LINKED";
    const pending = enabled.status === "ENABLING";
    if (!connected && !pending) { const amazonStatus = enabled.status ?? null, accountStatus = enabled.accountLink?.status ?? null; await revokeAlexaGrant(grantId); await sql`update smart_estate.alexa_connection set state='relink_required',amazon_status=${amazonStatus},account_link_status=${accountStatus},last_verified_at=now(),updated_at=now() where user_id=${user.id}::uuid and skill_id=${config.skillId} and skill_stage=${config.stage}`; return finish(request, "failed", returnPath); }
    const accountStatus = enabled.accountLink?.status ?? null, amazonStatus = enabled.status ?? null;
    await sql`update smart_estate.alexa_connection set state=${connected ? "connected" : "verification_pending"},amazon_status=${amazonStatus},account_link_status=${accountStatus},last_verified_at=now(),updated_at=now() where user_id=${user.id}::uuid and skill_id=${config.skillId} and skill_stage=${config.stage}`;
    if (connected) await revokeOtherAlexaGrants(user.id, grantId);
    return finish(request, connected ? "connected" : "pending", returnPath);
  } catch {
    if (grantId) {
      // The network outcome can be ambiguous after Amazon receives the code.
      // Keep it locally revoked and require reconciliation; never retry the code.
      await revokeAlexaGrant(grantId).catch(() => undefined);
      await sql`update smart_estate.alexa_connection set state='relink_required',last_error_code='LINKING_FAILED',updated_at=now() where user_id=${user.id}::uuid and skill_id=${config.skillId} and skill_stage=${config.stage}`.catch(() => undefined);
    }
    return finish(request, "failed", returnPath);
  }
}
