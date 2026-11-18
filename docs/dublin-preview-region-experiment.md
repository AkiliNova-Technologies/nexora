# Nexora Dublin Preview Function-region experiment

Experiment date: 2026-11-15 (Africa/Kampala)

Application commit inspected: `88bcbc7605b062334e36804b0e2ab8df2eb40c9d`

Status: **prepared, not deployed**. The Vercel account available to this audit does not contain the project serving `nexora-home.vercel.app`. No Preview deployment, environment variable, Production setting, Supabase resource, Railway resource, or credential was changed.

This document supplements [the production region and performance audit](./production-region-performance-audit.md).

## Decision

Do not promote `dub1` yet. Dublin is the technically appropriate candidate because Vercel `dub1` and the Supabase pooler are both in AWS `eu-west-1`, but there is no controlled Preview result to demonstrate better end-to-end reliability. The active Production availability incident also makes the latest sample unsuitable as a normal steady-state A/B control.

Retain Production in `iad1` until the owning Vercel project and a dedicated authenticated test account are available. Then run the prepared Preview-only procedure below and promote only with explicit approval and measured evidence.

## Current and proposed configuration

| Item | Current Production | Proposed experiment |
| --- | --- | --- |
| Vercel deployment | `nexora-home.vercel.app` | An unaliased Preview deployment only |
| Application commit | Repository HEAD `88bcbc7605b062334e36804b0e2ab8df2eb40c9d`; the serving deployment SHA could not be read | The exact Production SHA after it is verified in the owning project |
| Function region | `iad1`, confirmed by `x-vercel-id: cpt1::iad1::…` | `dub1`, supplied only to the Preview deployment command |
| Supabase | Existing shared transaction pooler in `eu-west-1` | Unchanged |
| Railway | Existing service in Railway `us-west2` | Unchanged |
| Repository region file | None (`vercel.json` and `vercel.ts` are absent) | None for the experiment; avoid a committed setting that could affect a later Production build |

Vercel uses `iad1` by default when no region is configured. For this experiment the safest minimum change is the deployment-scoped CLI override:

```sh
vercel deploy --regions dub1
```

