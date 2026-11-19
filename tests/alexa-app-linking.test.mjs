import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { ALEXA_API_HOSTS, amazonAuthorizationUrl, appLinkConfig, decryptCredential, discoverAlexaEndpoint, enableAlexaSkill, encryptCredential, oauthState, pkceChallenge, pkceVerifier, stateHash, validatedReturnPath } from "../src/lib/alexa/app-linking.ts";

const originalEnv = { ...process.env };
function configured() {
  process.env.ALEXA_SKILL_ID = "amzn1.ask.skill.test";
  process.env.ALEXA_SKILL_STAGE = "development";
  process.env.ALEXA_APP_LINK_CLIENT_ID = "client";
  process.env.ALEXA_APP_LINK_CLIENT_SECRET = "secret";
  process.env.ALEXA_APP_LINK_REDIRECT_URI = "https://nexora.example/api/integrations/alexa/callback";
  process.env.ALEXA_APP_LINK_ENCRYPTION_KEY = "11".repeat(32);
  return appLinkConfig();
}
test.afterEach(() => { process.env = { ...originalEnv }; delete globalThis.fetch; });

test("website linking configuration rejects malformed encryption keys", () => {
  configured(); process.env.ALEXA_APP_LINK_ENCRYPTION_KEY = "short";
  assert.throws(() => appLinkConfig(), /not configured/);
});

test("state and PKCE values are random and use S256", () => {
  assert.notEqual(oauthState(), oauthState());
  const verifier = pkceVerifier();
  assert.ok(verifier.length >= 43 && verifier.length <= 128);
  assert.equal(pkceChallenge(verifier), createHash("sha256").update(verifier).digest("base64url"));
  assert.equal(stateHash("state").length, 64);
});

test("Amazon authorization URL contains only the required browser parameters", () => {
  const url = amazonAuthorizationUrl(configured(), "state", "challenge");
  assert.equal(url.origin, "https://www.amazon.com");
  assert.equal(url.searchParams.get("scope"), "alexa::skills:account_linking");
  assert.equal(url.searchParams.get("response_type"), "code");
  assert.equal(url.searchParams.get("code_challenge_method"), "S256");
  assert.equal(url.searchParams.has("client_secret"), false);
});

test("credentials use authenticated encryption and context binding", () => {
  const config = configured();
  const value = encryptCredential("refresh-token", config.encryptionKey, "user-a");
  assert.notEqual(value.ciphertext, "refresh-token");
  assert.equal(decryptCredential(value, config.encryptionKey, "user-a"), "refresh-token");
  assert.throws(() => decryptCredential(value, config.encryptionKey, "user-b"));
});

test("return paths are constrained to settings", () => {
  assert.equal(validatedReturnPath("/settings?tab=integrations"), "/settings?tab=integrations");
  assert.equal(validatedReturnPath("https://evil.example"), "/settings?integration=alexa");
  assert.equal(validatedReturnPath("/dashboard"), "/settings?integration=alexa");
});

test("regional discovery accepts only documented Alexa hosts", async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({ endpoints: ["evil.example", "api.eu.amazonalexa.com"] }), { status: 200 });
  assert.equal(await discoverAlexaEndpoint("token"), "https://api.eu.amazonalexa.com");
  assert.deepEqual([...ALEXA_API_HOSTS].sort(), ["api.amazonalexa.com", "api.eu.amazonalexa.com", "api.fe.amazon.com"].sort());
});

test("combined enablement sends development stage and a single-use Nexora code", async () => {
  let request;
  globalThis.fetch = async (url, init) => { request = { url: String(url), init }; return new Response(JSON.stringify({ status: "ENABLED", accountLink: { status: "LINKED" } }), { status: 201 }); };
  const result = await enableAlexaSkill(configured(), "https://api.amazonalexa.com", "amazon-token", "nexora-code");
  const body = JSON.parse(request.init.body);
  assert.equal(result.status, "ENABLED");
  assert.equal(body.stage, "development");
  assert.equal(body.accountLinkRequest.authCode, "nexora-code");
  assert.equal(body.accountLinkRequest.type, "AUTH_CODE");
  assert.match(request.init.headers.Authorization, /^Bearer /);
});

test("combined enablement does not accept untrusted endpoint hosts", async () => {
  await assert.rejects(enableAlexaSkill(configured(), "https://evil.example", "token", "code"), /Untrusted/);
});
