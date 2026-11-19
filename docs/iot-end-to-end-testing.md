# IoT end-to-end testing

```bash
cd infrastructure/bridge
npm ci
npm test
npm run typecheck
npm run build
```

Phase 3B used the native Docker Engine `default` context and the already-installed Mosquitto 2.0.22 image. Docker Hub pulls were unavailable because the daemon selected an unreachable IPv6 route, so the bridge and mock HTTPS cloud ran as isolated host processes while the real broker ran loopback-only in Docker. The existing `smart-estate-iot` containers, images and volumes were not altered.

Migration execution requires a disposable Supabase-compatible database containing the Nexora schema and two fixture `auth.users` rows:

```bash
NEXORA_ALLOW_ISOLATED_DB_VALIDATION=yes \
ISOLATED_DATABASE_URL='postgresql://.../disposable_database' \
./scripts/validate-controller-migration.sh
```

Actual Phase 3B results are recorded in `docs/iot-phase-3b-validation.md`. None constitutes physical ESP32 or production verification.
