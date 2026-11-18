# Nexora Smart Estate production region and performance audit

Audit date: 2026-11-15 (Africa/Kampala)

Audited application commit: `88bcbc7605b062334e36804b0e2ab8df2eb40c9d`

This was a read-only audit. No Vercel, Supabase, Railway, database, deployment, credential, or physical-device configuration was changed.

## Executive summary

The production data path has a confirmed region mismatch: Vercel Node.js Functions execute in `iad1` (Washington, D.C.), while the configured Supabase shared transaction pooler is in AWS `eu-west-1` (Ireland). Railway's Spring Boot service executes in Railway `us-west2` (California), but Railway is not the dashboard application-data API.

The region mismatch adds avoidable latency, but it is **not sufficient evidence for the reported 15–30 second stalls**. Healthy Vercel database checks report 70–72 ms inside the Function. Representative PostgreSQL statements execute in 0.05–1.04 ms on the server. In the current audit, 39 of 40 Vercel database-health requests returned 200, one returned 503 in 1.30 seconds, and none timed out. The earlier 15-second failures happened after DNS, TCP, and TLS and before the first response byte; without the owning Vercel project's runtime logs, it remains unknown whether those failed requests entered the Function runtime.

The most defensible conclusion is:

> Routine latency is increased by the `iad1` → `eu-west-1` database path, while the intermittent long timeout remains an unverified infrastructure or connection-acquisition failure. The SQL statements measured here are not slow. Moving Functions to `dub1` is a reasonable controlled optimization after production access is restored, but it must not be represented as a proven timeout fix.

## Region inventory

| Service | Actual region | Source of evidence | Confidence |
| --- | --- | --- | --- |
| Vercel Functions | `iad1`, Washington, D.C., USA | Five production `/api/health/database` responses contained `x-vercel-id: cpt1::iad1::…`. Vercel documents that this header includes the edge path and Function execution region. No repository region override exists. | High |
| Vercel ingress for this audit | `cpt1`, Cape Town, South Africa | The first component of all sampled `x-vercel-id` values was `cpt1`. This is ingress/edge routing, not Function execution. | High |
| Supabase PostgreSQL | AWS `eu-west-1`, West EU (Ireland) | The configured shared-pooler hostname identifies `eu-west-1`, and its project-scoped username matches the configured Supabase project reference. Direct Supabase project settings were inaccessible. | Medium-high |
| Supabase shared pooler | AWS `eu-west-1`, Ireland | Sanitized `DATABASE_URL` metadata: `aws-1-eu-west-1.pooler.supabase.com:6543`. | High |
| Railway backend | Railway `us-west2`, California, USA | A request with `X-Railway-Debug: 1` returned `X-Railway-Upstream-Zone: railway/us-west2`. `X-Railway-Edge: jnb1` is only the Johannesburg ingress POP. | High |

