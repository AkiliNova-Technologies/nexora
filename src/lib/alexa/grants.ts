import { getSql } from "@/lib/cloud/db";
import { ALEXA_SCOPE, AUTHORIZATION_CODE_TTL_SECONDS, opaqueToken, tokenHash } from "./oauth";

export async function issueAlexaAuthorizationCode(userId: string, redirectUri: string) {
  const clientId = process.env.ALEXA_OAUTH_CLIENT_ID;
  const appRedirect = process.env.ALEXA_APP_LINK_REDIRECT_URI;
  const traditionalRedirects = new Set((process.env.ALEXA_OAUTH_REDIRECT_URIS ?? "").split(",").map(value => value.trim()).filter(Boolean));
  if (!clientId || (!traditionalRedirects.has(redirectUri) && redirectUri !== appRedirect)) throw new Error("Alexa OAuth configuration is invalid");
  const code = opaqueToken();
  const sql = getSql();
  const rows = await sql.begin(async tx => {
    const grants = await tx`insert into smart_estate.oauth_grant(user_id,client_id,scopes) values(${userId}::uuid,${clientId},array[${ALEXA_SCOPE}]) returning id`;
    await tx`insert into smart_estate.oauth_authorization_code(code_hash,grant_id,user_id,client_id,redirect_uri,scopes,expires_at) values(${tokenHash(code)},${grants[0].id},${userId}::uuid,${clientId},${redirectUri},array[${ALEXA_SCOPE}],now()+${AUTHORIZATION_CODE_TTL_SECONDS}*interval '1 second')`;
    return grants;
  });
  return { code, grantId: String(rows[0].id) };
}

export async function revokeAlexaGrant(grantId: string) {
  const sql = getSql();
  await sql.begin(async tx => {
    await tx`update smart_estate.oauth_grant set revoked_at=coalesce(revoked_at,now()) where id=${grantId}::uuid`;
    await tx`update smart_estate.oauth_access_token set revoked_at=coalesce(revoked_at,now()) where grant_id=${grantId}::uuid`;
    await tx`update smart_estate.oauth_refresh_token set revoked_at=coalesce(revoked_at,now()) where grant_id=${grantId}::uuid`;
  });
}

export async function revokeOtherAlexaGrants(userId: string, activeGrantId: string) {
  const sql = getSql();
  const clientId = process.env.ALEXA_OAUTH_CLIENT_ID ?? "";
  await sql.begin(async tx => {
    const grants = await tx`update smart_estate.oauth_grant set revoked_at=coalesce(revoked_at,now()) where user_id=${userId}::uuid and client_id=${clientId} and id<>${activeGrantId}::uuid and revoked_at is null returning id`;
    for (const grant of grants) {
      await tx`update smart_estate.oauth_access_token set revoked_at=coalesce(revoked_at,now()) where grant_id=${grant.id}`;
      await tx`update smart_estate.oauth_refresh_token set revoked_at=coalesce(revoked_at,now()) where grant_id=${grant.id}`;
    }
  });
}
