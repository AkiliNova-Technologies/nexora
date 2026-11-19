# Phase 3B infrastructure validation

Date: 2026-11-19. Scope: isolated local fixtures only. No production record, credential, deployment, MQTT topic or physical device was touched.

## Environment

The native Docker Engine was healthy on the `default` context. Docker Desktop was selected initially but its socket did not exist. The native engine had an unrelated existing `smart-estate-iot` stack; it was inspected but not modified. Initial free space was 8.9 GB and available memory approximately 5.1 GB.

Docker Hub image pulls failed because the daemon chose an unreachable IPv6 registry address. Validation therefore used the existing `eclipse-mosquitto:2.0.22` image, host Node.js 24, and PostgreSQL 17 binaries. The broker bound only to `127.0.0.1:18883`; temporary certificates, databases and SQLite files stayed under `/tmp`.

## Database

The complete checked-in migration order was applied to a disposable PostgreSQL 17 database after a minimal Supabase-compatible `auth.users`, `auth.uid()`, `anon` and `authenticated` bootstrap. The controller migration then passed:

- syntax and dependency ordering;
- RLS administrator visibility and cross-administrator isolation under transaction-local hypothetical grants;
- default browser table/function privilege revocation;
- non-admin siren denial;
- cross-estate controller/house rejection;
- controller/gateway/device consistency rejection;
- expired pairing challenge and duplicate challenge identity rejection;
- Alexa OAuth and website-linking schema preservation;
- fixture rollback; and
- atomic rollback after an intentional post-migration division-by-zero failure (`controller` absent, existing `alexa_connection` present).

Limitation: no authorized production schema-only snapshot was supplied. This proves compatibility with the complete repository migration chain, not with unrepresented production drift. Pairing proof replay/consumption remains additionally enforced and tested in the application service; the database uniquely identifies challenge hashes and constrains expiry but does not independently perform proof consumption.

## TLS, authentication and ACLs

Passed against real Mosquitto:

- trusted test CA and matching SAN;
- wrong CA rejection;
- wrong hostname rejection, including the bridge's explicit TLS identity;
- anonymous and incorrect-password rejection;
- authorized bridge command publication and controller acknowledgement publication;
- unauthorized controller command publication was not delivered;
- controller 01 could not receive controller 02 traffic; and
- revocation removed controller 01, broker restart terminated its established session, and reconnect returned MQTT 5 reason 135 (`Not authorized`).

Mosquitto 2 accepts an unauthorized MQTT 3 publish at the client protocol level and silently drops it; exit status alone is therefore not an ACL proof. The test used an authorized observer and confirmed no delivery. MQTT 5 subscription SUBACK may grant the requested QoS while ACL enforcement still filters actual delivery, so cross-controller validation likewise used a second authorized publisher and checked non-delivery.

## Bridge and simulated flow

Passed through HTTPS mock cloud → actual bridge → TLS Mosquitto → simulated controller → bridge → cloud:

- light command ID `11111111-1111-4111-8111-111111111111`;
- authoritative `EXECUTED` acknowledgement;
- stable event ID across MQTT, SQLite and cloud;
- duplicate acknowledgement collapsed to one accepted cloud event;
- expired command not published;
- cloud outage queued one event; bridge restart retained it; recovery forwarded the original ID and emptied the queue;
- broker restart reconnected and returned readiness;
- stale 120-second heartbeat ignored; one fresh heartbeat forwarded;
- changed boot ID triggered current, non-retained security-mode version 7 delivery; and
- bounded queue capacity fails closed in the bridge test suite.

MQTT.js default handling acknowledged QoS 1 before SQLite insertion. Phase 3B switched the bridge to MQTT 5 custom acknowledgement handling: validated device events are now inserted before PUBACK. Storage failure withholds successful acknowledgement so the broker can redeliver. Heartbeats are not durably queued as events; buffered stale heartbeats are acknowledged and discarded based on `occurredAt`, preventing false online status.

Interrupted `PUBLISHING` command records become `UNCERTAIN` and are never automatically replayed. This behavior is directly covered by the SQLite recovery test. A process crash after cloud claim but before SQLite insertion remains an unavoidable distributed-transaction gap with the current cloud API: the command safely fails without replay but may be lost. Closing it requires a future lease/confirm command API, especially before physical gate or siren commissioning.

## Resources

Observed idle/light-test usage:

- Mosquitto: about 1.8 MiB RAM and 0.04–0.07% CPU.
- Host bridge: about 105 MiB RSS and 1.2% CPU during the test sample.
- Mock cloud: about 58 MiB RSS and 0.6% CPU.
- Temporary Phase 3B files: approximately 117 MiB in `/tmp` including PostgreSQL.

## Readiness

The broker, bridge and checked-in migration are ready for staging preparation, subject to a production schema-only snapshot validation and Railway-owned endpoint/certificate test. Physical gate and siren commissioning is not ready until the cloud claim/SQLite gap has a lease/confirm design or an explicitly approved safe reconciliation workflow. No physical integration was performed.
