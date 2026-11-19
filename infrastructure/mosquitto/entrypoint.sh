#!/bin/sh
set -eu
umask 077

for required in /run/secrets/mqtt-cert.pem /run/secrets/mqtt-key.pem /run/secrets/mqtt-ca.pem /run/secrets/controller-registry.json /run/secrets/mqtt-credentials.json; do
  if [ ! -s "$required" ]; then echo "Required secret file is missing: $required" >&2; exit 1; fi
done

install -d -m 0700 -o mosquitto -g mosquitto /mosquitto/data /mosquitto/config
node /opt/nexora/tools/generate-config.mjs /run/secrets/controller-registry.json /run/secrets/mqtt-credentials.json /mosquitto/config
cp /mosquitto/config/mosquitto.conf.template /mosquitto/config/mosquitto.conf
cp /run/secrets/mqtt-cert.pem /run/secrets/mqtt-key.pem /run/secrets/mqtt-ca.pem /mosquitto/config/
chown mosquitto:mosquitto /mosquitto/config/passwords /mosquitto/config/acl /mosquitto/config/mosquitto.conf /mosquitto/config/mqtt-cert.pem /mosquitto/config/mqtt-key.pem /mosquitto/config/mqtt-ca.pem /mosquitto/data
chmod 0600 /mosquitto/config/passwords /mosquitto/config/acl /mosquitto/config/mosquitto.conf /mosquitto/config/mqtt-cert.pem /mosquitto/config/mqtt-key.pem /mosquitto/config/mqtt-ca.pem
exec su-exec mosquitto mosquitto -c /mosquitto/config/mosquitto.conf
