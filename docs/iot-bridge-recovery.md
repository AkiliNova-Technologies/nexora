# IoT bridge recovery

Command flow is `PENDING (cloud) → CLAIMED (SQLite) → PUBLISHING → PUBLISHED → TERMINAL`. Cloud claiming is atomic and gateway-scoped. Before MQTT publication the bridge durably records identity, scope, type, expiry and payload. QoS 1 PUBACK advances only to `PUBLISHED`; only a controller acknowledgement can establish execution.

If publication throws or restart occurs during `PUBLISHING`, the record becomes `UNCERTAIN` and is never automatically republished. Gate and siren commands require authoritative physical reconciliation or expiry. A crash after cloud claim but before local recording also fails safe: the accepted command is not reclaimed.

Inbound events are validated then inserted by original ID. Duplicates are ignored. Batches are deleted only when the cloud returns accepted IDs; failures receive bounded backoff. Capacity is explicit and full storage rejects ingestion. SQLite at `/data/bridge.sqlite` uses WAL, foreign keys, full synchronous writes and a busy timeout.

Security checkpoints retain the highest delivered version per controller/scope. Sync/reconnect publishes only current, unexpired, higher versions as non-retained messages. Historical modes are not replayed.
