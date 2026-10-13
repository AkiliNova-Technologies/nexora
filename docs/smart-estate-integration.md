# Smart Estate integration contract

This document describes the frontend foundation implemented before the Spring Boot, SSE, MQTT, and ESP32 layers exist.

## Domain model

`House` owns `Room` and `Device` records. A device always has a stable `id` and `houseId`, and may have a `roomId`. `Device` contains metadata and capabilities; `DeviceState` contains connectivity plus desired and reported state. Display names are never identifiers.

The centralized definitions are in `src/domain/smart-estate.ts`. The initial records and states are in `src/data/mock-smart-estate.ts`.

## Device types and capabilities

Supported types are light, fan, thermostat, smart plug, camera, contact sensor, motion sensor, lock, blind, speaker, temperature sensor, and humidity sensor.

Commands are enabled by capabilities, not merely by device type:

| Capability | Commands |
| --- | --- |
| `POWER` | `TURN_ON`, `TURN_OFF` |
| `BRIGHTNESS` | `SET_BRIGHTNESS` within its declared range |
| `FAN_SPEED` | `SET_FAN_SPEED` within its declared range |
| `TARGET_TEMPERATURE` | `SET_TARGET_TEMPERATURE` within its declared range |
| `LOCK` | `LOCK`, `UNLOCK` |
| `POSITION` | `OPEN`, `CLOSE`, `STOP` |
| `CAMERA_RECORDING` | `START_RECORDING`, `STOP_RECORDING` |

`CAMERA_STREAM` describes a readable feature and does not currently create an actuator command.

## Command lifecycle

```text
IDLE → PENDING → ACCEPTED → EXECUTED
                          ↘ FAILED
                          ↘ TIMEOUT
```

- `PENDING`: the frontend created and validated the request.
- `ACCEPTED`: the adapter accepted it for processing. This is not physical success.
- `EXECUTED`: a simulator now, and later an ESP32 acknowledgment, confirms execution.
- `FAILED`: execution failed and reported state remains unchanged.
- `TIMEOUT`: no terminal confirmation arrived before the deadline.

Desired state changes at `PENDING`. Reported state changes only at `EXECUTED`. Failed and timed-out commands clear desired state without changing reported state.

## Shared state and simulation

`DeviceStore` is a small framework-independent external store. `DeviceStateProvider` exposes one instance through React context, and `useDevices` subscribes with `useSyncExternalStore`. Because the provider wraps the App Router root, Devices, Rooms, and Security consume the same records and state.

`MockDeviceSimulator` is the only simulated execution adapter. UI components do not contain fake timers. It emits acceptance and a configurable terminal result, making success, failure, and timeout behavior independently testable. Replacing this adapter and the mock repositories with REST/SSE implementations must not change capability or state semantics.

## Data access boundary

`HouseRepository`, `RoomRepository`, and `DeviceRepository` define the read boundary. Their initial implementations read centralized in-memory data. Future REST implementations should satisfy the same interfaces or an intentionally versioned replacement.

## Planned REST API

All paths use `/api/v1`:

```text
POST /auth/register
POST /auth/login
POST /auth/logout
GET  /me
GET  /houses
GET  /houses/{houseId}
GET  /houses/{houseId}/rooms
GET  /houses/{houseId}/devices
GET  /devices/{deviceId}
GET  /devices/{deviceId}/state
POST /devices/{deviceId}/commands
GET  /houses/{houseId}/dashboard
GET  /houses/{houseId}/events
```

TypeScript request/response and SSE models live in `src/lib/api/contracts.ts`. This phase does not call these endpoints or create fake HTTP routes.

Command request example:

```json
{
  "command": "SET_BRIGHTNESS",
  "parameters": { "value": 70 },
  "clientRequestId": "client-generated-uuid"
}
```

The backend must authenticate the user, verify house ownership, resolve the device's house itself, validate the capability and value, persist the lifecycle, and return a command whose initial status is normally `ACCEPTED`.

## Planned SSE events

The browser will connect to `GET /api/v1/houses/{houseId}/events`. Initial event types are `device.state.changed` and `device.command.updated`, defined by `SmartEstateEvent`.

```json
{
  "type": "device.state.changed",
  "houseId": "house-nexora-demo",
  "deviceId": "dev-living-lights",
  "state": {
    "deviceId": "dev-living-lights",
    "connectivity": "ONLINE",
    "desired": null,
    "reported": { "on": true, "brightness": 70 },
    "commandStatus": "EXECUTED",
    "lastReportedAt": "2026-10-13T10:30:01Z"
  },
  "occurredAt": "2026-10-13T10:30:01Z"
}
```

After reconnecting, the frontend must refetch current state and must not assume missed events can be reconstructed locally.

## Proposed MQTT messages

Topics:

```text
smartestate/v1/{houseId}/{deviceId}/command
smartestate/v1/{houseId}/{deviceId}/ack
smartestate/v1/{houseId}/{deviceId}/state
smartestate/v1/{houseId}/{deviceId}/telemetry
smartestate/v1/{houseId}/{deviceId}/status
```

Command messages include `commandId`, `type`, `parameters`, `issuedAt`, and `expiresAt`. Acknowledgments include the same `commandId`, terminal status, reported state, completion time, and optional error. Commands and acknowledgments use QoS 1 and are not retained. Current state and Last-Will connectivity may be retained. ESP32 firmware must reject expired commands and deduplicate command IDs so reconnects cannot repeat physical actions.

The frontend never connects to MQTT directly.

## Backend expectations

- Enforce `USER → owned house → room → device` for every read and command.
- Treat HTTP acceptance separately from hardware execution.
- Publish only validated, non-expired commands.
- Translate MQTT acknowledgments into persisted command status and SSE events.
- Keep device metadata separate from reported state and telemetry history.
- Return stable IDs and capability ranges matching these frontend models.
- Never retain actuator command topics.

## Remaining gaps

- Authentication and house selection are not implemented.
- No HTTP or SSE adapter exists yet.
- State is in memory and resets on full reload.
- Dashboard, analytics, energy, automations, alerts, account data, and most security actions remain mocked.
- Camera feed, speaker playback, blinds, scenes, schedules, gate control, and physical safety feedback remain future work.
- The simulator currently defaults to successful execution; failure and timeout are exercised through injected test adapters.
