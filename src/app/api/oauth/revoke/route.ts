import { getSql } from "@/lib/cloud/db";
import { constantTimeSecretMatches, parseBasicClient, tokenHash } from "@/lib/alexa/oauth";

export const runtime = "nodejs";
export async function POST(request: Request) {
  const form = new URLSearchParams(await request.text());
  const credentials = parseBasicClient(request, form);
  const id = process.env.ALEXA_OAUTH_CLIENT_ID, secret = process.env.ALEXA_OAUTH_CLIENT_SECRET;
  if (!credentials || !id || !secret || credentials.clientId !== id || !constantTimeSecretMatches(credentials.clientSecret, secret)) return Response.json({ error: "invalid_client" }, { status: 401 });
  const token = form.get("token");
  if (token) {
    const sql = getSql(), hash = tokenHash(token);
    await sql.begin(async tx => {
      // RFC 7009 permits related credentials to be invalidated together. Revoke
      // the whole Alexa grant so an access token cannot outlive an unlink or a
      // revoked refresh token for up to its remaining fifteen-minute lifetime.
      const grants = await tx`select grant_id from smart_estate.oauth_access_token where token_hash=${hash} and client_id=${id} union select grant_id from smart_estate.oauth_refresh_token where token_hash=${hash} and client_id=${id}`;
      if (grants[0]) {
        const grantId = String(grants[0].grant_id);
        await tx`update smart_estate.oauth_grant set revoked_at=coalesce(revoked_at,now()) where id=${grantId}::uuid and client_id=${id}`;
        await tx`update smart_estate.oauth_access_token set revoked_at=coalesce(revoked_at,now()) where grant_id=${grantId}::uuid`;
        await tx`update smart_estate.oauth_refresh_token set revoked_at=coalesce(revoked_at,now()) where grant_id=${grantId}::uuid`;
      }
    });
  }
  return new Response(null, { status: 200, headers: { "Cache-Control": "no-store" } });
}
