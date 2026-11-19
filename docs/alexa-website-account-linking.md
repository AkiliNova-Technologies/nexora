# Nexora website-initiated Alexa account linking

## Architecture

The Settings integration starts a server-generated Login with Amazon (LWA)
authorization-code flow with PKCE. Nexora stores a hashed state and an encrypted
PKCE verifier for five minutes. After the authenticated homeowner returns,
Nexora atomically consumes the transaction, exchanges the Amazon code on the
server, discovers the customer's regional Alexa endpoint, issues a one-use
Nexora OAuth code, and calls the customer-facing Skill Enablement API.

The existing Alexa-initiated flow remains supported. Both paths use the same
Nexora OAuth grants, token endpoint, rotating refresh tokens, authorization
scope, directive service and device-control pipeline.

```text
Browser -> /api/integrations/alexa/connect -> Login with Amazon
Amazon  -> /api/integrations/alexa/callback -> LWA token endpoint
Nexora  -> Alexa regional Skill Enablement API
Alexa   -> /api/oauth/token -> Nexora access and refresh tokens
```

Only controllable lights and fans are eligible. Gates, alarms, sirens and
security controls remain excluded.

## Required configuration

In Alexa Developer Console, retain the existing Auth Code Grant configuration
for Nexora's authorization and token endpoints. Enable **Allow users to link
their account to your skill from within your application or website** and add:

```text
https://nexora-home.vercel.app/api/integrations/alexa/callback
```

The app-link client must be entitled to `alexa::skills:account_linking`. The
development-stage Amazon account must own the skill or be enrolled as a beta
tester. Keep **Send Alexa Events** disabled because discovery declares
`proactivelyReported: false`; this release intentionally does not fabricate an
`AcceptGrant` response.

Set these server-only Vercel variables without changing the existing OAuth,
endpoint-ID or Lambda secrets:

```dotenv
ALEXA_SKILL_ID=amzn1.ask.skill.d5bf4a71-5a8e-41b1-a44a-6387e5b41a47
ALEXA_SKILL_STAGE=development
ALEXA_APP_LINK_CLIENT_ID=<Alexa-provided app-link client ID>
ALEXA_APP_LINK_CLIENT_SECRET=<Alexa-provided app-link client secret>
ALEXA_APP_LINK_REDIRECT_URI=https://nexora-home.vercel.app/api/integrations/alexa/callback
ALEXA_APP_LINK_ENCRYPTION_KEY=<64 hexadecimal characters>
```

The app-link credentials are distinct from `ALEXA_OAUTH_CLIENT_ID` and
`ALEXA_OAUTH_CLIENT_SECRET`. Never prefix any of these values with
`NEXT_PUBLIC_`.

## Database migration

Review and apply `supabase/migrations/20261119120000_alexa_website_linking.sql`
through the established migration process. It creates only additive,
server-private tables:

- `smart_estate.alexa_link_transaction`
- `smart_estate.alexa_connection`

Both tables have RLS enabled and no browser-facing policies. Public, anonymous
and authenticated roles have all privileges revoked. Refresh credentials and
PKCE verifiers use AES-256-GCM with a unique nonce and authenticated context.

Production procedure:

1. Back up and identify the exact target Supabase project.
2. Review the migration and current migration status.
3. Apply the migration using the authorized direct/session database path.
4. Verify both tables, constraints, indexes, RLS and grants.
5. Set Vercel variables, then deploy the reviewed commit.
6. Do not apply the migration from an unlinked local checkout.

## Status and disconnect

The status endpoint distinguishes local OAuth authorization from Amazon's
enablement and account-link status. Amazon status is cached for 15 minutes; a
pending connection is checked sooner. Dashboard rendering does not call Amazon
on every request.

Disconnect revokes the local grant and every associated Nexora token first. It
then refreshes the Amazon credential and calls the regional DELETE enablement
operation. A failed remote operation remains `unlink_pending`; local access is
never restored automatically. Encrypted credentials are cleared only after a
confirmed remote unlink.

## Local verification

```bash
npm test
npx tsc --noEmit
npm run lint
npm run build
```

External Amazon requests are mocked by automated tests. A real acceptance test
requires an eligible Amazon developer/beta account:

1. Sign in to Nexora as a homeowner with a controllable light or fan.
2. Open Settings and select **Connect Amazon Alexa**.
3. Sign in and consent on the Amazon browser page.
4. Confirm return to Settings with a Connected state.
5. Confirm the development skill is enabled and linked in Alexa.
6. Run discovery and verify only authorized lights and fans appear.
7. Exercise one safe light/fan command and verify authoritative acknowledgement.
8. Disconnect in Nexora and verify the skill is disabled/unlinked at Amazon.

## Troubleshooting

- `unavailable`: a required server variable is missing or malformed.
- `already_connecting`: an unconsumed five-minute transaction already exists.
- `invalid_state`: state was missing, expired, owned by another user or replayed.
- `ineligible`: the Nexora user controls no eligible light or fan.
- HTTP 403 from enablement: verify app-link scope entitlement and development
  skill owner/beta eligibility; do not use standalone custom-skill enablement.
- `relink_required`: the enablement outcome failed or was ambiguous after code
  issuance. Start a new flow; the consumed code is never retried.
- `unlink_pending`: Nexora access is already revoked, but Amazon reconciliation
  must be retried after connectivity or credential recovery.

Sanitized errors are shown to users. Codes, tokens, raw Amazon responses,
client secrets and personally sensitive identifiers must never be logged.

## Rollback

Application rollback is safe because the migration is additive. Before dropping
tables, revoke all local Alexa grants, complete or document pending Amazon
unlinks, retain any required audit material, and confirm no connection depends
on encrypted refresh credentials. Do not drop the tables merely to roll back the
UI or routes.
