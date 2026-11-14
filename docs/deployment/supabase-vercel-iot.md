# Existing Supabase, Vercel, and local IoT deployment

This guide uses one existing Supabase project. It never creates a project or replaces a database. Production database changes and Vercel changes require an explicit approval after inspection.

## 1. Local secret files

Keep secrets in `.env.local` (frontend) and `infrastructure/.env` (bridge). Both are ignored. Never place a service-role key, database URL, gateway credential, or MQTT password in a `NEXT_PUBLIC_` variable.

Frontend/cloud variables:

```dotenv
NEXT_PUBLIC_SMART_ESTATE_MODE=CLOUD
NEXT_PUBLIC_API_BASE_URL=/api/v1
NEXT_PUBLIC_SITE_URL=https://your-existing-vercel-domain.example
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
DATABASE_URL=
DIRECT_URL=
IOT_GATEWAY_ID=
IOT_GATEWAY_CREDENTIAL=
```

Use Supabase's shared transaction pooler for `DATABASE_URL`. Route handlers use one connection, TLS, and no prepared statements. Use the direct connection or session pooler for `DIRECT_URL` only during reviewed migration work. The frontend does not currently require `SUPABASE_SERVICE_ROLE_KEY`.

## 2. Read-only database inspection

Before any migration, verify the host/project reference without printing the URL:

```bash
psql "$DIRECT_URL" -X --set=ON_ERROR_STOP=1 --no-psqlrc \
  -c "select current_database(), current_user, version();" \
  -c "select nspname from pg_namespace order by 1;" \
  -c "select schemaname, tablename, tableowner from pg_tables order by 1,2;"
```

Then inspect only metadata for `smart_estate`, `public`, `auth`, migration history, RLS state, and policies. Do not use `db reset`, `db push`, destructive diffs, or a production write connection during inspection.

The proposed additive migration is in `supabase/migrations/`. Review it against the inventory. It creates a dedicated `smart_estate` schema, references existing `auth.users`, revokes Data API roles by default, enables RLS, and does not move or delete data. Do not apply it until the database target, conflicts, and grants have been reviewed and approval is explicit.

## 3. Provisioning after migration approval

Provision profiles, estate/house membership, gateway IDs, controller IDs, devices, and initial states with a separate reviewed seed script or transactional SQL. Never seed production with demo credentials. Use different gateway and MQTT credentials per estate/controller scope.

The cloud API authenticates users through Supabase Auth cookies. Authorization remains server-side in every SQL query. Browser clients cannot call gateway endpoints, and gateway events are accepted only when gateway, scope, and device match.

## 4. Vercel preparation

Link only to the existing project after confirming team and project names:

```bash
vercel link
vercel env ls
```

Configure public URL/key values as Config variables and database/gateway values as Secret variables, scoped separately for Development, Preview, and Production. Preview must not use production database or gateway credentials. Do not deploy merely to test configuration; run the local build first.

```bash
npm ci
npm test
npm run lint
npx tsc --noEmit --incremental false
npm run build
```

No MQTT client runs in Vercel. Route handlers perform short database transactions and the local bridge polls outbound over HTTPS.

## 5. Ubuntu Docker host

Install Docker Engine and the Compose plugin from Docker's official Ubuntu repository. Add the operator to the Docker group only if its root-equivalent access is understood. Copy the `infrastructure/` directory from the backend repository, configure its ignored `.env`, restrict TCP 1883 to the controller LAN/VLAN, then use the commands in its README.

## 6. ESP32 configuration

Copy `include/config.example.h` to ignored `include/config.h`. Configure the broker's `.local` hostname or estate LAN address, controller-specific username/password, client ID, house/estate IDs, and registered device IDs. Keep relay, fan, siren, strip, gate-limit, ultrasonic, and PIR verification flags false until wiring and polarity are physically confirmed.

Build without flashing:

```bash
pio run
pio test -e native
```

Flashing and physical actuation require separate authorization and an attended safety check.

## 7. End-to-end verification

1. Sign in through Supabase Auth and confirm only assigned houses appear.
2. Submit a harmless simulated light command and observe `PENDING`, then `ACCEPTED` after bridge claim.
3. Confirm MQTT delivery to the expected scoped topic.
4. Publish a mock controller acknowledgement using the original envelope.
5. Confirm the command becomes `EXECUTED` only after that acknowledgement and reported state updates.
6. Repeat an event ID and verify it is ignored idempotently.
7. Submit an expired command and verify local rejection.
8. Disconnect internet, publish state/events, reconnect, and verify the persistent queue drains.
9. Verify a user from another house receives not-found/denied results.
10. For a gate, confirm an uncertain outcome is never blindly replayed and physical position remains `UNVERIFIED`.

## Backup and recovery

Use the existing Supabase project's supported backup/export process. Test restores into an authorized non-production target only. Back up the bridge state volume before host replacement; preserve it to retain event and command deduplication history. Back up Mosquitto persistence and credential/ACL source securely, never in Git.

## Manual approval gates

- Provide existing Supabase public configuration, pooled `DATABASE_URL`, and direct/session `DIRECT_URL` through ignored environment files or an approved secret channel.
- Authorize read-only database metadata inspection.
- Review and explicitly authorize any production migration.
- Confirm the existing Vercel team/project before environment changes or deployment.
- Supply verified House 2, fan, ultrasonic, siren, perimeter strip, PIR, and gate electrical mappings.
- Authorize any firmware flash or physical actuator test separately.

