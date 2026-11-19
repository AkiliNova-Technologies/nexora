# Railway IoT architecture

Status: prepared, not provisioned.

Deploy two services: a persistent Mosquitto broker and a persistent Nexora bridge. The bridge reaches Mosquitto over Railway private networking and calls Vercel over HTTPS. ESP32 controllers reach only a TLS-protected public TCP endpoint.

Railway supports raw TCP Proxy endpoints and private service networking, but an automatically supplied Railway HTTP domain is not a raw MQTT endpoint. TCP proxy hostname/port and certificate hostname must be verified together. Railway documents custom-domain TCP proxying; use a project-owned DNS name and a certificate whose SAN matches it if the generated TCP hostname cannot satisfy broker certificate renewal and ESP32 verification. [Railway TCP Proxy](https://docs.railway.com/networking/tcp-proxy)

Requirements:

- Broker: TLS-only public listener, controller-specific password identities, explicit ACL, persistence volume, health check, no anonymous or public port 1883.
- Bridge: private broker URL, separate backend MQTT identity, Vercel gateway ID/credential, durable event queue volume, bounded claim loop, retry with stable event IDs, health/readiness endpoint.
- Certificates: automated issuance/renewal, full chain, hostname validation, CA bundle embedded or securely updated on ESP32, expiry alerting.
- Restart: broker persistence retains required status/session data; bridge resumes its durable queue and never invents event IDs or replays uncertain actuator commands.
- Reconciliation: compare registered controller/device inventory, broker ACL generation, queue depth, oldest command age, last heartbeat and revoked credentials.

Secrets: broker admin/bootstrap secret, per-controller generated credentials, bridge MQTT credential, Vercel gateway credential, database URL only if the bridge design later requires it (it should not), TLS private key, and certificate renewal credentials. None are browser variables.

Begin with roughly 0.5–1 vCPU and 512 MB per service plus small persistent volumes; measure retained messages, connections, queue size and regional latency before resizing. Select a region balancing the estate's MQTT RTT and Vercel/Supabase HTTPS RTT.

Broker-side revocation and Railway spending remain pending a separate approved deployment phase.
