import { getSql } from "@/lib/cloud/db";
import { ACCESS_TOKEN_TTL_SECONDS, ALEXA_SCOPE, constantTimeSecretMatches, opaqueToken, parseBasicClient, tokenHash } from "@/lib/alexa/oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const oauthError = (error: string, status = 400) => Response.json({ error }, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(request: Request) {
  const form = new URLSearchParams(await request.text());
  const credentials = parseBasicClient(request, form);
  const expectedId = process.env.ALEXA_OAUTH_CLIENT_ID, expectedSecret = process.env.ALEXA_OAUTH_CLIENT_SECRET;
  if (!credentials || !expectedId || !expectedSecret || credentials.clientId !== expectedId || !constantTimeSecretMatches(credentials.clientSecret, expectedSecret)) return oauthError("invalid_client", 401);
  const sql = getSql();
  const grantType = form.get("grant_type");
  if (grantType === "authorization_code") {
    const code = form.get("code"), redirectUri = form.get("redirect_uri");
    if (!code || !redirectUri) return oauthError("invalid_request");
    const accessToken = opaqueToken(), refreshToken = opaqueToken();
    const rows = await sql.begin(async tx => {
      const codes = await tx`update smart_estate.oauth_authorization_code set consumed_at=now() where code_hash=${tokenHash(code)} and client_id=${expectedId} and redirect_uri=${redirectUri} and expires_at>now() and consumed_at is null returning user_id,grant_id,scopes`;
      if (!codes[0]) return [];
      await tx`insert into smart_estate.oauth_access_token(token_hash,grant_id,user_id,client_id,scopes,expires_at) values(${tokenHash(accessToken)},${codes[0].grant_id},${codes[0].user_id},${expectedId},${codes[0].scopes},now()+${ACCESS_TOKEN_TTL_SECONDS}*interval '1 second')`;
      await tx`insert into smart_estate.oauth_refresh_token(token_hash,grant_id,user_id,client_id,scopes,expires_at) values(${tokenHash(refreshToken)},${codes[0].grant_id},${codes[0].user_id},${expectedId},${codes[0].scopes},now()+interval '180 days')`;
      return codes;
    });
    return rows[0] ? Response.json({ token_type: "Bearer", access_token: accessToken, refresh_token: refreshToken, expires_in: ACCESS_TOKEN_TTL_SECONDS, scope: ALEXA_SCOPE }, { headers: { "Cache-Control": "no-store" } }) : oauthError("invalid_grant");
  }
  if (grantType === "refresh_token") {
    const rawRefresh = form.get("refresh_token");
    if (!rawRefresh) return oauthError("invalid_request");
    const accessToken = opaqueToken(), nextRefresh = opaqueToken();
    const rows = await sql.begin(async tx => {
      const tokens = await tx`update smart_estate.oauth_refresh_token r set revoked_at=now(),replaced_by_hash=${tokenHash(nextRefresh)} from smart_estate.oauth_grant g where r.token_hash=${tokenHash(rawRefresh)} and r.client_id=${expectedId} and r.expires_at>now() and r.revoked_at is null and g.id=r.grant_id and g.revoked_at is null returning r.grant_id,r.user_id,r.scopes`;
      if (!tokens[0]) return [];
      await tx`insert into smart_estate.oauth_access_token(token_hash,grant_id,user_id,client_id,scopes,expires_at) values(${tokenHash(accessToken)},${tokens[0].grant_id},${tokens[0].user_id},${expectedId},${tokens[0].scopes},now()+${ACCESS_TOKEN_TTL_SECONDS}*interval '1 second')`;
      await tx`insert into smart_estate.oauth_refresh_token(token_hash,grant_id,user_id,client_id,scopes,expires_at) values(${tokenHash(nextRefresh)},${tokens[0].grant_id},${tokens[0].user_id},${expectedId},${tokens[0].scopes},now()+interval '180 days')`;
      return tokens;
    });
    return rows[0] ? Response.json({ token_type: "Bearer", access_token: accessToken, refresh_token: nextRefresh, expires_in: ACCESS_TOKEN_TTL_SECONDS, scope: ALEXA_SCOPE }, { headers: { "Cache-Control": "no-store" } }) : oauthError("invalid_grant");
  }
  return oauthError("unsupported_grant_type");
}
