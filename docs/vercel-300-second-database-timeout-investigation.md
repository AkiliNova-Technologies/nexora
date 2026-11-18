# Vercel 300-second database timeout investigation

Investigation date: 2026-11-15

Application commit inspected: `88bcbc7605b062334e36804b0e2ab8df2eb40c9d` plus the uncommitted changes described here.

## Finding

The application-level reason that `SELECT 1` can occupy a Vercel Function for 300 seconds is established: the shared Postgres.js client configured only `connect_timeout`. In installed Postgres.js 4.1.1, `connect_timeout` limits connection establishment; it does not bound the complete lifetime of a queued or running query. Both `queue_timeout` and `query_timeout` default to zero, meaning no limit.

The client also allowed the Postgres.js default of up to 100 pipelined queries on its single connection. Supabase documents that its shared transaction pooler on port 6543 does not support query pipelining. A health query could therefore sit behind a stuck operation or on a connection whose pooler/network stopped answering. With no query deadline, Vercel's 300-second Function limit was the first effective deadline.

This establishes the code-level timeout defect. It does not yet establish which upstream event first made the connection silent. Remaining candidates are a stale socket after serverless freeze/thaw, a Supavisor/pooler interruption, a network interruption between `iad1` and `eu-west-1`, connection pressure, or an earlier pipelined operation that stopped receiving replies.

The 236 MB peak on a 2,048 MB Function rules out memory exhaustion for the example failure.

## Postgres.js behavior verified

Installed version: `postgres@4.1.1`.

- `connect_timeout`: bounds an individual connection/opening failure period and the pool's connection retry window. It does not bound a query already waiting or running.
- `queue_timeout`: removes and rejects a query that is waiting for a connection. The query is never sent.
- `query_timeout`: starts when an ordinary query enters the pool and covers waiting plus execution. Postgres.js cancels the underlying query; this is not a detached `Promise.race()`.
- `cancel_timeout`: if a canceled query receives no response, Postgres.js destroys the connection. This prevents the silent connection and its pending work from remaining indefinitely.
- `max_pipeline: 1`: prevents multiple queries being in flight on the client connection and matches the Supabase transaction-pooler limitation.
- `idle_timeout: 20`, `max: 1`, `prepare: false`, and required TLS are preserved.

The selected limits are:

| Limit | Value | Purpose |
| --- | ---: | --- |
| Connection establishment | 10 s | Preserve the existing connection allowance |
| Waiting for a connection | 5 s | Reject unsent work under acquisition/queue pressure |
| Complete query lifetime | 8 s | Cancel a silent or slow query far below Vercel's 300 s limit |
| Cancellation acknowledgement | 2 s | Destroy an unresponsive connection after cancellation |

The effective worst case for an unanswered query cancellation is approximately ten seconds: eight seconds to the query deadline plus up to two seconds before the connection is destroyed.

## Diagnostics added

Each health request receives a server-generated UUID returned in the `X-Request-Id` header and JSON response. Structured `database.health` events record:

1. `handler_entry`
2. `client_init_start`
3. `client_init_complete`
4. `query_start`
5. `query_complete`
6. `ready`, `timeout`, or `error`

The fields are limited to correlation ID, stage, elapsed/total milliseconds, sanitized diagnostic code, configured deadline, and aggregate Postgres.js pool counts (`connections`, `opening`, `leased`, and `waiting`). They do not contain credentials, connection strings, tokens, SQL parameters, account identifiers, or personal information.

Postgres.js initializes connections lazily. Therefore `client_init_complete` means the client/pool object was constructed; network acquisition begins when `query_start` executes. The combination of the last observed stage and pool counters distinguishes the main cases:

- `opening > 0`: connection establishment/startup;
- `waiting > 0` with a live/leased connection: pool acquisition or work queued behind another operation;
- `connections > 0`, no completion, then `QUERY_TIMEOUT`: sent query or network/pooler response stalled;
- `CONNECTION_QUEUE_TIMEOUT`: query was never sent;
- `CONNECTION_TIMEOUT`: connection establishment did not complete.

