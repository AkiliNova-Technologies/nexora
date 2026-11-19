#!/bin/sh
set -eu
apk add --no-cache openssl >/dev/null
umask 077
openssl req -x509 -newkey rsa:2048 -nodes -days 2 -subj /CN=Nexora-Test-CA -keyout /out/ca-key.pem -out /out/mqtt-ca.pem >/dev/null 2>&1
openssl req -newkey rsa:2048 -nodes -subj /CN=mosquitto -keyout /out/mqtt-key.pem -out /out/server.csr >/dev/null 2>&1
printf 'subjectAltName=DNS:mosquitto,DNS:mock-cloud\nextendedKeyUsage=serverAuth\n' >/out/extensions
openssl x509 -req -days 2 -in /out/server.csr -CA /out/mqtt-ca.pem -CAkey /out/ca-key.pem -CAcreateserial -extfile /out/extensions -out /out/mqtt-cert.pem >/dev/null 2>&1
cp /out/mqtt-key.pem /out/cloud-key.pem
cp /out/mqtt-cert.pem /out/cloud-cert.pem
cat >/out/controller-registry.json <<'EOF'
{"bridge":{"username":"bridge-fixture"},"controllers":[{"controllerId":"controller-fixture-01","username":"controller-fixture-01","devices":[{"scopeId":"house-fixture-01","deviceId":"light-fixture-01"}]}]}
EOF
cat >/out/mqtt-credentials.json <<'EOF'
{"users":[{"username":"bridge-fixture","password":"bridge-password-fixture-only-000000000000"},{"username":"controller-fixture-01","password":"controller-password-fixture-only-000000000"}]}
EOF
chmod 0444 /out/mqtt-ca.pem /out/mqtt-cert.pem /out/cloud-cert.pem /out/controller-registry.json /out/mqtt-credentials.json
chmod 0400 /out/mqtt-key.pem /out/cloud-key.pem
