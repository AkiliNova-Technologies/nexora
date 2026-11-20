# Nexora IoT protocol v1

Status: implemented contract; Railway transport is not deployed and hardware is not commissioned.

## Identity and topics

Every logical device is registered to one immutable controller, one gateway, and exactly one house or estate scope. Device topics remain:

`smartestate/v1/{scopeId}/{deviceId}/{command|ack|state|status|event}`

Controller topics are deliberately narrow:

- Publish: `smartestate/v1/controllers/{controllerId}/heartbeat`
- Subscribe: `smartestate/v1/controllers/{controllerId}/security-mode`
- Subscribe: `smartestate/v1/controllers/{controllerId}/provisioning`
- Publish: `smartestate/v1/controllers/{controllerId}/provisioning/ack`

ACLs must enumerate the controller's registered topics. A controller must not receive `#`, another controller's topics, or both houses merely because it shares an estate.

Provisioning uses a non-retained `OPEN_PROVISIONING_WINDOW` envelope with a UUID `commandId`, an absolute `expiresAt` no more than ten minutes ahead, and `parameters.durationSeconds` from 60 through 600. The controller durably rejects the last processed window command, opens only its controller-specific WPA2 setup network, and still requires the local proof of possession before accepting a Wi-Fi profile. The candidate profile is committed only after both Wi-Fi and MQTT succeed; otherwise the prior NVS profile is restored. Wi-Fi credentials are never sent through MQTT or the cloud API.

## Common rules

- JSON UTF-8, maximum firmware command payload 4096 bytes.
- Commands, acknowledgements, state, events and heartbeats: QoS 1, not retained.
- Device status: QoS 1, retained. Commands and security modes must not be retained.
- UTC RFC 3339 `issuedAt`/`expiresAt`; firmware rejects expired commands and commands while its clock is unsynchronized.
- `eventId = {controllerId}:{bootId}:{monotonicSequence}` for firmware-originated observations. Acknowledgement identity is `{commandId}:{lifecycle}`.
- The bridge preserves IDs across retries and uses a durable queue.

## Commands and acknowledgements

```json
{"commandId":"uuid","type":"TURN_ON","parameters":{},"issuedAt":"RFC3339","expiresAt":"RFC3339"}
```

Canonical gate types are `OPEN`, `CLOSE`, `STOP`, `GET_GATE_STATUS`. `OPEN_GATE` and `CLOSE_GATE` are temporary migration aliases. Gate `ACCEPTED` means motion began; only the matching physical limit produces `EXECUTED`. Contradictory limits, timeout, or fault produce `FAILED`. STOP reports `OPEN`, `CLOSED`, or `UNKNOWN`; direction and elapsed time never establish position.

Acknowledgements contain `eventId`, `commandId`, `status`, optional `error`, optional authoritative `reported`, and `occurredAt`. Lifecycle is `PENDING → ACCEPTED → EXECUTED | FAILED | TIMEOUT`. Desired state is not reported state.

## Capabilities

- House light: `POWER`, optional `BRIGHTNESS`.
- House fan: `POWER`, optional `FAN_SPEED`; the current fan belongs to House 1.
- PIR/ultrasonic: observations only.
- RGB strip: `POWER`, `BRIGHTNESS`, `RGB_COLOR` (`SET_RGB` uses integer `r/g/b` 0–255).
- Siren: `SIREN_CONTROL`; `ACTIVATE_SIREN` requires `durationSeconds` within the registered firmware maximum, and `STOP_SIREN` is explicit.
- Gate: `GATE_CONTROL`.

Only house-scoped lights and fans with effective homeowner command permission are Alexa eligible.

## State, status, and heartbeat

State contains `eventId`, `reported`, and `occurredAt`. Status is one of `ONLINE`, `OFFLINE`, `UNAVAILABLE`, `DEGRADED`, `UNKNOWN`. Controller reachability and device readiness are separate.

Heartbeat contains controller ID, firmware and boot IDs, sequence, uptime, Wi-Fi connected/SSID/RSSI, MQTT and clock state, readiness summary, device summary, event ID, and occurrence time. Server receipt time controls last-seen. Defaults: publish 15 s, stale/degraded after 35 s, offline after 50 s.

## Security

Security-mode messages contain `scopeId`, `mode`, strictly increasing `version`, `issuedAt`, and `expiresAt`. They are authenticated by controller-specific broker ACLs, non-retained, expiry checked, and ignored if stale. Reboot starts all zones `UNKNOWN`; fresh state must restore them. Valid local policy may continue during a network outage, but unverified sensors remain disabled.

House ultrasonic events stay house-scoped. Both PIRs and the siren are estate-scoped. Estate events are stored in `estate_security_event`, never assigned to an arbitrary house.

## Recovery

The bridge may redeliver idempotent state/status. It must not blindly replay an uncertain gate or siren command. Firmware uses bounded command deduplication; durable non-idempotent command recovery remains a commissioning requirement before physical gate enablement.
