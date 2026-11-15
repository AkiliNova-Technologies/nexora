# Smart Estate deployment and infrastructure audit

Audit date: 2026-11-15 (Africa/Kampala)

Repository: `AkiliNova-Technologies/nexora`, branch `main`, audited commit `2110597`
Method: source review, local build/tests, read-only Supabase metadata queries, and unauthenticated production HTTP probes. No deployment, migration, record change, broker change, or firmware flash was performed.

## 1. Executive summary

The public Vercel application is online, but the deployed Smart Estate system is **not production-ready**. The confirmed login-path blocker is the production Vercel function's inability to connect to PostgreSQL: `GET https://nexora-home.vercel.app/api/health/database` returned HTTP 503 with `{"status":"unavailable","code":"CONNECTION_FAILED"}`. The same configured Supabase pooled database was reachable from this workspace with a read-only query in about six seconds, proving the project is active and ranking a missing, stale, incorrectly scoped, or malformed Vercel `DATABASE_URL` above a Supabase outage.

Production login does not traverse Railway. In `CLOUD` mode the browser calls Supabase Auth directly, then calls same-origin Vercel route handlers for `/api/v1/me` and `/api/v1/houses`. Authentication may therefore succeed while the UI remains on “Signing in…” until the post-authentication database requests fail. The client has a 30-second request timeout, so the symptom can appear as a long login.

The Supabase `smart_estate` schema exists and has RLS enabled on all 14 application tables. It currently contains one profile, one house, no devices, and no device commands. Thus even after database connectivity is repaired, device control and Nexora physical commands cannot work until device/gateway inventory is provisioned. No migration history table is present, so applied-schema provenance cannot be verified from Supabase migration records.

No Railway deployment, MQTT broker/bridge, Docker configuration, or ESP32 firmware exists in the visible repository. The Railway CLI is installed but this checkout is unlinked and its session could not refresh. Gateway credentials are empty locally. MQTT and hardware operation are therefore unverified, and end-to-end device control is blocked.

## 2. Deployment inventory

| Service | Provider / runtime | Actual status | Repository / branch | Connectivity and blockers |
|---|---|---|---|---|
| Web UI | Vercel; Next.js 16.2.4, React 19.2.4, Node.js route handlers | Public pages online | This repository, intended `main`; live commit not independently verified | `/` and `/login` returned 200. Production env/build metadata and logs were inaccessible. |
| Cloud API | Vercel route handlers in the same deployment | Online but database-dependent routes blocked | `src/app/api/*` at local commit `2110597` | Unauthenticated `/api/v1/me` correctly returned 401; database health returned 503. |
| Alleged Railway backend | Railway | **No evidence of a deployed service in this checkout** | No Railway config, link, service, domain, build/start command, or backend source present | CLI says “No linked project found”; OAuth refresh also failed. Railway is not used by the configured `CLOUD` login flow. |
| Supabase Auth | Supabase project ref `vtvtpmiwouvurhhyzpqg` | Reachable; credentialed login not tested | Browser/server Supabase SSR clients | Auth health endpoint responded; 401 without an API key is expected. No real password was requested. |
| PostgreSQL | Existing Supabase Postgres 17.11, EU West pooler | Reachable from workspace, unreachable from deployed Vercel function | `smart_estate` schema | Production `DATABASE_URL` configuration is the confirmed operational blocker. |
| MQTT / bridge | Unknown/local design only | Not verified / implementation absent here | No infrastructure directory or Compose/Mosquitto files | Gateway env vars empty; no broker address, TLS, ACL, or bridge runtime evidence. |
| ESP32 firmware | Not present | Not verified | No firmware/platformio project in this repository | GPIO, compile, hardware, and topic behavior cannot be audited from available files. |
| Nexora AI | Browser component | UI and parser implemented; production actuation blocked | `src/components/nexora-ai`, `src/lib/nexora-ai` | Uses authorized in-memory inventory and API command path; database has zero devices and no gateway is configured. |

