#!/bin/sh
set -eu
umask 077

ca_file=${MQTT_CA_FILE:-/run/secrets/mqtt-ca.pem}
materialized_ca=false
if [ ! -s "$ca_file" ]; then
  ca_value=$(printenv MQTT_CA_PEM_B64 || true)
  if [ -z "$ca_value" ]; then echo "Required secret source is missing: MQTT_CA_PEM_B64" >&2; exit 1; fi
  install -d -m 0700 -o bridge -g bridge "$(dirname "$ca_file")"
  temporary="${ca_file}.tmp.$$"
  if ! printf '%s' "$ca_value" | base64 -d >"$temporary" || [ ! -s "$temporary" ]; then
    rm -f "$temporary"
    echo "Required secret source is invalid: MQTT_CA_PEM_B64" >&2
    exit 1
  fi
  chmod 0600 "$temporary"
  mv "$temporary" "$ca_file"
  materialized_ca=true
fi
unset MQTT_CA_PEM_B64
if [ "$materialized_ca" = true ]; then chown bridge:bridge "$ca_file"; fi

store_path=${BRIDGE_STORE_PATH:-/data/bridge.sqlite}
store_dir=$(dirname "$store_path")
install -d -m 0700 -o bridge -g bridge "$store_dir"
exec gosu bridge node dist/main.js
