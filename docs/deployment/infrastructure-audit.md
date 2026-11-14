# Smart Estate deployment audit

## Existing implementation

- Frontend: Next.js 16 App Router with React 19. It supports a browser simulator and a credentialed Spring Boot API mode.
- Local backend: Spring Boot 4.1/Java 21, PostgreSQL/Flyway, session cookies, CSRF, REST, SSE, MQTT routing, ownership checks, resource-scoped estate permissions, idempotent client request IDs, and append-only command events.
- Database model: public-schema Flyway tables for users, estates, houses, memberships, rooms, devices, states, commands, security policies/events, and audit history. This local model is not assumed to exist in Supabase.
- MQTT contract: `smartestate/v1/{house-or-estate}/{device}/{command|ack|state|status|event}`, QoS 1, command UUID, issue/expiry timestamps, and actual controller acknowledgement before `EXECUTED`.
- Firmware: ESP32 Wi-Fi/MQTT recovery, NTP validation, duplicate command rejection, expiry checks, retained status, safe relay startup, three House 1 lights, a motion input, and a simulated gate whose physical position remains explicitly unverified.
- Nexora assistant: deterministic client-side command parsing, current-house scoping, effective backend permissions, and confirmation for gate movement.
- Deployment: the frontend repository has no checked-in Vercel project link or serverless API; the backend had no Compose stack or outbound bridge; no Supabase client or migration existed.

## Missing or blocked capabilities

- Existing Supabase credentials and schema inventory have not been provided, so connectivity, schema conflicts, RLS, and migration compatibility cannot yet be verified.
- The prepared cloud schema is intentionally separate and unapplied. Existing objects must be inspected before deciding whether to reuse them or apply any part of it.
- Production Vercel project/team settings and environment names have not been inspected because production configuration changes were not authorized.
- House 2 relays, fan wiring, ultrasonic entrances, siren, perimeter strip, physical gate limits, and compound PIR wiring are not implemented as verified physical outputs in the current firmware. Their GPIO/electrical mappings must be supplied and bench-tested; no pins were invented.
- No physical ESP32 was flashed or tested.