There is one visible repository and one deployable Next.js boundary. The README still describes a separate Spring Boot backend, but that backend is not present. The implemented cloud architecture moved the API into Vercel route handlers. No `vercel.json`, `.vercel/project.json`, Railway config, Dockerfile, Compose file, or CI workflow is checked in.

## 3. Authentication investigation

### Actual flow

```text
Login form (`src/app/login/page.tsx:20`)
  -> Supabase browser `signInWithPassword` (`device-state-provider.tsx:141-147`)
  -> Supabase Auth session stored by @supabase/ssr browser cookies
  -> parallel GET /api/v1/me + /api/v1/houses (`device-state-provider.tsx:66-70`)
  -> Vercel route handler validates JWT claims (`supabase/server.ts:48-54`)
  -> Vercel connects to pooled Supabase Postgres (`cloud/db.ts:5-16`)
  -> profile and authorized houses (`cloud/repository.ts:8-17`)
  -> dashboard; house detail loads asynchronously
```

Railway is not in this path.

### Symptoms and reproduction

1. Open the production login page (confirmed HTTP 200).
2. Submit valid credentials. The button remains “Signing in…” while `login()` awaits `loadAccount()`.
3. `loadAccount()` concurrently calls `/api/v1/me` and `/api/v1/houses`.
4. Those handlers require PostgreSQL. The production database health probe currently returns HTTP 503 `CONNECTION_FAILED`.
5. The API client allows up to 30 seconds before reporting “The backend did not respond in time” (`api/client.ts:111-132`).

No credentialed browser trace was taken because no test credentials were available and real passwords were explicitly out of scope. The exact authenticated failing request is therefore inferred from the confirmed database-health failure and source flow; the broken boundary itself (Vercel function -> PostgreSQL) is confirmed.

### Root cause and ranked hypotheses

1. **Confirmed boundary:** Vercel production functions cannot connect to PostgreSQL.
2. **Most likely cause:** production `DATABASE_URL` is missing, stale, scoped to Preview/Development only, or differs from the known-working local pooled URL. The health endpoint returned generic `CONNECTION_FAILED`, not the explicit `NOT_CONFIGURED`, `AUTHENTICATION_FAILED`, or DNS codes.
3. **Less likely:** transient Vercel-to-pooler network failure or an incorrectly encoded password/connection URI. The local `postgres` driver succeeds, while `psql` rejected `DIRECT_URL` because a password character was interpreted as part of the hostname; this is evidence that connection-string encoding should be checked, but it does not prove Vercel has the same value.
4. **Not supported by evidence:** paused/inactive Supabase project. A live read-only database query succeeded.

Minimal correction: compare only the host, port, database, username, length/hash, and environment scope of Vercel Production `DATABASE_URL` with the working transaction-pooler connection; correct it as a Vercel Secret and redeploy once. Do not expose the value in logs. Then require database health 200 and a credentialed `/api/v1/me` + `/api/v1/houses` trace. This issue blocks deployment approval.

The latest three commits (`ecadd12`, `64be1d9`, `2110597`) changed cloud login, browser session authentication, and race prevention. Source now avoids the earlier API-cookie race by authenticating directly in the browser. Whether production runs `2110597` could not be verified without Vercel project access.

## 4. Frontend audit

- Framework: Next.js 16.2.4 App Router/Turbopack with React 19.2.4. Production build succeeded.
- Production URL: `https://nexora-home.vercel.app`; root and login returned 200 in 0.75s and 0.48s respectively during the probe.
- Local production-intended settings are `CLOUD`, same-origin `/api/v1`, the production site URL, and the existing Supabase project. All `NEXT_PUBLIC_*` values are build-time inlined; a dashboard env change requires a new deployment.
- Route protection is client-side in `SessionGuard` (`session-guard.tsx:8-27`) plus API-side authentication. The proxy refreshes Supabase claims/cookies on every matched route (`proxy.ts:1-5`, `supabase/proxy.ts:4-20`). No redirect loop is evident in source.
- The login form always routes to the dashboard only after `loadAccount()` completes. This correctly prevents a false success but amplifies database latency into perceived login latency.
- Cloud state uses 4-second polling (`device-state-provider.tsx:118-135`), not SSE. Backend mode alone uses EventSource/SSE. No WebSocket implementation exists.
- Browser console/network capture, exact Vercel env inventory, production commit, deployment logs, and account usage were unavailable. Deployment ownership/link metadata is not checked in.
- No localhost is used when mode is `CLOUD`; localhost defaults remain intentionally present for `BACKEND` development mode (`api/client.ts:44-49`, `.env.example:1-7`).

