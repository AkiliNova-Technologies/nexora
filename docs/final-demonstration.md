# Nexora Smart Estate final demonstration

This checklist distinguishes locally tested software from infrastructure and physical hardware that still require verification. Never run the physical portions unattended.

## Release record

- Delivery branch: `main`
- Application commit: the validated release commit on `origin/main` (record the immutable SHA with `git rev-parse origin/main` after push)
- Production URL: **Unavailable in the accessible Vercel account** — no project is linked to `AkiliNova-Technologies/nexora`, so no deployment URL can be claimed.
- Local validation: ESLint passed; TypeScript passed; 9 test files passed; Next.js production build passed.
- Cloud health: local health route exists, but production health cannot be checked until the Vercel project and production environment are accessible.

## Final application architecture

The browser runs the Next.js dashboard and Nexora AI widget. Supabase Auth establishes the user session. Node.js route handlers query the existing Supabase PostgreSQL `smart_estate` schema through server-only pooled credentials and enforce house/estate authorization on every operation. Commands are persisted with request IDs and expiry, claimed by an authenticated outbound gateway, delivered over scoped MQTT topics, and become confirmed state only when the matching ESP32 acknowledgement returns through the gateway event API. Vercel hosts the web/API tier; it does not host a persistent MQTT connection. The broker, bridge, and ESP32 firmware remain external deployment dependencies.

## Readiness matrix

| Capability | Status | Evidence / limitation |
| --- | --- | --- |
| Supabase authentication and house isolation | **Implemented and tested** | House/device queries apply `can_view_house` and command insertion applies `can_control_house`. Automated tests cover rejection of unknown cross-house state. Production data must still contain the intended two-house memberships. |
| House switching | **Implemented and tested** | Authorized users with multiple houses receive a header selector. Inventory is cleared while the next house loads so stale devices cannot appear under the new house. |
| Backend device inventory | **Implemented and tested** | Rooms, devices, capabilities, connectivity, and reported state come from the selected-house APIs. No production inventory is created by the UI. |
| Permission-aware device registration | **Not implemented** | There is no reviewed device-registration endpoint or role model. Provisioning must use a separately reviewed operator process. |
| Light/fan commands | **Implemented but awaiting hardware verification** | Server validates authorization, registered capability, online connectivity, request ID, expiry, and acknowledgement lifecycle. No relay or fan was physically actuated here. |
| Command acknowledgement | **Implemented and tested with simulation** | Commands remain pending/accepted until gateway events update them to executed, failed, or timed out. Automated tests confirm reported state is not changed optimistically. |
| Controller offline handling | **Implemented and tested** | Offline commands are rejected server-side and UI cards show authoritative connectivity. |
| Security mode and sensor policies | **Implemented and tested** | Versioned backend updates, authorization, event history, and policy UI exist. |
| Ultrasonic/PIR intrusion ingestion | **Implemented but awaiting hardware verification** | Gateway event ingestion persists authorized device events idempotently. Actual ultrasonic/PIR firmware and wiring are not present in this checkout. |
| Local siren response during cloud loss | **Blocked by missing firmware/infrastructure** | This safety requirement belongs in controller firmware. No verified siren firmware, GPIO mapping, or local policy engine is available here. Do not represent cloud-triggered siren behavior as a substitute. |
| Entrance gate Open/Close/Stop | **Implemented but awaiting hardware verification** | UI confirmation, authorization, capability checks, expiry, idempotency, pending state, timeout handling, and unverified physical position are implemented. Limit switches and safe motor-stop behavior remain unverified. |
| Nexora AI V2 | **Implemented and tested** | Uses authorized inventory, selected-house context, capability checks, confirmations, browser voice APIs, and authoritative acknowledgement feedback. |
| MQTT bridge and broker | **Blocked by missing infrastructure** | No broker configuration, bridge source, ACL, TLS material, or live MQTT client exists in this repository. Only the HTTPS gateway boundary and MQTT envelope contract are present. |
| ESP32 firmware | **Blocked by missing repository/hardware** | GPIO, relay polarity, fan driver, sensors, siren, perimeter strip, gate limits, and physical safety cannot be verified here. |
| Vercel production deployment | **Blocked by inaccessible project** | Build passes locally and deployment was authorized, but the authenticated Vercel team has no existing project linked to `AkiliNova-Technologies/nexora`. No new project or paid resource was created. |

## Authoritative inventory required before the demo

Do not invent these records. An authorized operator must verify and provision them against the real controller identifiers:

- House 1: kitchen light, bedroom light, living-room light, ultrasonic entrance sensor, and DC fan if House 1 is the fan house.
- House 2: kitchen light, bedroom light, living-room light, ultrasonic entrance sensor, and DC fan only if House 2 is the fan house.
- Shared estate: sliding gate, perimeter LED strip, compound PIR sensors, and siren.
- For every device: stable device ID, owning house or estate, room, gateway ID, type, capabilities, execution mode, and initial offline state.
- For every user: exact owner/access membership and only the necessary view/control/security/estate permissions.

The current audit found production inventory incomplete. Applying the schema migration or provisioning records requires separate approval.

## Required environment configuration

Vercel/Next.js:

```dotenv
NEXT_PUBLIC_SMART_ESTATE_MODE=CLOUD
NEXT_PUBLIC_API_BASE_URL=/api/v1
NEXT_PUBLIC_SITE_URL=https://<existing-vercel-domain>
NEXT_PUBLIC_SUPABASE_URL=<existing-project-url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<publishable-or-anon-key>
DATABASE_URL=<pooled-server-only-url>
DIRECT_URL=<reviewed-migration-only-url>
IOT_GATEWAY_ID=<scoped-gateway-id>
IOT_GATEWAY_CREDENTIAL=<server-only-random-secret>
```

Gateway/broker configuration must remain outside browser variables and must include the cloud API URL, gateway credential, broker host/port/TLS trust, controller-specific MQTT username/password, scoped topic prefixes, persistent queue path, and reconnect limits. Never use a `NEXT_PUBLIC_` prefix for database, gateway, MQTT, or signing secrets.

## Pre-demonstration validation

1. Confirm the Git branch and preserve the dirty working tree. Do not reset or restore dashboard files.
2. Run `npm ci`, `npm run lint`, `npm test`, `npx tsc --noEmit --incremental false`, and `npm run build`.
3. Confirm the Vercel project points to the existing Supabase project without printing secrets.
4. Query only authorized metadata and verify both houses, rooms, memberships, devices, states, gateway IDs, security state, and policies.
5. Verify Homeowner 1 has no membership or access row for House 2.
6. Start the reviewed broker and bridge on the estate network. Confirm TLS/authentication and topic ACLs before connecting controllers.
7. Run the bridge/controller simulator first. Do not connect relay, fan, siren, or gate outputs.
8. Verify `PENDING → ACCEPTED → EXECUTED`, failed acknowledgement, timeout, duplicate event ID, expired command, and offline status.
9. Build firmware without flashing. Review actual GPIO maps, active-high/low polarity, motor limits, emergency stop, and power isolation.
10. Obtain explicit approval before flashing or physically actuating hardware.

## Final demonstration sequence

### 1. House isolation

1. Sign in as Homeowner 1.
2. Confirm only House 1 is present in the house selector and every page shows House 1 context.
3. Attempt a direct API request using a known House 2 or device ID from a controlled test client.
4. Expected: no House 2 inventory is returned and the command receives a not-found/denied response without revealing device state.

### 2. Confirmed kitchen-light command

1. Open Devices and verify Kitchen Light is registered and controller connectivity is Online.
2. Toggle it on.
3. Expected: the control becomes pending; reported state does not change yet.
4. Observe bridge claim and MQTT delivery using the same command ID and expiry.
5. Publish a simulated acknowledgement before any physical test.
6. Expected: status becomes Executed and the reported `on` state changes only after acknowledgement.

### 3. Nexora browser voice

1. Open Nexora AI and confirm the selected house name and connection state.
2. Grant microphone permission, then say “Turn off the bedroom light.”
3. If browser speech is unavailable, use the identical text command.
4. Expected: Nexora identifies only the authorized registered light, submits through the same command API, and reports pending followed by the terminal acknowledgement.

### 4. Security and simulated intrusion

1. Open Security and arm House 1 using an authorized account.
2. Expected: the versioned mode update is confirmed by the backend.
3. Through the gateway simulator, submit an ultrasonic or PIR event with the real registered sensor ID, House 1 scope, unique event ID, timestamp, and severity.
4. Expected: the event appears in House 1 history and is not visible to Homeowner 2.
5. Resubmit the same event ID.
6. Expected: ingestion acknowledges it idempotently without creating a duplicate.
7. Local siren response may be demonstrated only after firmware policy and wiring are independently verified.

### 5. Gate lifecycle

1. Sign in as a user with `can_control_gate` for the estate.
2. Confirm the gate controller is Online and physical position reads Unverified.
3. Request Open and approve the confirmation dialog.
4. Expected: Pending/Accepted appears until the simulator sends a matching acknowledgement.
5. Demonstrate Stop through the registered gate-control capability.
6. Demonstrate a timeout and confirm the UI does not automatically retry Open or Close.
7. Physical gate movement requires an attended safety check, verified limits, clear entrance, and separate approval.

### 6. Offline controller

1. Submit a scoped gateway status event marking a test device Offline, or stop the simulator cleanly if it publishes Last Will status.
2. Expected: the dashboard displays Offline and server-side command submission returns `DEVICE_OFFLINE` without adding a movement/power command.

## MQTT and firmware compatibility findings

The documented topic contract is `smartestate/v1/{scopeId}/{deviceId}/{command|ack|state|status|event}`, QoS 1, non-retained commands/acknowledgements, retained state/status where appropriate, command UUIDs, issue/expiry timestamps, and controller-side duplicate rejection. The cloud gateway endpoints preserve gateway/device/scope matching and event-ID idempotency.

Compatibility cannot be certified because the actual bridge, broker ACL, and firmware sources are absent. Before hardware use, verify exact JSON schemas, topic construction, maximum clock skew, NTP failure behavior, persistent command-ID deduplication, offline buffering, Last Will behavior, and that expired or previously acknowledged gate commands are never replayed.

## Stop conditions

Stop the demonstration immediately if authorization scope is unexpected, a device identity does not match the physical label, reported connectivity is stale, the gate limit/stop circuit is unverified, a command is replayed, a relay powers up active, or an acknowledgement changes state for the wrong command ID.
