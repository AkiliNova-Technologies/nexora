import { NextResponse } from "next/server";
import { getSql } from "@/lib/cloud/db";
import { requireUser } from "@/lib/supabase/server";
import { amazonAuthorizationUrl, appLinkConfig, encryptCredential, LINK_TRANSACTION_TTL_SECONDS, oauthState, pkceChallenge, pkceVerifier, stateHash, validatedReturnPath } from "@/lib/alexa/app-linking";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.redirect(new URL("/login?next=/settings", request.url), 303);
  let config;
  try { config = appLinkConfig(); }
  catch { return NextResponse.redirect(new URL("/settings?integration=alexa&result=unavailable", request.url), 303); }
  const sql = getSql();
  const eligible = await sql`select exists(select 1 from smart_estate.device d where d.type in ('LIGHT','FAN') and ((d.house_id is not null and smart_estate.can_control_house(${user.id}::uuid,d.house_id)) or (d.estate_id is not null and smart_estate.can_control_estate_device(${user.id}::uuid,d.estate_id,d.type)))) allowed`;
  if (!eligible[0]?.allowed) return NextResponse.redirect(new URL("/settings?integration=alexa&result=ineligible", request.url), 303);
  const existing = await sql`select 1 from smart_estate.alexa_connection where user_id=${user.id}::uuid and skill_id=${config.skillId} and skill_stage=${config.stage} and state in ('connected','verification_pending','unlink_pending') limit 1`;
  if (existing[0]) return NextResponse.redirect(new URL("/settings?integration=alexa&result=already_connected", request.url), 303);
  const state = oauthState(), verifier = pkceVerifier();
  const encrypted = encryptCredential(verifier, config.encryptionKey, `alexa-link:${user.id}`);
  const returnPath = validatedReturnPath(new URL(request.url).searchParams.get("return"));
  try {
    await sql.begin(async tx => {
      await tx`delete from smart_estate.alexa_link_transaction where expires_at<=now() or consumed_at is not null`;
      await tx`insert into smart_estate.alexa_link_transaction(user_id,state_hash,pkce_ciphertext,pkce_nonce,pkce_tag,encryption_version,return_path,expires_at) values(${user.id}::uuid,${stateHash(state)},${encrypted.ciphertext},${encrypted.nonce},${encrypted.tag},${encrypted.version},${returnPath},now()+${LINK_TRANSACTION_TTL_SECONDS}*interval '1 second')`;
    });
  } catch { return NextResponse.redirect(new URL("/settings?integration=alexa&result=already_connecting", request.url), 303); }
  const response = NextResponse.redirect(amazonAuthorizationUrl(config, state, pkceChallenge(verifier)), 303);
  response.headers.set("Cache-Control", "no-store");
  return response;
}
