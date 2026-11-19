# Phase 3C controlled production deployment readiness

Date: 2026-11-19. No production migration, Railway resource, production record, credential rotation, Git push, ESP32 flash or physical activation was performed.

## Readiness result

The local release is prepared but production deployment is **not yet authorized or fully unblocked**. The command claim/persistence defect is corrected locally. Production schema validation is blocked by DNS resolution of the configured Supabase pooler. Railway account authentication succeeded, but the CLI then auto-updated into an incomplete 5.75.0 installation, so existing projects/services could not be inventoried. The broker also requires an approved Railway mechanism to materialize its five secret files; it intentionally fails closed without them.

Repository `main` began three commits ahead of `origin/main` at `ff03a60`. Phase 3C changes remain local until the final local commit and owner-approved push.

## Durable command lease correction

The gateway API now grants an atomic, UUID-bound lease while the command remains `PENDING`. A lease lasts at most 15 seconds and never exceeds command expiry. The bridge writes the complete command and lease to SQLite with `synchronous=FULL`, then confirms the exact gateway/command/lease tuple. The winning lease identity remains attached to the accepted command so a stale competing lease cannot use the idempotent retry path. Only confirmation changes the cloud command to `ACCEPTED`; only then may MQTT publication begin.

Restart behavior is explicit:

- before SQLite persistence: lease expires and the still-pending command can be leased again;
- after persistence but before confirmation: the durable `CLAIMED` record resumes confirmation;
- after acceptance but before publication: idempotent confirmation resumes the same durable record;
- during publication: restart changes `PUBLISHING` to `UNCERTAIN`, never automatic replay;
- gate and siren remain disabled until authoritative physical-state reconciliation is commissioned.

Validation passed: 15 web test files, bridge tests, bridge TypeScript/build, ESLint, diff checks, and the full migration chain plus controller validation on disposable PostgreSQL 17.10. This does not substitute for the missing production-schema restore test.

## Production database gate

Create a schema-only dump using `DIRECT_URL`, `pg_dump --schema-only --no-owner --no-privileges`, restore it into disposable PostgreSQL 17, apply `20261119150000_controller_management.sql` transactionally, run `tests/sql/controller-management-validation.sql`, and force a rollback failure test. Stop for any missing dependency, changed constraint/function signature, Alexa table loss, ownership mismatch, or privilege/RLS drift.

Immediately before an approved migration window, make a fresh custom-format full backup, encrypt it with AES-256-GCM or the approved organization backup system, verify restoration into a disposable database, store the encryption key separately with mode `0600`, and record hashes, timestamps and retention. The existing encrypted pre-Alexa backup is historical and is not the Phase 3C pre-migration backup.

The configured `DIRECT_URL` contains unescaped URL-reserved password characters. Do not rewrite or rotate it during this phase. Backup tooling must pass host, port, user and password separately without logging the password, or use a newly owner-approved correctly encoded connection variable.

## Railway deployment target

- Project: `nexora-iot`
- Environment: production
- Region for both services and volumes: EU West Metal, Amsterdam, `europe-west4-drams3a`
- `nexora-mqtt`: root `infrastructure/mosquitto`; volume `/mosquitto/data`; TLS 8883; public raw TCP proxy; anonymous disabled; generated exact per-controller ACLs
- `nexora-iot-bridge`: root `infrastructure/bridge`; volume `/data`; private MQTT DNS; HTTP readiness `/readyz`; persistent restart policy

Railway must first assign the public TCP proxy hostname and port. Create the CA offline:

1. Generate an encrypted private CA key and long-lived CA certificate on an offline host.
2. Generate a separate broker key and CSR whose SAN is `DNS:<exact Railway TCP hostname>`.
3. Sign a short-lived broker certificate with server authentication usage.
4. Verify chain and hostname with `openssl verify -CAfile mqtt-ca.pem -verify_hostname <hostname> mqtt-cert.pem`.
5. Upload only `mqtt-cert.pem`, `mqtt-key.pem` and `mqtt-ca.pem` through the approved broker secret bootstrap. Never upload the CA signing key.
6. Set bridge `MQTT_URL=mqtts://nexora-mqtt.railway.internal:8883` and `MQTT_TLS_SERVERNAME=<exact public TCP hostname>`; provision ESP32 clients with the public hostname, assigned port and public CA.
7. Inventory certificate serial, issue/expiry dates and owner; renew and test at least 30 days before expiry.