## 5. Backend audit

The deployed backend is the Vercel Node.js route layer, not a verified Railway Spring service. Routes are:

- `GET /api/health/database`
- `GET/POST/PUT /api/v1/[...path]` for auth compatibility, profile, houses, estates, rooms, devices/state, dashboard, sync, security, gate, and command operations
- `GET /api/v1/csrf`
- `GET /api/iot/v1/commands` and `POST /api/iot/v1/events`
- `GET /auth/confirm`

The handlers use the platform-provided Node runtime and require no explicit host/port binding. There is no long-running worker in Vercel. IoT is designed as outbound HTTPS polling from a local bridge, which is appropriate for serverless functions, but that bridge is absent/unverified.

No Railway build command, start command, port, domain, health check, restart policy, logs, resource usage, branch, or deployed commit could be collected. The repository has no Railway deployment boundary to audit. Treat any claimed Railway deployment as a separate, missing artifact until a project ID/service and repository are supplied.

## 6. Database audit

Read-only inspection confirmed PostgreSQL 17.11 and schemas `auth`, `public`, and `smart_estate`. The application schema has 14 expected tables: profile, estate, house, house_access, estate_member, room, device, device_state, device_command, gateway_event, house_security_state, security_sensor_policy, security_event, and audit_record.

RLS is enabled on every application table. Eleven owner/member SELECT policies exist; browser roles have no direct grants per migration lines 167-209. The Vercel server connects as database user `postgres`, which bypasses RLS, so tenant protection ultimately depends on every server query retaining its ownership predicates. Reviewed house/device/security queries consistently call `can_view_house`, `can_control_house`, or estate permission functions. A negative cross-tenant live test was blocked by the absence of a second test user and authorization to create data.

Aggregate inventory: 1 profile, 1 house, 0 devices, 0 commands. No user data or secret values were printed. There is no `supabase_migrations.schema_migrations` relation; migration drift/provenance is therefore not recorded even though the schema matches the checked-in migration at a high level. A full column/index/function diff was not run after the missing history was found; run the commands below before any schema change.

The pooled runtime client uses `max: 1`, TLS, disabled prepared statements, a 10-second connect timeout, and a 20-second idle timeout (`cloud/db.ts:5-15`), which is appropriate for a transaction pooler. The direct/session URL is not used by application code.

## 7. IoT infrastructure audit

Status: **local-development design only / not verified**.

- No broker host, port, Mosquitto config, password file, ACL, TLS cert, retained-message policy, Docker Compose file, or bridge source exists here.
- Local gateway ID and credential are unset. The API fails closed when either is missing (`cloud/security.ts:10-17`).
- The cloud API supports polling/claiming commands and idempotent event ingestion. It verifies the gateway ID/credential with constant-time hashes and checks device/gateway scope in SQL.
- MQTT topic/QoS/ack conventions exist only in documentation. No live broker connection, command acknowledgement, state report, reconnect, offline queue, or Railway persistent client was tested.
- No evidence supports a cloud-to-private-LAN path. The documented design avoids that by having the local bridge make outbound HTTPS calls, but the bridge is not present.

## 8. Nexora AI audit

The launcher, text panel, speech recognition/synthesis hooks, deterministic command parser, clarification, 30-second confirmations for gate/security actions, and acknowledgement/error reporting are implemented. Nexora discovers commands only from the current authorized inventory and sends through the same server-authorized device command API. This is a sound defense-in-depth model; the browser alone does not grant control.

Production functionality is blocked: PostgreSQL is unreachable from Vercel, the database contains no devices, gateway credentials are unset, and no bridge/broker/controller is verified. The AI is not a hosted generative model; it is a deterministic browser command engine. It does not call Railway or an external LLM. Speech support remains browser-dependent and was not browser-tested.

