# IoT bridge recovery

Command flow is `PENDING (cloud) → CLAIMED (SQLite) → PUBLISHING → PUBLISHED → TERMINAL`. Cloud claiming is atomic and gateway-scoped. Before MQTT publication the bridge durably records identity, scope, type, expiry and payload. QoS 1 PUBACK advances only to `PUBLISHED`; only a controller acknowledgement can establish execution.

If publication throws or restart occurs during `PUBLISHING`, the record becomes `UNCERTAIN` and is never automatically republished. Gate and siren commands require authoritative physical reconciliation or expiry. A crash after cloud claim but before local recording also fails safe: the accepted command is not reclaimed.

Inbound QoS 1 device events use MQTT 5 custom acknowledgement handling: they are validated and inserted by original ID before PUBACK is returned. Storage or capacity failure withholds success so the broker can redeliver. Duplicates are ignored. Batches are deleted only when the cloud returns accepted IDs; failures receive bounded backoff. SQLite at `/data/bridge.sqlite` uses WAL, foreign keys, full synchronous writes and a busy timeout. Heartbeats are not durably queued; any buffered heartbeat older than the 35-second freshness threshold is acknowledged and discarded rather than forwarded with a new server receipt time.

Security checkpoints retain the highest delivered version per controller/scope. Sync/reconnect publishes only current, unexpired, higher versions as non-retained messages. Historical modes are not replayed.
