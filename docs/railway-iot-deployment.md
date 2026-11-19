# Railway IoT deployment

Status: owner runbook; do not execute until infrastructure creation is approved.

1. Validate `20261119150000_controller_management.sql` against a disposable production-schema snapshot.
2. Create one Railway project/environment in the selected region.
3. Create `nexora-mqtt` from `infrastructure/mosquitto`, mount `/mosquitto/data`, and provide the five `/run/secrets/*` files in its `.env.example` through an approved secret bootstrap.
4. Create a raw TCP proxy for internal port 8883. The externally assigned port may differ.
5. Set DNS-only `mqtt.<owned-domain>` as CNAME to the TCP proxy hostname and install a certificate whose SAN matches the owned name.
6. Create `nexora-iot-bridge` from `infrastructure/bridge`, mount `/data`, and set its `.env.example` variables. Use private broker DNS with `mqtts://...:8883`.
7. Set the bridge HTTP health check to `/readyz` on `BRIDGE_HEALTH_PORT`.
8. Apply the reviewed migration and Vercel variables only in a separately authorized release window.

Set `PORT` equal to `BRIDGE_HEALTH_PORT`, because Railway uses `PORT` for HTTP health checks. Configure `RAILWAY_DEPLOYMENT_DRAINING_SECONDS` (for example 30) so SIGTERM shutdown can flush safely. Select `Always` restart policy on a paid plan, or `On Failure` where plan limits apply. Services with volumes have brief deployment downtime and cannot use overlapping mounts.

Dashboard workflow: create two GitHub services, set each root directory and Dockerfile, variables, volumes, networking and restart policy. Discover CLI syntax with `railway --help`; current CLI documents `railway tcp-proxy create --port 8883 --service nexora-mqtt`. Always verify the linked project/environment before a deploy.

Railway supports raw TCP proxies, custom DNS CNAMEs, private service DNS, Dockerfiles and volumes. TCP custom domains still use the Railway-assigned port; Cloudflare must be DNS-only. HTTP health checks gate deployments, so the worker exposes HTTP readiness while broker diagnostics use container health/logs.

Current rates are $10/GB-month RAM, $20/vCPU-month CPU, $0.15/GB-month volume and $0.05/GB egress. Hobby has a $5 monthly minimum/credit model. Budget roughly $10–25/month for two small always-on services before measurement, plus domain/certificate automation. Reconfirm pricing at deployment.

Rollback: stop onboarding, disable the public TCP proxy, revoke identities, stop the bridge, preserve both volumes, and roll Vercel back independently. Use a forward database fix; do not drop additive production tables. Never replay uncertain gate/siren records.

Owner actions: own the MQTT DNS name, choose a region, create services/volumes and spending alerts, provision/monitor the certificate, set secrets only in server services, validate hostname trust externally, review generated ACLs, then authorize Phase 4 onboarding.

## Variable ownership

- Vercel only: `IOT_GATEWAY_ID`, `IOT_GATEWAY_CREDENTIAL`, existing `DATABASE_URL` and existing Supabase/Alexa variables. No MQTT private key belongs in browser-prefixed variables.
- Bridge only: `NEXORA_API_BASE_URL`, `NEXORA_GATEWAY_ID`, `NEXORA_GATEWAY_CREDENTIAL`, `MQTT_URL`, `MQTT_USERNAME`, `MQTT_PASSWORD`, `MQTT_CA_FILE`, `MQTT_TLS_SERVERNAME`, `BRIDGE_STORE_PATH`, `BRIDGE_POLL_INTERVAL_MS`, `BRIDGE_MAX_BACKOFF_MS`, `BRIDGE_HEALTH_PORT`, `PORT`, `BRIDGE_MAX_PAYLOAD_BYTES`, `BRIDGE_MAX_QUEUED_EVENTS`, `BRIDGE_EVENT_RETENTION_DAYS`, and `RAILWAY_DEPLOYMENT_DRAINING_SECONDS`.
- Broker secret files: `mqtt-cert.pem`, `mqtt-key.pem`, `mqtt-ca.pem`, `controller-registry.json`, and `mqtt-credentials.json`; volume `/mosquitto/data`.
- ESP32 provisioning: public MQTT hostname, Railway-assigned TCP port, trusted CA, controller ID, controller-specific username and one-time password. Never a bridge/gateway/database credential.
