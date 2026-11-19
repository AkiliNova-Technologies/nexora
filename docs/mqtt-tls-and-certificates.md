# MQTT TLS and certificates

Use `mqtt.<project-owned-domain>` as a DNS-only CNAME to Railway's generated TCP proxy hostname and connect on Railway's generated proxy port. Mosquitto presents a publicly trusted certificate whose SAN contains the owned name. Railway's automatic HTTPS certificate does not terminate raw MQTT.

The broker listener is TLS-only on internal port 8883. Anonymous access and public plaintext 1883 are absent. ESP32 firmware must trust the issuer, verify the chain and exact hostname, and synchronize time before TLS. The bridge supplies `MQTT_CA_FILE`; certificate verification cannot be disabled.

Automate issuance/renewal with ACME DNS-01 outside the broker or an approved init job. Mount certificate/key read-only, alert at 30/14/7 days, validate the new chain before restart, and keep the last usable certificate for rollback. Never commit keys, certificates, passwords, or generated credential files.

Local tests use a dedicated test CA and a `mosquitto` SAN only. Never trust it on real devices. Negative tests cover untrusted CA, wrong hostname, anonymous access and plaintext access.

## Supported deployment alternatives

**A. Owned hostname and public CA (recommended).** Use a DNS-only CNAME such as `mqtt.example.com` to the Railway TCP proxy hostname. Issue a publicly trusted certificate for the owned name. Controllers connect to the owned name and Railway-assigned port. The bridge connects through Railway private DNS but sets `MQTT_TLS_SERVERNAME=mqtt.example.com`, so SNI and hostname verification remain bound to the certificate identity rather than the private routing name.

**B. Private CA and Railway proxy identity.** After Railway assigns the real TCP proxy hostname, issue a private-CA broker certificate whose SAN is that exact hostname. Controllers embed only the dedicated Nexora MQTT CA and connect to that exact hostname/assigned port. The bridge may route to `nexora-mqtt.railway.internal:8883`, but must set `MQTT_TLS_SERVERNAME` to the actual proxy hostname. Keep the offline CA private key separate from Railway and the broker; mount only the broker leaf key, leaf certificate and public CA. Rotate by shipping an overlap trust bundle to controllers first, then the new broker leaf, and finally removing the old CA after the fleet is confirmed. Never invent the proxy hostname or disable verification.
