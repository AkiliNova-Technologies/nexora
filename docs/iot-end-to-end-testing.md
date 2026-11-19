# IoT end-to-end testing

```bash
cd infrastructure/bridge
npm ci
npm test
npm run typecheck
npm run build
```

Broker image/config and full MQTT integration require Docker. Docker was unavailable during Phase 3, so those tests remain blocked rather than reported as passed. Use fixture IDs and a test CA; do not alter the system Mosquitto.

Migration execution requires a disposable Supabase-compatible database containing the Nexora schema and two fixture `auth.users` rows:

```bash
NEXORA_ALLOW_ISOLATED_DB_VALIDATION=yes \
ISOLATED_DATABASE_URL='postgresql://.../disposable_database' \
./scripts/validate-controller-migration.sh
```

The required simulated matrix includes light/fan round trips, unrelated identities, expired/duplicate commands, bridge/broker restarts, cloud outage, durable recovery, revoked live sessions, TLS/hostname/anonymous denial, gate accepted versus executed, uncertain-command non-replay, security versions, heartbeat freshness, event identity, and storage failure. None constitutes physical ESP32 or production verification.