## 9. Security findings

| Severity | Finding and evidence | Impact | Remediation |
|---|---|---|---|
| **High** | Production database connectivity is broken; health returns 503. | Login completion and every core data/control operation fail. | Correct the Production-scoped Vercel pooled URL, redeploy, and verify health plus authenticated calls. |
| **High** | Vercel connects as PostgreSQL superuser `postgres`; RLS cannot protect against a missing predicate in server SQL. | A future query bug could become cross-house data access. | Create a least-privileged application role with only required schema/table/function permissions; keep server-side ownership predicates and test two-tenant denial. |
| **High** | No deployed/verified MQTT ACL/TLS/controller credential model exists; one environment credential represents the whole HTTP gateway. | If improvised or exposed, device commands and events could cross scopes or be forged. | Deploy a reviewed outbound bridge and broker ACLs with distinct controller identities, TLS where traffic leaves a trusted VLAN, and scoped topics. |
| **Medium** | No API rate limiting is present on auth compatibility, gateway polling/events, or command endpoints. | Credential stuffing or resource exhaustion is easier. Supabase Auth has its own limits, but application/gateway routes do not. | Add platform/WAF and endpoint-aware limits after defining trusted bridge egress and user thresholds. |
| **Medium** | Migration history is absent. | Drift and rollback/audit confidence are weak; future migrations can be applied twice or out of order. | Baseline the existing schema in a reviewed migration-history process without reapplying DDL. |
| **Medium** | Public health endpoint reveals coarse database availability. | Useful reconnaissance, though it does not expose secrets or stack traces. | Keep the response coarse; restrict detailed health/logs to operators and use platform monitoring. |
| **Medium** | Production deployment commit and environment scopes are not independently verifiable from the repository. | An outdated build or wrong env scope can silently reintroduce login faults. | Link the project read-only and record deployment ID, commit, and variable presence/hash per environment. |
| **Low** | Repository contains stale Spring/Railway architecture text alongside Vercel cloud architecture. | Operators may diagnose or deploy the wrong service. | Update operational docs after architecture ownership is confirmed. |

Positive controls: secrets are ignored and no tracked credential pattern was found; service-role keys are not used in the browser; CSRF uses a double-submit token plus expected-origin check; gateway secret comparison is timing-safe; command queries are resource-scoped; gate movement requires confirmation; audit records are written for submitted commands; API errors do not return stack traces.

## 10. Reliability and cost risks

Actual account plans and usage were inaccessible, so sustainability cannot be certified.

