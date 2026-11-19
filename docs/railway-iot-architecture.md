# Railway IoT architecture

Status: implemented locally and deployment-ready; not provisioned, deployed, or physically verified.

The Vercel application and Supabase remain authoritative. `nexora-iot-bridge` is a persistent worker: it claims commands over the authenticated gateway API, records each claim in SQLite, publishes QoS 1/non-retained MQTT, receives controller observations, and forwards stable event IDs from its durable queue. `nexora-mqtt` is Mosquitto with a TLS-only listener, controller-specific passwords, generated exact-topic ACLs, and a persistence volume.

Controller and device identity comes from `GET /api/iot/v1/bridge/sync`. A bridge may only publish or consume topics enumerated for its gateway. The broker separately enforces the same boundary. The bridge has no database credential and no homeowner session.

## Service boundaries

- Vercel: gateway APIs; `IOT_GATEWAY_ID` and `IOT_GATEWAY_CREDENTIAL` stay server-only.
- Supabase: controllers, assignments, commands, events, heartbeats, and security modes.
- Railway broker: `/mosquitto/data` volume, certificate/key/CA and generated password/ACL files.
- Railway bridge: `/data/bridge.sqlite`; private broker DNS and public Vercel HTTPS API.
- ESP32: public raw-TCP proxy using MQTT over TLS; its unique credential and trusted CA only.

Railway HTTP domains are not MQTT endpoints. A raw TCP proxy assigns a hostname and port. Private service DNS is suitable for bridge-to-broker traffic. Mosquitto terminates MQTT TLS end to end.

The worker exposes `/healthz` and `/readyz`. SQLite uses WAL and full synchronous writes. A crash while publication is in progress changes the record to `UNCERTAIN` on restart and it is not republished. MQTT PUBACK only means broker acceptance; only controller `EXECUTED` is physical completion.

Controller reachability comes from server receipt of 15-second heartbeats (degraded at 35 seconds, offline at 50 seconds). Device availability remains separate. Security modes are non-retained, expiring, monotonic, and refreshed after reconnect.

Broker credential activation remains intentionally pending until Railway secret storage and an authorized provisioning operator exist. Pairing remains `credentialProvisioning=PENDING`. Revocation removes the identity and restarts/redeploys Mosquitto to terminate existing sessions. Phase 4 supplies captive-portal credential delivery.