### Environment ownership

Vercel server only: existing `DATABASE_URL`, Supabase/Alexa variables, `IOT_GATEWAY_ID`, `IOT_GATEWAY_CREDENTIAL`. The configured gateway identity exists locally, but reuse must be verified against production without printing it.

Bridge only: `NEXORA_API_BASE_URL`, `NEXORA_GATEWAY_ID`, `NEXORA_GATEWAY_CREDENTIAL`, `MQTT_URL`, `MQTT_USERNAME`, `MQTT_PASSWORD`, `MQTT_CA_FILE`, `MQTT_TLS_SERVERNAME`, `BRIDGE_STORE_PATH`, `BRIDGE_POLL_INTERVAL_MS`, `BRIDGE_MAX_BACKOFF_MS`, `BRIDGE_HEALTH_PORT`, `PORT`, `BRIDGE_MAX_PAYLOAD_BYTES`, `BRIDGE_MAX_QUEUED_EVENTS`, `BRIDGE_EVENT_RETENTION_DAYS`, `RAILWAY_DEPLOYMENT_DRAINING_SECONDS`.

Broker secret files: `/run/secrets/mqtt-cert.pem`, `mqtt-key.pem`, `mqtt-ca.pem`, `controller-registry.json`, `mqtt-credentials.json`. The CA signing key, database credentials, gateway credential and Alexa credentials never belong in the broker or controller.

## Exact production order

1. Repair/reinstall the Railway CLI, authenticate, and inventory projects/services; reuse only a positively identified compatible resource.
2. Restore and validate the actual production schema snapshot.
3. Verify a fresh encrypted full backup by disposable restore.
4. Obtain the combined owner approvals below.
5. Apply the additive migration transactionally; verify columns, constraints, functions, RLS, revoked privileges and Alexa schema.
6. Push the reviewed commits to `main`; observe the Vercel deployment until production health and authenticated flows pass.
7. Create/configure the two Railway services and volumes in the specified region.
8. Assign the TCP proxy; create and verify the private CA/broker certificate; provision the broker secret files.
9. Deploy broker; externally verify hostname, chain, anonymous rejection, wrong credential rejection and exact ACL isolation.
10. Deploy bridge; verify `/readyz`, private MQTT with public TLS identity, authenticated Nexora sync, persistence and restart recovery.
11. Register `ctrl-aura-main-01` only with the real hardware identity and approved proof secret. Promote the selected existing account only after exact identity confirmation.
12. Commission only House 1 Light 1, House 1 Light 2 and fan. Add House 2 only after authorized ownership assignment. Keep gate and manual siren readiness disabled.

## Required owner approvals

Approve together, after the schema and Railway inventory blockers are cleared:

- create billable project `nexora-iot`, `nexora-mqtt`, `nexora-iot-bridge`, two volumes and TCP proxy in EU West Metal, with an initial $10–25/month budget and spending alert;
- create the fresh encrypted production backup and apply migration `20261119150000_controller_management.sql`;
- push the reviewed local commits to `main`, triggering Vercel;
- confirm the exact existing user identity to promote as `estate-aura` administrator;
- create `house-ae-2-block`, `ctrl-aura-main-01` and device associations only from reviewed real identities;
- provision new broker/controller credentials, without rotating the current production gateway credential;
- separately authorize ESP32 flashing and light/fan activation after the board identity and GPIO review.

## Cost and blockers

Current Railway pricing: Hobby minimum $5/month including $5 usage; Pro minimum $20 including $20 usage; RAM $10/GB-month, CPU $20/vCPU-month, volume $0.15/GB-month, egress $0.05/GB. For two low-traffic services, reserve $10–25/month until measured.

Remaining blockers: production Supabase DNS/snapshot; fresh backup/restore proof; broken Railway CLI and unknown existing project inventory; owner-approved Railway secret bootstrap; exact administrator identity; real ESP32 model/hardware identity; House 2 homeowner authorization; physical-state reconciliation for gate/siren. Host storage is also at 96% used with 8.9 GB free and should be cleaned safely before image builds.
