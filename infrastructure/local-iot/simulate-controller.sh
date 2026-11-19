#!/bin/sh
set -eu
sleep 5
mosquitto_sub -h mosquitto -p 8883 --cafile /run/secrets/mqtt-ca.pem -u controller-fixture-01 -P controller-password-fixture-only-000000000 -t smartestate/v1/house-fixture-01/light-fixture-01/command -q 1 -C 1 | while IFS= read -r command; do
  command_id=$(printf '%s' "$command" | sed -n 's/.*"commandId":"\([^"]*\)".*/\1/p')
  event_id="controller-fixture-01:fixture-boot:1"
  payload="{\"eventId\":\"$event_id\",\"commandId\":\"$command_id\",\"status\":\"EXECUTED\",\"reported\":{\"on\":true},\"occurredAt\":\"2026-01-01T00:00:00Z\"}"
  mosquitto_pub -h mosquitto -p 8883 --cafile /run/secrets/mqtt-ca.pem -u controller-fixture-01 -P controller-password-fixture-only-000000000 -t smartestate/v1/house-fixture-01/light-fixture-01/ack -q 1 -m "$payload"
done