Vercel documents `iad1` as the default Function region and recommends running database-heavy Functions near their data source. It identifies `dub1` as AWS `eu-west-1`, the same AWS region code exposed by the Supabase pooler. See [Vercel Function region configuration](https://vercel.com/docs/functions/configuring-functions/region) and [Vercel regions](https://vercel.com/docs/regions).

Supabase lists `eu-west-1` as West EU (Ireland). See [Supabase available regions](https://supabase.com/docs/guides/platform/regions).

Railway distinguishes edge POPs from deployment regions; `X-Railway-Upstream-Zone` is the origin region. See [Railway edge networking](https://docs.railway.com/networking/edge-networking) and [Railway regions](https://docs.railway.com/deployments/regions).

## Infrastructure architecture

```text
Uganda browser
  ├─ static assets → Vercel edge/CDN (`cpt1` during this audit)
  ├─ /api/v1/* → Vercel Node.js Function (`iad1`)
  │                  ├─ Supabase Auth claims
  │                  └─ Supabase shared transaction pooler (`eu-west-1:6543`)
  │                                      └─ Supabase PostgreSQL (`eu-west-1` inferred)
  └─ does not use Railway for CLOUD-mode dashboard data

IoT polling client / bridge (source unavailable)
  └─ Railway Spring Boot service (`us-west2`)
       └─ Hikari database target: unverified
```

The deployed browser bundle contains `/api/v1`; it does not contain the Railway production URL as its application API base. Railway responses identify a Spring Boot service through Actuator content type, a `SMART_ESTATE_SESSION` cookie, Spring security headers, and Hikari tracing. Railway therefore remains a separate IoT/backend process.

## Network measurements

All requests were sequential, non-destructive, bounded to 8–12 seconds, and made from the development network in Uganda. Times are seconds. TTFB includes DNS, TCP, TLS, Vercel/Railway routing, runtime work, and upstream calls.

| Target | Samples | Results | DNS | TCP complete | TLS complete | TTFB / total |
| --- | ---: | --- | --- | --- | --- | --- |
| Vercel homepage, default family | 10 | 10× 200 | 0.022–0.254 | 0.088–0.320 | 0.219–0.427 | 0.486–0.696 / 0.554–0.762 |
| Vercel homepage, forced IPv4 | 10 | 10× 200 | 0.001–0.003 | 0.067–0.465 | 0.185–0.597 | 0.447–0.853 / 0.512–0.921 |
| Vercel database health, default family | 10 | 9× 200, 1× 503 | 0.025–0.065 | 0.094–0.180 | 0.207–0.334 | successful 0.769–0.942; 503 1.301 |
| Vercel database health, forced IPv4 | 30 | 30× 200 | 0.001–0.004 | 0.068–0.090 | 0.175–0.253 | 0.737–0.997 / 0.738–0.999 |
| Vercel `/api/v1/me`, unauthenticated, default | 10 | 10× expected 401 | 0.025–0.073 | 0.094–0.193 | 0.205–0.323 | 0.708–0.847 |
| Vercel `/api/v1/me`, unauthenticated, IPv4 | 10 | 10× expected 401 | 0.002–0.004 | 0.068–0.093 | 0.193–0.226 | 0.679–0.788 |
| Railway Actuator health | 10 | 10× 200 | 0.239–0.382 | 0.306–0.451 | 0.398–0.547 | 0.931–1.200 |

IPv6-only resolution failed from this network before connection establishment. The domain resolved to IPv4 endpoints, including IPv4-mapped results from the local resolver. This does not show that Vercel lacks IPv6 globally; it shows that this development network could not perform the IPv6 test.

### Failure rate and cold/warm distinction

- Current database-health sample: 1/40 returned 503 (2.5%); 0/40 transport timeouts.
- Earlier supplied measurement: 4/10 timed out after 15 seconds.
- The current sample does not reproduce the earlier failure rate and therefore cannot establish a stable rate.
- Health responses did not expose instance identity or cold-start metadata. Cold and warm invocations cannot be reliably separated from public response timing alone.
- Five consecutive production responses all executed in `iad1`.
- Healthy responses consistently reported 70–72 ms for `select 1` inside the Function, while end-to-end Uganda response time was approximately 0.74–1.00 seconds.

## Database connection findings

### Connection method

The Vercel API is configured for the Supabase shared transaction pooler:

- host pattern: `aws-[index]-eu-west-1.pooler.supabase.com`
- port: `6543` (transaction mode)
- application pool: module-scoped Postgres.js client
- `max: 1`
- `prepare: false`
- TLS: required outside localhost
- connection timeout: 10 seconds
- idle timeout: 20 seconds

This matches Supabase's current serverless recommendations: use the shared transaction pooler, create the client once at module scope, cap each warm instance at one connection, disable prepared statements, and require TLS. See [Supabase: connect to Postgres](https://supabase.com/docs/guides/database/connecting-to-postgres).

No connection setting should be changed merely to chase a faster single benchmark. In particular, raising `max` would multiply client connections across warm Vercel instances and could make exhaustion more likely.

### PostgreSQL and capacity metadata

| Property | Observed |
| --- | --- |
| PostgreSQL version | 17.11 |
| `max_connections` | 60 |
| Smart Estate indexes | 24 |
| Current inventory | 1 profile, 1 house, 0 rooms, 0 devices, 0 security events, 0 commands |

The observed `max_connections=60` corresponds to Supabase Nano/free compute documentation. Supabase documents a 200-client pooler limit and default pool size of 15 for that compute size, but the project's current pool-size setting and live pooler client/backend utilization could not be read without dashboard/observability access. See [Supabase compute and disk limits](https://supabase.com/docs/guides/platform/compute-and-disk) and [connection pooling and limits](https://supabase.com/docs/guides/database/connecting-to-postgres/pooling-and-limits).

### Connection and query measurements

From the Uganda development network to the configured Ireland transaction pooler:

- 10/10 fresh connections succeeded in 1.151–1.555 seconds.
- 20 warm `select 1` calls took mostly 0.154–0.204 seconds, with one 0.373-second outlier.
- Route-shaped query round trips took 0.311–0.593 seconds from Uganda.
- PostgreSQL `EXPLAIN (ANALYZE, BUFFERS)` execution time was:
  - rooms: 0.653 ms
  - dashboard: 1.044 ms
  - recent command sync: 0.048 ms

These measurements show that SQL execution is not the current bottleneck. Network traversal and connection establishment dominate from Uganda. The Vercel Function's 70–72 ms health measurement is the more relevant measurement for the `iad1` → Ireland application path.

## Vercel Function performance findings

The application uses the Node.js runtime and dynamic route handlers. It has structured logs for:

- authentication duration;
- operation duration;
- total duration;
- sanitized route template;
- outcome;
- safe database error code.

The owning Vercel project is not visible to the authenticated Vercel account. There is no `.vercel/project.json`, no `nexora` project in the accessible team, and no deployment record for commit `88bcbc7`. Consequently, this audit could not read runtime logs, deployment settings, Fluid Compute status, production environment metadata, or the database-health 503 diagnostic code.

The `x-vercel-id` proves execution in `iad1`, but public response evidence cannot prove whether the historical no-byte timeouts reached the Function. That distinction requires Vercel request/runtime logs correlated by request ID and timestamp.

### Endpoint behavior

| Endpoint group | Backend operations | Performance implication |
| --- | --- | --- |
| `/api/v1/me`, `/api/v1/houses` | Supabase claims, then one SQL query each | Requested in parallel during account initialization. |
| Dashboard, rooms, devices | One authorized SQL query per endpoint | Requested in parallel. A shared `max:1` client can serialize concurrent queries that land on the same warm Function instance. |
| Security events, mode, policies | One query each | Requested independently and no longer block rooms/devices/dashboard completion. |
| Per-device state | One request/query per device after inventory | N+1 behavior; currently zero production devices, so it does not explain present failures. It will matter after provisioning. |
| Cloud synchronization | Two sequential SQL statements every successful cycle | Four-second base interval; exponential backoff to 30 seconds after failures and visibility-aware pausing are implemented. |

Parallel browser requests reduce browser critical-path latency, but under Fluid Compute they may share one warm instance and one Postgres.js connection. That can queue short operations behind a slow acquisition. It amplifies an upstream stall but does not create a 15-second stall when connections and queries are healthy.

## Railway relevance

Railway executes the Spring Boot/Hikari service in California (`us-west2`). Its public health endpoint remained UP for all ten samples. The public request entered Railway through Johannesburg (`jnb1`), then traversed Railway's network to California.

The Railway project is not linked locally, so the following remain unverified:

- JDBC host, port, database, and project reference;
- Hikari maximum/minimum pool size and acquisition timeout;
- whether Railway uses the same Supabase project or its own PostgreSQL database;
- active services, replica count, and Railway runtime logs;
- identity of the external process polling `/api/iot/v1/commands` every three seconds.

Railway can consume the same Supabase connection capacity only if its JDBC target points to the same project. Hikari is a persistent application-side pool, so that configuration would need to be counted separately from Vercel's transaction-pooler clients. No evidence currently proves that shared target.

Moving Railway would not correct Vercel dashboard timeouts. It should be considered separately for IoT latency after the gateway, MQTT broker, and database targets are known.

## Probable causes ranked by evidence

1. **Intermittent database connection acquisition, pooler, or upstream network failure — strongest, but not confirmed.** The database-only endpoint previously timed out and returned one current 503, while homepage/auth-only routes were stable. Raw diagnostic codes and pooler utilization are inaccessible.
2. **Function/database region mismatch — confirmed contributor to routine latency, not proven timeout cause.** Healthy cross-region database work is about 70–72 ms, far below 15 seconds.
3. **Concurrency amplification on a single module-scoped connection — plausible secondary factor.** Parallel initialization and Fluid concurrency can queue behind one slow connection. The configuration itself is correct and should not be enlarged without queue evidence.
4. **Cold Function or cold database connection — plausible for approximately one-second responses.** Fresh pooler connections from Uganda took 1.15–1.56 seconds. No instance metadata exists to correlate cold starts with failures.
5. **Slow SQL or missing indexes — currently contradicted.** Representative SQL executes in approximately 0.05–1.04 ms and the dataset is tiny.
6. **Railway region or IoT polling — contradicted for dashboard requests.** The browser uses Vercel `/api/v1`; Railway is not in that request path.
7. **IPv6 routing — unsupported as the cause.** IPv6 was unavailable from the audit network, while the observed production failures occurred after successful IPv4 connection and TLS.

## Region mismatch assessment

`iad1` and Supabase `eu-west-1` are geographically separated. `dub1` maps to AWS `eu-west-1`, so it is the natural Vercel candidate for database proximity. Vercel explicitly recommends placing Functions close to their data source, and all plans support a single Function region; paid plans add multi-region capacity. See [Vercel Function region configuration](https://vercel.com/docs/functions/configuring-functions/region).

Moving the Node.js Functions from `iad1` to `dub1` should reduce database round-trip latency and the duration for multi-query operations. It will not move the static frontend away from users: Vercel continues to serve cacheable assets through its edge/CDN. It may change the internal route Uganda → edge → Function, so the improvement must be measured end-to-end rather than assumed.

It is not currently possible to quantify the expected reduction from production because no `dub1` preview/control deployment was authorized. A reasonable hypothesis is removal of most of the observed 70–72 ms cross-region database component per sequential database round trip, not removal of 15–30 second failures.

## Configuration options

| Option | Expected latency impact | Timeout risk | Complexity | Cost/free-tier compatibility | Deployment risk |
| --- | --- | --- | --- | --- | --- |
| A. Keep `iad1` | None | Preserves the intermittent unknown | Lowest | No change | Lowest |
| B. Move Vercel Functions to `dub1` | Likely lower DB latency; especially sync and future N+1 state loads | May reduce exposure to transatlantic network faults, but not a proven fix | Low | A single region is supported on Hobby; regional compute rates differ if usage exceeds included allowance | Medium until preview/A-B evidence exists |
| C. Keep regions and alter DB connection behavior | No justified change: current settings already match Supabase guidance | Raising pools could worsen exhaustion | Medium | Could force a Supabase compute/pooler upgrade if done prematurely | Medium-high |
| D. Move selected APIs to Railway | Adds another auth/deployment boundary; California is farther from Ireland than `dub1` | Does not address current Vercel path without a migration | High | Ongoing Railway resources and egress may increase | High |

Vercel lists `iad1` Active CPU at $0.128/hour and `dub1` at $0.168/hour, with provisioned memory at $0.0106 versus $0.0139 per GB-hour when usage is billable. Hobby includes monthly Function allowances and does not provide on-demand overage in the same way as paid plans. The actual production project plan is unverified because the project is inaccessible. See [Vercel fluid compute pricing](https://vercel.com/docs/functions/usage-and-pricing).

No Supabase database migration is required to test a Vercel Function region change. Moving Supabase would be materially riskier and is not recommended from current evidence.

## Recommendation

### Immediate configuration

Keep the current production architecture and database. Do not move the Next.js API to Railway, enlarge the Postgres.js pool, raise timeouts, or migrate Supabase.

Restore read access to the actual Vercel project and collect at least 24 hours of the existing structured timing logs. Correlate database-health failures by request ID and capture:

- whether the invocation started;
- Function execution region and deployment ID;
- `database.health` outcome and safe error code;
- auth, operation, and total milliseconds;
- cold-start/runtime initialization indicator where Vercel exposes it;
- concurrent invocation count;
- Supabase pooler client/backend connections and rejected/waiting connections for the same interval.

### Provisional target configuration

If logs do not show pool exhaustion, credential errors, or a Supabase incident, create a controlled preview or staged production deployment with only the Vercel Function region changed from `iad1` to `dub1`. Keep Supabase in `eu-west-1`, the frontend domain unchanged, and Railway unchanged. Compare `iad1` and `dub1` with the same endpoint mix and at least 100 bounded database-health requests plus authenticated page-load traces.

Promote `dub1` only if it improves p50/p95 application-data latency and does not increase failure rate. Region placement should be an optimization with measured acceptance criteria, not an emergency timeout workaround.

### Expected improvement and uncertainty

- High confidence: lower Vercel-to-Supabase round-trip latency in `dub1`.
- Medium confidence: faster authenticated initialization and sync because several queries are performed across endpoints and two sync queries are sequential.
- Low confidence: elimination of the historical 15–30 second failures. The cause of those stalls remains unconfirmed.

## Safe evaluation steps

1. Obtain viewer access to the owning Vercel project and verify project ID, plan, production commit, Fluid Compute, Node version, current region, and environment scopes.
2. Confirm Vercel Production `DATABASE_URL` metadata matches the working transaction-pooler host, port 6543, database, and project-scoped username. Compare a secret hash/length without printing the value.
3. Enable no new services. Preserve the existing domain and Supabase project.
4. Capture an `iad1` baseline: p50/p95/p99, error rate, safe database error codes, invocation region, and pooler utilization.
5. Stage a reviewed `dub1` deployment without assigning the production domain, using the same commit and Production-equivalent non-destructive configuration.
6. Test public health plus a dedicated authenticated account. Do not submit commands, arm security, or actuate hardware.
7. Compare Function-side database duration separately from Uganda end-to-end duration.
8. Promote only after the acceptance criteria pass and an operator confirms there are no new errors.

## Rollback

If a later approved region change degrades performance:

1. Restore the project Function region to `iad1` or revert the reviewed `regions: ["dub1"]` configuration commit.
2. Redeploy the previously known-good application commit.
3. Verify `/`, `/api/health/database`, unauthenticated `/api/v1/me`, and a dedicated authenticated dashboard trace.
4. Confirm runtime logs show `iad1` execution and the previous error rate.
5. Do not roll back or migrate Supabase; the region experiment does not require a database change.

## Remaining access limitations

- Owning Vercel project, deployment metadata, Production environment metadata, Function logs, and observability are inaccessible.
- Supabase dashboard region label, pooler pool-size setting, connection charts, and correlated logs are inaccessible.
- Railway project configuration, variables, logs, Hikari settings, database identity, and polling-process source are inaccessible.
- No authenticated production browser session or dedicated test account was available, so dashboard/rooms/devices/security durations could not be measured directly in production.
- No controlled `dub1` deployment was authorized, so region-change benefits remain a hypothesis rather than an A/B result.

## Conclusion

The Smart Estate production timeout problem is **not proven to be caused by region mismatch or slow SQL**. A Vercel/Supabase mismatch exists and increases routine latency, but healthy cross-region database work is approximately 70–72 ms and PostgreSQL execution is approximately 0.05–1.04 ms. The long failures remain most consistent with an intermittent connection-acquisition, pooler, upstream-network, or pre-runtime infrastructure issue. Production Vercel logs and Supabase pooler utilization are the measurements required to distinguish those causes.

The recommended architecture remains Vercel for the Next.js application API, Supabase for Auth/PostgreSQL, and Railway for its separate IoT role. A future, controlled move of Vercel Functions to `dub1` is advisable as a latency optimization after access and baseline observability are restored; it is not yet justified as the timeout remedy.
