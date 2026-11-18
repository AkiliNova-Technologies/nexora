# Nexora AI and Alexa Smart Home integration

## Current readiness

The browser assistant remains implemented over the authenticated dashboard inventory and existing device-command lifecycle. Alexa Phase 1 now includes the Smart Home v3 adapter, Nexora OAuth endpoints, signed backend directive endpoint, persistent replay protection, real integration status/revocation UI, and an uploadable Lambda package. See `docs/alexa-phase-1-deployment.md` for the authoritative deployment configuration. No AWS resource, production deployment, database migration, MQTT broker, or physical controller was changed or verified by this implementation.

## Browser voice architecture

The browser widget uses the Web Speech Recognition API for optional speech-to-text and the Web Speech Synthesis API for responses. Text input remains available when either API is unsupported or microphone permission is denied. This is browser voice control; it is not wake-word detection and is not Amazon Alexa.

Commands resolve only against devices returned for the authenticated user and selected house. Device commands use the existing API, database command queue, gateway acknowledgement, and reconciliation path. Gate and security changes require confirmation. Voice recognition is never treated as an additional authentication factor.

## Alexa architecture

The intended production path is:

`Alexa device → Alexa Smart Home skill endpoint (AWS Lambda) → Nexora OAuth access token → trusted Smart Estate control API → PostgreSQL command queue → IoT gateway → MQTT → ESP32 → acknowledgement`

The adapter implements Alexa Smart Home API v3 discovery and `Alexa.PowerController` responses for registered, controllable lights and fans. It exposes `Alexa.EndpointHealth`, returns stable endpoint IDs derived from device IDs, and does not expose gates, sirens, intrusion alarms, security modes, or estate-wide equipment. `src/lib/alexa/lambda-handler.ts` provides the Lambda entry-point factory; deployment must inject the OAuth-aware control implementation described below.

Amazon documentation used for the integration contract:

- Smart Home skill build flow: <https://developer.amazon.com/en-US/docs/alexa/smarthome/steps-to-build-a-smart-home-skill.html>
- Discovery interface: <https://developer.amazon.com/en-US/docs/alexa/device-apis/alexa-discovery.html>
- PowerController: <https://developer.amazon.com/en-US/docs/alexa/device-apis/alexa-powercontroller.html>
- Account linking authorization-code grant: <https://developer.amazon.com/en-US/docs/alexa/account-linking/configure-authorization-code-grant.html>

## Account-linking implementation

Supabase Auth is not automatically an Alexa-compatible OAuth authorization server. Nexora now provides a narrow OAuth 2.0 authorization-code adapter for Alexa, including:

- A registered Alexa OAuth client and exact Amazon redirect URLs.
- Interactive Nexora login and explicit consent.
- One-time, short-lived authorization codes bound to client, redirect URI, state, user, and scopes.
- Server-side code exchange with confidential-client authentication.
- Short-lived access tokens and rotating refresh tokens.
- Token hashing at rest, scope validation, expiry, revocation, and account unlink handling.
- Mapping from token subject to the Nexora user; Amazon identity alone grants no estate access.
- Audit records for linking, discovery, directives, revocation, and correlation IDs.

Persistent grant/token tables are supplied in the additive migration `supabase/migrations/20261118120000_alexa_oauth.sql`; it must be reviewed and applied manually.

## AWS Lambda requirements

Create a Lambda in an Alexa-supported region and configure the Smart Home skill endpoint with its ARN. Bundle the Alexa adapter with a control implementation that:

1. Validates the linked bearer token against the Nexora authorization service.
2. Calls a private Nexora control API over TLS.
3. Supplies token-scoped discovery, command submission, and replay checks to `handleAlexaDirective`.
4. Stores Alexa `messageId` values with an expiry to prevent replay.
5. Waits for the authoritative command acknowledgement within Amazon's response deadline.

The Lambda must not receive Supabase service-role keys, PostgreSQL connection strings, or MQTT credentials. Configure log retention and avoid logging bearer tokens or directive payload secrets.

Suggested non-public environment variables:

- `NEXORA_ALEXA_CONTROL_API_URL`
- `NEXORA_ALEXA_CLIENT_ID`
- `NEXORA_ALEXA_CLIENT_SECRET`
- `NEXORA_ALEXA_TOKEN_AUDIENCE`
- `NEXORA_ALEXA_REQUEST_SIGNING_KEY` (if the private API uses signed service requests)

Do not prefix secrets with `NEXT_PUBLIC_`.

## Amazon Developer Console configuration

Manual steps are required:

1. Create a Smart Home skill and select the correct locale(s).
2. Configure the Lambda ARN endpoint and Lambda Alexa Skills Kit trigger for the skill ID.
3. Configure authorization-code account linking with the Nexora authorization and token endpoints.
4. Register every Amazon-provided redirect URL exactly.
5. Set the minimum required scopes for device discovery and control.
6. Provide privacy policy, terms, testing instructions, icons, and distribution metadata.
7. Test discovery, on/off, expired tokens, unlinking, offline devices, pending commands, and failures in the Alexa simulator.
8. Complete real-device and physical-hardware testing before certification.

## Safety restrictions

- Gate movement is excluded from Alexa discovery. It must not be disguised as a switch or light.
- Security arming/disarming, sirens, and intrusion controls are excluded pending a separate threat and Alexa capability review.
- A pending database command is not reported as successful.
- Timeout does not trigger an automatic repeat.
- Device and house access is re-evaluated for every discovery and command request.
- Stable endpoint identifiers must never encode credentials or expose raw internal metadata beyond the opaque device identifier.

## MQTT and hardware dependencies

Production readiness still depends on a deployed gateway that securely claims commands, publishes them to the correct MQTT topic, enforces expiry and idempotency, and posts signed acknowledgements. ESP32 firmware must implement safe command handling, unique command IDs, reconnect behavior, and accurate state reporting. Gate hardware additionally requires limit switches/interlocks and a reliable stop path. None of these physical properties were verified by automated tests.

## Testing status

Automated tests use mock Alexa directives and simulated command results. They verify discovery filtering, missing credentials, replay rejection, pending acknowledgement handling, and gate exclusion. They do not verify an Amazon account, Lambda deployment, Alexa device, MQTT broker, ESP32, or physical appliance.
