# MQTT TLS and certificates

Use `mqtt.<project-owned-domain>` as a DNS-only CNAME to Railway's generated TCP proxy hostname and connect on Railway's generated proxy port. Mosquitto presents a publicly trusted certificate whose SAN contains the owned name. Railway's automatic HTTPS certificate does not terminate raw MQTT.

The broker listener is TLS-only on internal port 8883. Anonymous access and public plaintext 1883 are absent. ESP32 firmware must trust the issuer, verify the chain and exact hostname, and synchronize time before TLS. The bridge supplies `MQTT_CA_FILE`; certificate verification cannot be disabled.

Automate issuance/renewal with ACME DNS-01 outside the broker or an approved init job. Mount certificate/key read-only, alert at 30/14/7 days, validate the new chain before restart, and keep the last usable certificate for rollback. Never commit keys, certificates, passwords, or generated credential files.

Local tests use a dedicated test CA and a `mosquitto` SAN only. Never trust it on real devices. Negative tests cover untrusted CA, wrong hostname, anonymous access and plaintext access.
