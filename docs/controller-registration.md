# Controller registration and pairing

Administrator API foundation:

- `GET /api/v1/controllers?estateId=...`
- `POST /api/v1/controllers`
- `GET /api/v1/controllers/{id}`
- `POST /api/v1/controllers/{id}/pairing-challenges`
- `POST /api/v1/controllers/{id}/houses`
- `POST /api/v1/controllers/{id}/revoke`
- Controller pairing: `POST /api/iot/v1/controllers/pair`
- Gateway heartbeat: `POST /api/iot/v1/controllers/{id}/heartbeat`

Registration stores a hardware identity and SHA-256 hash of a distinct proof-of-possession secret, never the secret. A challenge is random, ten-minute, single-use, estate-bound, attempt-limited and rate-limited. Pairing verifies both challenge and proof. Success remains `registration_state=PENDING` and returns `credentialProvisioning=PENDING`; it does not fabricate MQTT credentials.

The migration adds controller, controller-house, pairing, lifecycle-event, estate-security-event and security-mode synchronization tables. Database triggers reject controller/house/estate/gateway inconsistency.

Production reconciliation must first confirm `house-ae-1-block` is House 1. House 2 remains omitted. A manifest may contain the House 1 lights, fan and ultrasonic plus estate PIRs, strip, siren and gate; House 2 devices remain pending rather than assigned elsewhere.
