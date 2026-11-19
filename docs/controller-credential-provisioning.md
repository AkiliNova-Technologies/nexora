# Controller MQTT credential provisioning

Pairing and broker provisioning are separate transactions.

1. An estate administrator registers hardware identity/proof hash, same-estate houses, and a single-use challenge.
2. The controller proves possession over HTTPS. Success remains registration and credential provisioning `PENDING`.
3. An authorized provisioner generates a unique username and at least 32 random bytes, stores plaintext only in the broker secret store and one-time encrypted delivery envelope, and stores only an opaque reference/version in PostgreSQL.
4. `generate-config.mjs` hashes passwords with `mosquitto_passwd` and emits exact ACLs. The bridge has a separate identity.
5. After broker validation and secure one-time delivery, the provisioner marks registration complete and audits the version. Phase 4 implements captive-portal delivery.

Passwords never travel over MQTT or appear in logs, PostgreSQL, Git, or browser variables. The example registry has fixture identities only.

Revocation is fail closed: mark revoked in Nexora, remove the identity, regenerate configuration, and restart/redeploy Mosquitto so existing sessions terminate. A password-file edit alone is insufficient for a connected session.