`vercel deploy` creates a Preview unless `--prod` is supplied. Do not add `--prod`, do not alias the result to the Production domain, and do not promote it. A persistent configuration, if explicitly approved after the experiment, would be:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "regions": ["dub1"]
}
```

That file is deliberately not added by this preparation because a subsequent ordinary Production deployment would consume it.

## Production baseline

### Earlier steady-state sample

The preceding audit measured the database-health endpoint sequentially from Uganda:

| Endpoint | Sample | Outcome | End-to-end duration |
| --- | ---: | --- | --- |
| `/api/health/database`, default address family | 10 | 9× 200, 1× 503 | Successful: 0.769–0.942 s; 503: 1.301 s |
| `/api/health/database`, forced IPv4 | 30 | 30× 200 | 0.738–0.999 s |
| `/api/v1/me`, unauthenticated IPv4 control | 10 | 10× expected 401 | 0.679–0.788 s |

Healthy database responses reported 70–72 ms for the Function-side database operation. These older samples did not preserve all individual observations, so valid p50, p95, and p99 values cannot be reconstructed from their ranges.

### Latest bounded percentile sample

One hundred requests to `/api/health/database` were issued with forced IPv4, concurrency 5, and a fixed 5-second per-request ceiling. This bounded concurrent method was used only after a sequential run repeatedly reached an 8-second ceiling and a separate diagnostic request returned no bytes in 12 seconds.

| Samples | HTTP 200 | No response by 5 s | Error rate | p50 | p95 | p99 |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 100 | 6 | 94 | 94% | ≥5.000 s | ≥5.000 s | ≥5.000 s |

The percentile values are right-censored lower bounds, not true response durations: failed requests were stopped at the measurement ceiling. The six successful observations included a minimum of approximately 0.830 seconds. The result proves severe unavailability during this sample window, but it does not attribute the failure to `iad1`, the Function runtime, Supabase, or another upstream component.

The latest sample must not be compared with a healthy `dub1` Preview as though it were a stable regional control. Repeat both variants in an interleaved test window after Production returns to normal.

### Authenticated baseline limitation

No dedicated test account, session cookie, or authorized bearer token was available. Consequently, this preparation did not call authenticated dashboard, houses, rooms, devices, security, or synchronization endpoints and does not claim measurements for them. Production credentials were not extracted or reused.

## Why no Preview was deployed

The connected Vercel team exposes no project named Nexora, no local `.vercel/project.json` exists, and the Production deployment for commit `88bcbc7` is not visible. Therefore it is not possible to verify the owning project, its Production commit, Preview environment variables, Deployment Protection, Function logs, plan, or deployment metadata.

Creating a new Vercel project would not be a valid regional experiment: it could use different environment configuration, access controls, build settings, and credentials. It would also fail to provide a trustworthy comparison with the serving application. The Vercel CLI is not installed locally, and no deployment command was run.

## Authorized Preview procedure

An owner of the serving Vercel project should perform these steps without changing Production:

1. Link this repository to the existing project and confirm its project ID, team ID, Production domain, active Production deployment SHA, framework, Node.js version, and current Function region.
2. Check out the exact active Production SHA in a clean worktree. Do not benchmark an unrelated commit.
3. Confirm that Preview-scoped variables exist in Vercel. Compare secret fingerprints or metadata without printing secret values. Do not edit Production-scoped variables.
4. Keep Vercel Deployment Protection enabled for the Preview. Grant access only to the named testers.
5. Use a dedicated, least-privileged application test account. Do not use an administrator session or a physical-estate operator account.
6. If an exact database-path comparison requires the existing Supabase project, obtain explicit owner authorization for read-only benchmarking first. Never place service-role, gateway, MQTT, or device-command credentials in the Preview. Do not exercise mutation, command, arming, or device-actuation endpoints.
7. Create the Preview from the verified SHA using `vercel deploy --regions dub1`. Do not supply `--prod`, create a Production alias, or promote the deployment.
8. Record the returned deployment ID and immutable Preview URL. Verify the source SHA in Vercel deployment metadata.
9. Send a request to `/api/health/database` and confirm the response `x-vercel-id` has `dub1` as the Function execution component. Also confirm the deployment's Functions tab/metadata reports `dub1`; do not infer the Function region from DNS, edge ingress, or tester location.
10. Inspect runtime logs and verify the existing structured timing events contain no secrets, tokens, email addresses, user IDs, request bodies, or database URLs.

## Measurement protocol

Run the `iad1` Production control and `dub1` Preview candidate during the same quiet window, from the same client and network. Alternate targets rather than completing all requests against one target first. Use at least 100 observations per endpoint and a fixed ceiling. Report censored timeouts separately; do not replace them with invented durations.

Measure:

- `/api/health/database`;
- `/api/v1/me` with the dedicated test account;
- houses and dashboard;
- rooms and devices;
- security mode, policies, and events independently;
- one non-mutating synchronization read path, if the API exposes one;
- a complete authenticated page-load trace.

For each endpoint and region report sample count, HTTP status distribution, transport timeout count, error rate, p50, p95, p99, and maximum among completed responses. Also report Function-side authentication, database-operation, and total durations from structured logs. Correlate failures by deployment ID, request ID, timestamp, safe error code, and Function region.

Inspect Vercel logs for:

- time before the handler begins;
- authentication duration;
- database connection acquisition or first-query delay;
- SQL operation duration;
- total handler duration;
- cold initialization where available;
- concurrent invocations;
- 5xx errors and executions with no matching completion event.

Use the same observation window to inspect authorized Supabase pooler metrics for waiting/rejected clients and active client/backend connections. Do not alter the pool size, RLS, schema, database region, or timeout settings.

## Acceptance criteria

Recommend promotion only if all of the following are met:

- the Preview metadata and response headers independently confirm `dub1` execution;
- the exact serving Production SHA and equivalent authorized environment are used;
- `dub1` improves database-health and authenticated dashboard p50 and p95, with no material p99 regression;
- `dub1` has no higher timeout or non-2xx rate across a statistically useful sample;
- no new authentication, connection acquisition, SQL, or security errors appear in logs;
- rooms/devices continue loading independently when optional security requests fail;
- an owner explicitly approves a separate Production change.

If the active incident persists, stop the regional A/B test and diagnose availability first. A region experiment cannot distinguish regions when the control is not healthy.

## Cost implications

Vercel's published billable rates list:

| Resource | `iad1` | `dub1` | Difference |
| --- | ---: | ---: | ---: |
| Active CPU | $0.128/hour | $0.168/hour | +$0.040/hour, +31.25% |
| Provisioned memory | $0.0106/GB-hour | $0.0139/GB-hour | +$0.0033/GB-hour, +31.13% |

The gross regional rate is higher in Dublin. Actual invoice impact depends on the owning project's plan, included usage, execution duration, memory, and traffic. Lower database wait time may reduce billed wall-clock or memory duration, so the net effect must be calculated from post-test usage rather than from rates alone. The inaccessible project prevents a reliable monthly estimate.

No Supabase or Railway regional cost changes are part of this experiment.

## Rollback

No rollback is required for this preparation because nothing was deployed or configured.

For the Preview experiment, rollback is simply to stop using and delete the unaliased Preview deployment; Production remains on `iad1`. If a later, separately approved Production change is made, revert the region configuration to `iad1`, redeploy the previously verified Production SHA, verify `x-vercel-id` and deployment metadata show `iad1`, and repeat health plus authenticated smoke tests. Do not change Supabase or Railway as part of the rollback.

## Final recommendation

`dub1` remains the preferred candidate for a controlled Preview because it co-locates Vercel Functions with the Supabase AWS region. It is **not yet approved for Production**. The required next step is access to the owning Vercel project and an authorized test identity, followed by an interleaved `iad1`/`dub1` Preview experiment using the protocol above.

Until those measurements exist, retain `iad1`; do not interpret geographic proximity as proof of improved reliability.