- Vercel Hobby is free but intended for personal/non-commercial work, includes bounded function/transfer/build usage, and retains runtime logs for only one hour. Hobby projects can pause when free usage is exhausted. See [Vercel Hobby](https://vercel.com/docs/plans/hobby) and [limits](https://vercel.com/docs/limits).
- Railway is not currently required by the observed cloud architecture. If a missing service is restored, Railway's current Free plan includes $1/month resource credit; Hobby is $5/month including $5 usage. A trial is one-time $5/30 days. A persistent bridge/backend cannot be assumed free indefinitely. See [Railway plans](https://docs.railway.com/pricing/plans).
- Supabase Free includes 500 MB database size and may pause after a week of insufficient activity; it has no automatic backups. This is unsuitable for dependable estate/security operation without an explicit availability and backup decision. See [Supabase billing](https://supabase.com/docs/guides/platform/billing-on-supabase) and [project pausing](https://supabase.com/docs/guides/platform/free-project-pausing).
- Cloud polling every four seconds per authenticated house can generate substantial Vercel invocations and database queries. It is less efficient than pushed updates and can accelerate free-tier consumption.
- Serverless cold starts and pooler connection establishment affect login latency. The current 30-second client timeout and 10-second database connect timeout are bounded, but no retry/backoff or user-facing partial-auth state exists.
- MQTT/background operation requires an always-on LAN host or paid persistent compute; Vercel functions cannot host a persistent MQTT client.

## 11. Test results

| Check | Result | Evidence |
|---|---|---|
| Public homepage and login | **Passed** | HTTP 200; 0.75s and 0.48s. |
| Production database health | **Failed** | HTTP 503, `CONNECTION_FAILED`, 1.69s. |
| Unauthenticated session guard | **Passed** | `/api/v1/me` returned expected 401 JSON. |
| Supabase project reachability | **Passed** | Auth endpoint responded; read-only Postgres query returned version 17.11. |
| Local pooled DB connection | **Passed** | Read-only query as configured runtime client succeeded. |
| Schema/RLS inventory | **Passed with gap** | 14 tables, all RLS enabled; no migration history. |
| Credentialed login/network trace | **Blocked** | No test user password or browser automation access. |
| Cross-house authorization | **Blocked** | No second authorized test identity/data; no mutation allowed. |
| Source tests | **Passed** | 8/8 Node test files passed. |
| ESLint | **Passed** | Exit 0. |
| TypeScript | **Passed** | `tsc --noEmit` exit 0. |
| Production build | **Passed** | Next.js 16.2.4 compiled and generated 22 pages/routes. |
| Vercel deployment commit/env/logs | **Blocked** | No linked/authenticated Vercel CLI/project access. |
| Railway health/logs | **Blocked / not applicable to observed login path** | Checkout unlinked; OAuth refresh failed; no service evidence. |
| MQTT broker/bridge | **Not tested** | Artifacts and credentials absent. |
| Firmware compile/hardware | **Not tested** | Firmware absent; no physical test authorized. |
| Nexora unit behavior | **Passed** | `tests/nexora-ai.test.mjs` passed; production actuation blocked. |

## 12. Deployment readiness matrix

| Area | Status | Reason |
|---|---|---|
| Frontend | **PARTIALLY READY** | Public and build healthy; production metadata/browser trace unavailable. |
| Backend (Vercel API) | **BLOCKED** | Database health 503. |
| Railway backend | **NOT VERIFIED** | No linked project/source/config and not in actual cloud login path. |
| Database | **PARTIALLY READY** | Reachable and schema exists; Vercel connectivity broken, migration provenance absent, inventory incomplete. |
| Authentication | **BLOCKED** | Supabase reachable, but post-auth account load cannot reach DB. |
| Authorization | **PARTIALLY READY** | Queries and policies are scoped; live two-tenant denial not tested. |
| MQTT broker | **NOT VERIFIED** | No broker evidence. |
| IoT bridge | **NOT IMPLEMENTED** in visible repo | API contract exists, bridge artifacts absent. |
| ESP32 firmware | **NOT VERIFIED** | Repository absent. |
| Nexora AI | **PARTIALLY READY** | UI/parser/tests pass; production commands blocked. |
| End-to-end device control | **BLOCKED** | Zero devices, no gateway/broker/firmware verification. |
| Security | **BLOCKED** | Least-privilege DB role and IoT security deployment are unresolved. |
| Production reliability | **BLOCKED** | Core DB path down; plans/backups/monitoring not verified. |

## 13. Prioritized remediation plan

### P0 — Critical blockers

1. **Repair Vercel Production database connectivity.** Root cause is most likely Production `DATABASE_URL` value/scope mismatch; evidence is live 503 versus successful local pooled query. Impact: login completion and all data paths fail. Affected: Vercel Production env and `src/lib/cloud/db.ts`. Fix only the existing project's secret, then redeploy. Validate health 200, then authenticated `/me` and `/houses` under 2s.
2. **Verify the deployed commit and cloud env mode.** Evidence: local `main` is `2110597`, but no deployment metadata is available. Impact: production may lack the latest session-race fixes. Affected: Vercel Git integration/build. Validate deployment commit, `CLOUD`, `/api/v1`, site URL, Supabase project ref, and required secret presence without printing values.

### P1 — Deployment blockers

1. **Provision and verify application inventory only after a reviewed data plan.** Evidence: one house, zero devices. Impact: dashboard and Nexora cannot control anything. Affected: Supabase `smart_estate` data. Validate ownership, house/device/gateway IDs, then negative cross-house tests. This audit does not authorize seeding.
2. **Provide and audit the real MQTT/bridge/firmware repositories and deployment.** Evidence: all artifacts absent and gateway env empty. Impact: commands remain `PENDING`; no physical state exists. Validate broker TLS/auth/ACL, scoped topics, bridge outbound HTTPS, ack/idempotency, reconnect, and firmware compilation before hardware testing.
3. **Replace the runtime superuser with a least-privileged DB role.** Evidence: connection reports `current_user=postgres`. Impact: RLS bypass magnifies query bugs. Validate required CRUD/function permissions and run a two-user tenant isolation suite.
4. **Baseline schema migration history.** Evidence: `supabase_migrations.schema_migrations` does not exist. Impact: drift cannot be safely managed. Compare exact live DDL with the checked-in migration and record an approved baseline; do not blindly apply the migration.

### P2 — Reliability improvements

1. Add login-boundary telemetry and structured timing for Supabase Auth, `/me`, `/houses`, and pooler connection without logging tokens, emails, or URLs.
2. Replace fixed four-second polling with an appropriate pushed or adaptive mechanism, or add exponential backoff/jitter and visibility-state pausing.
3. Add rate limits for gateway, command, and authentication-facing routes; add alerts on database health failures and command timeout rates.
4. Confirm plan, backups, restore procedure, log retention, and uptime expectations. Free tiers do not constitute a production availability plan.

### P3 — Optional enhancements

1. Reconcile README/deployment documentation with the actual Vercel cloud architecture and clearly archive the missing Spring/Railway design.
2. Improve the login UI to distinguish “credentials accepted; loading estate profile” from authentication failure.
3. Add an operator-only readiness view covering database, bridge last-seen, broker, controller heartbeat, and command queue age.

## Manual read-only diagnostics

Run these from an authorized operator workstation. They do not mutate production, but Vercel/Railway commands require account access. Never paste output containing secret values into tickets.

```bash
# Public checks
curl -sS --max-time 20 -i https://nexora-home.vercel.app/api/health/database
curl -sS --max-time 20 -i https://nexora-home.vercel.app/api/v1/me

# Vercel: inspect only (do not run deploy/promote/rollback)
vercel link                         # confirm team/project interactively before accepting
vercel env ls production
vercel ls
vercel inspect https://nexora-home.vercel.app
vercel logs https://nexora-home.vercel.app --since=1h

# Compare configuration without printing values. Run after `vercel env pull` only in a protected temp directory.
node --env-file=.env.production.local --input-type=module -e '
for (const k of ["NEXT_PUBLIC_SMART_ESTATE_MODE","NEXT_PUBLIC_API_BASE_URL","NEXT_PUBLIC_SITE_URL","NEXT_PUBLIC_SUPABASE_URL","DATABASE_URL","IOT_GATEWAY_ID","IOT_GATEWAY_CREDENTIAL"]) {
  const v=process.env[k]||""; console.log(`${k}: ${v ? `SET length=${v.length}` : "UNSET"}`)
}'

# Supabase read-only runtime connection (uses the same driver/options as the app)
node --env-file=.env.local --input-type=module -e '
import postgres from "postgres";
const sql=postgres(process.env.DATABASE_URL,{ssl:"require",prepare:false,max:1,connect_timeout:10});
try { console.log(await sql`select current_database() db,current_user usr,current_setting(${"server_version"}) version`) }
finally { await sql.end() }
'

# Railway, only if an actual project/service is identified; do not link by guesswork
railway status
railway service list --json
railway service status --json
railway domain list --json
railway logs --lines 100 --filter '@level:error'

# Consolidated source validation
npm ci
npm test
npm run lint
npx tsc --noEmit --incremental false
npm run build
```

For a credentialed login trace, use a dedicated test user in browser DevTools and record only URL, method, status, and duration for the Supabase token request, `/api/v1/me`, `/api/v1/houses`, and the first dashboard requests. Redact request/response bodies, cookies, authorization headers, and email addresses.
