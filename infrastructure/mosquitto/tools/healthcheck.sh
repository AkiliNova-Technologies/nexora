#!/bin/sh
set -eu
test -s /mosquitto/config/passwords
test -s /mosquitto/config/acl
test -s /mosquitto/config/mqtt-cert.pem
pidof mosquitto >/dev/null
