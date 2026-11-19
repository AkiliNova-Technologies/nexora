#!/bin/sh
set -eu
umask 077

install -d -m 0700 /run/secrets

materialize_secret() {
  variable=$1
  destination=$2
  if [ -s "$destination" ]; then return; fi
  value=$(printenv "$variable" || true)
  if [ -z "$value" ]; then echo "Required secret source is missing: $variable" >&2; exit 1; fi
  temporary="${destination}.tmp.$$"
  if ! printf '%s' "$value" | base64 -d >"$temporary" || [ ! -s "$temporary" ]; then
    rm -f "$temporary"
    echo "Required secret source is invalid: $variable" >&2
    exit 1
  fi
  chmod 0600 "$temporary"
  mv "$temporary" "$destination"
}

materialize_secret MQTT_CERT_PEM_B64 /run/secrets/mqtt-cert.pem
materialize_secret MQTT_KEY_PEM_B64 /run/secrets/mqtt-key.pem
materialize_secret MQTT_CA_PEM_B64 /run/secrets/mqtt-ca.pem
materialize_secret MQTT_CONTROLLER_REGISTRY_JSON_B64 /run/secrets/controller-registry.json
materialize_secret MQTT_CREDENTIALS_JSON_B64 /run/secrets/mqtt-credentials.json
unset MQTT_CERT_PEM_B64 MQTT_KEY_PEM_B64 MQTT_CA_PEM_B64 MQTT_CONTROLLER_REGISTRY_JSON_B64 MQTT_CREDENTIALS_JSON_B64

install -d -m 0700 -o mosquitto -g mosquitto /mosquitto/data /mosquitto/config
node /opt/nexora/tools/generate-config.mjs /run/secrets/controller-registry.json /run/secrets/mqtt-credentials.json /mosquitto/config
cp /mosquitto/config/mosquitto.conf.template /mosquitto/config/mosquitto.conf
cp /run/secrets/mqtt-cert.pem /run/secrets/mqtt-key.pem /run/secrets/mqtt-ca.pem /mosquitto/config/
chown mosquitto:mosquitto /mosquitto/config/passwords /mosquitto/config/acl /mosquitto/config/mosquitto.conf /mosquitto/config/mqtt-cert.pem /mosquitto/config/mqtt-key.pem /mosquitto/config/mqtt-ca.pem /mosquitto/data
chmod 0600 /mosquitto/config/passwords /mosquitto/config/acl /mosquitto/config/mosquitto.conf /mosquitto/config/mqtt-cert.pem /mosquitto/config/mqtt-key.pem /mosquitto/config/mqtt-ca.pem
exec su-exec mosquitto mosquitto -c /mosquitto/config/mosquitto.conf