## Effect on authenticated routes

All cloud repository methods use the same module-scoped `getSql()` client. The missing limits and pipelining mismatch therefore affect health, dashboard, rooms, devices, security, synchronization, and command operations in the same warm Function instance. The fact that some synchronization requests succeed does not contradict this: Vercel can route concurrent requests to different warm instances and connections, and an affected connection may later be replaced.

Applying the limits in the shared client prevents authenticated routes from occupying an instance indefinitely as well. It does not prove their historical failures shared the same connection; production correlation requires their existing `api.request` timing logs and the new health request IDs.

## Validation

Completed locally:

- TypeScript: `npx tsc --noEmit`
- Full tests: `npm test` — 12 test files passed
- ESLint: `npm run lint -- --quiet`
- Production build: `next build --webpack` passed, including compilation, TypeScript, page generation, and build traces
- Diff whitespace validation: `git diff --check`
- Targeted readiness tests: eight passed, including unavailable database, queued acquisition error, delayed query, recovery, concurrency, configuration invariants, and an actual Postgres.js client connected to a temporary TCP server that accepted a socket but never completed PostgreSQL startup. The stalled socket was rejected in approximately 130 ms under accelerated test limits.

The default Turbopack build reached `Creating an optimized production build ...` but did not progress before a 180-second local validation ceiling. The supported webpack build completed successfully. This is recorded as a local Turbopack-build anomaly, not an application compilation failure; CI should still run the project's default build before deployment.

## Production verification procedure

No deployment was performed. After review and explicit deployment authorization:

1. Deploy to a protected Preview first with the existing authorized Preview environment. Do not alter the database, RLS, Supabase region, Railway region, or Function duration.
2. Confirm the deployment contains the expected commit and `postgres@4.1.1` or a reviewed compatible version.
3. Call `/api/health/database` repeatedly under healthy conditions and confirm the stage sequence ends in `ready` and the response/request log correlation IDs match.
4. During a controlled failure test against a non-production unavailable database endpoint, confirm the route returns sanitized HTTP 503 in no more than approximately ten seconds and the Function does not continue to 300 seconds.
5. Confirm the final event is `timeout` or `error`, with a sanitized code and pool counters but no connection URL or credentials.
6. Run concurrent, non-mutating health and authenticated dashboard reads. Verify rooms/devices/security/synchronization either succeed or fail within the client deadlines; confirm no growth in `waiting` across subsequent requests.
7. Inspect Vercel Runtime Logs by request ID and compare handler, client, query, and completion stages. Inspect Supabase pooler client/backend, waiting, rejection, and connection metrics for the same timestamps where authorized.
8. Verify recovery: after the induced failure is removed, a later request opens a replacement connection and returns `ready` without redeploying.
9. Observe at least one normal traffic period before claiming resolution. A code-level deadline is verified only when Production stops producing 300-second database executions and failed health requests consistently return 503 within the intended bound.

## Remaining evidence needed

To identify the initiating upstream root cause rather than only the missing application deadline, collect:

- the new last-stage and pool-counter diagnostics for a failure;
- Vercel request/runtime records showing instance and deployment correlation;
- Supabase pooler connection, wait, rejection, and restart metrics at the same timestamp;
- safe Postgres.js error/cause codes, particularly `QUERY_TIMEOUT`, `CANCEL_UNANSWERED`, `CONNECT_TIMEOUT`, or `QUEUE_TIMEOUT`;
- whether failures cluster after idle periods, which would support stale freeze/thaw sockets;
- whether an earlier request on the same instance began but never completed.

Until those observations exist, the confirmed conclusion is limited to: the client configuration allowed an upstream stall to remain unbounded until Vercel killed the Function, and the proposed change supplies real driver-level cancellation and connection disposal. It is not yet evidence that the Production upstream failure itself is fixed.
