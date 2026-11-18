# Nexora Amazon Alexa Smart Home — Phase 1 deployment

## Architecture and audit

`Alexa → nexora-alexa-smart-home Lambda → signed HTTPS request → Nexora API → OAuth validation → current authorization → existing command queue → gateway/MQTT → ESP32 acknowledgement`

The browser assistant is unchanged. The existing adapter already filtered discovery to lights/fans, excluded gates, translated power directives, and refused success for pending commands. Phase 1 adds `ReportState`, opaque endpoint IDs, replay protection, account linking, production API/Lambda wiring, and real settings state. It reuses the existing PostgreSQL registry, `can_view_*`/`can_control_*` permission functions, command queue, gateway events, and acknowledgements.

Supported devices are registered `LIGHT` and `FAN` devices with POWER capability and effective COMMAND permission. Authorized estate perimeter lights work when `can_manage_perimeter_lighting` is true. Gate movement, locks, cameras, security modes, alarms, and sirens are excluded.

## Account linking configuration

- Authorization URI: `https://nexora-home.vercel.app/oauth/authorize`
- Access token URI: `https://nexora-home.vercel.app/api/oauth/token`
- Revocation URI: `https://nexora-home.vercel.app/api/oauth/revoke`
- Scope: `alexa:smart_home`
- Grant: authorization code with rotating refresh tokens
- Client authentication: HTTP Basic (`client_secret_basic`); body credentials are also accepted for Alexa compatibility
- Access-token lifetime: 15 minutes
- Authorization-code lifetime: 5 minutes, exact redirect binding and atomic single use

Use a random client ID and high-entropy secret in Vercel and the Alexa console. After saving account linking, Amazon displays redirect URLs. Copy every URL exactly, comma-separated, into `ALEXA_OAUTH_REDIRECT_URIS`. Wildcards are not accepted.

Application environment:

```text
ALEXA_OAUTH_CLIENT_ID=nexora-alexa-smart-home
ALEXA_OAUTH_CLIENT_SECRET=<confidential secret>
ALEXA_OAUTH_REDIRECT_URIS=https://pitangui.amazon.com/api/skill/link/M2QRTV3Z09QOTN,https://alexa.amazon.co.jp/api/skill/link/M2QRTV3Z09QOTN,https://layla.amazon.com/api/skill/link/M2QRTV3Z09QOTN
ALEXA_ENDPOINT_ID_SECRET=<stable independent random value, 32+ characters>
ALEXA_LAMBDA_SHARED_SECRET=<independent random value, 32+ characters>
```

Changing `ALEXA_ENDPOINT_ID_SECRET` changes endpoint IDs and forces rediscovery. Never prefix these with `NEXT_PUBLIC_`.

## Lambda upload

The dependency-free upload source is in `integrations/alexa-lambda`. Build the archive from that directory:

```bash
zip -j nexora-alexa-smart-home.zip index.mjs package.json
```

Upload it to the existing `nexora-alexa-smart-home` function in `us-east-1`, select Node.js 22 and handler `index.handler`, set the Lambda execution timeout to 8 seconds, and retain the Alexa Skills Kit trigger restricted to `amzn1.ask.skill.d5bf4a71-5a8e-41b1-a44a-6387e5b41a47`. Do not enable a Function URL.

Lambda environment:

```text
NEXORA_ALEXA_API_URL=https://nexora-home.vercel.app/api/integrations/alexa/directives
NEXORA_ALEXA_SHARED_SECRET=<exactly ALEXA_LAMBDA_SHARED_SECRET>
NEXORA_ALEXA_TIMEOUT_MS=7000
```

## Migration and deployment order

1. Review and apply `supabase/migrations/20261118120000_alexa_oauth.sql` using the established migration process.
2. Configure the application environment values and deploy Nexora.
3. Upload/configure the Lambda package.
4. Configure Alexa account linking with the endpoints above.
5. Copy Amazon's exact redirect URLs into the application environment and redeploy configuration.
6. Enable the skill, consent, discover devices, and test in the Alexa simulator before physical-device testing.

The migration adds only OAuth grants, hashed codes/tokens, and replay IDs. Browser roles receive no grants. Raw credentials are not stored. Grant revocation invalidates access immediately. The service rechecks permissions per request and reports success only after the existing command record reaches `EXECUTED`.

Before applying, take a restorable Supabase backup and verify that none of the five target table names already exists. Although the migration uses `if not exists`, a partially existing table would be skipped and might not have the reviewed constraints. Apply with a direct/session migration connection, never the transaction pooler runtime URL.

Routine retention can delete expired/consumed rows without affecting active grants:

```sql
delete from smart_estate.alexa_directive where expires_at <= now();
delete from smart_estate.oauth_authorization_code where expires_at <= now() or consumed_at < now() - interval '1 day';
delete from smart_estate.oauth_access_token where expires_at < now() - interval '1 day' or revoked_at < now() - interval '1 day';
delete from smart_estate.oauth_refresh_token where expires_at < now() - interval '7 days' or revoked_at < now() - interval '7 days';
```

For rollback before account linking is enabled, drop the new tables in dependency order: `oauth_access_token`, `oauth_refresh_token`, `oauth_authorization_code`, `alexa_directive`, then `oauth_grant`. After users have linked accounts, first revoke all active grants, disable account linking/Lambda traffic, retain an audit/export if required, and only then drop these tables. Rolling the schema back invalidates every Alexa link and requires relinking after reinstallation.

No AWS resource, production deployment, migration, MQTT ACL, firmware, GPIO assignment, or physical device is changed automatically.
