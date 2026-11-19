# Nexora IoT bridge

Persistent Node.js worker for Railway. It has no Next.js dependency and no direct database access.

Cloud contracts:

- `GET /api/iot/v1/commands?limit=N` → `{commands:[{commandId,controllerId,scopeId,deviceId,type,parameters,issuedAt,expiresAt}]}`.
- `POST /api/iot/v1/events` with `{events:[{eventId,scopeId,deviceId,kind,receivedAt,body}]}` → `{acceptedEventIds:string[]}`.
- `POST /api/iot/v1/controllers/{controllerId}/heartbeat` with firmware, boot, sequence, uptime, Wi-Fi SSID/RSSI, MQTT/clock and readiness summaries. Password fields are neither accepted nor forwarded.
- `GET /api/iot/v1/bridge/sync` → authorized controller/device registry, current security modes, and revoked IDs.

Every request sends `Authorization: Bearer ...` and `X-Iot-Gateway-Id`. MQTT uses TLS verification, a separate bridge identity, QoS 1 and non-retained commands/security messages.

Run locally with `npm ci`, `npm test`, `npm run typecheck`, and `npm run build`. Copy `.env.example` only into a secret-managed local environment; never commit the resulting file.
