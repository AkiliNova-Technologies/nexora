import { requireUser } from "@/lib/supabase/server";
import { ALEXA_SCOPE } from "@/lib/alexa/oauth";
import { issueAlexaAuthorizationCode } from "@/lib/alexa/grants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const allowedRedirects = () => new Set((process.env.ALEXA_OAUTH_REDIRECT_URIS ?? "").split(",").map(value => value.trim()).filter(Boolean));
const escape = (value: string) => value.replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]!));
function requestValues(url: URL, form?: URLSearchParams) {
  const get = (name: string) => form?.get(name) ?? url.searchParams.get(name) ?? "";
  return { responseType: get("response_type"), clientId: get("client_id"), redirectUri: get("redirect_uri"), scope: get("scope"), state: get("state") };
}
function valid(values: ReturnType<typeof requestValues>) {
  return values.responseType === "code" && values.clientId === process.env.ALEXA_OAUTH_CLIENT_ID && allowedRedirects().has(values.redirectUri) && values.scope.split(/\s+/).includes(ALEXA_SCOPE) && values.state.length > 0;
}

export async function GET(request: Request) {
  const url = new URL(request.url), values = requestValues(url);
  if (!valid(values)) return new Response("Invalid OAuth authorization request.", { status: 400 });
  const user = await requireUser();
  if (!user) {
    const login = new URL("/login", url.origin); login.searchParams.set("next", `${url.pathname}${url.search}`);
    return Response.redirect(login, 303);
  }
  const hidden = Object.entries(values).map(([name, value]) => `<input type="hidden" name="${escape(name.replace(/[A-Z]/g, c => `_${c.toLowerCase()}`))}" value="${escape(value)}">`).join("");
  return new Response(`<!doctype html><html><head><meta name="viewport" content="width=device-width"><title>Connect Alexa to Nexora</title><style>body{margin:0;background:#080d18;color:#fff;font:16px system-ui;display:grid;place-items:center;min-height:100vh}.card{max-width:520px;margin:24px;padding:32px;border:1px solid #253047;border-radius:24px;background:#111827}p,li{color:#aeb8cb;line-height:1.6}button{border:0;border-radius:14px;padding:13px 18px;font-weight:700;cursor:pointer}.allow{background:#3b82f6;color:#fff}.deny{background:#273244;color:#fff;margin-left:8px}</style></head><body><main class="card"><h1>Connect Amazon Alexa</h1><p>Alexa will be able to discover and control your authorized Nexora lights and fans, and read their current power and connectivity state.</p><ul><li>Gate and security controls are excluded.</li><li>Your permissions are checked on every request.</li><li>You can disconnect at any time in Settings.</li></ul><form method="post">${hidden}<button class="allow" name="decision" value="allow">Allow access</button><button class="deny" name="decision" value="deny">Cancel</button></form></main></body></html>`, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'" } });
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  if (request.headers.get("sec-fetch-site") === "cross-site") return new Response("Forbidden", { status: 403 });
  const form = new URLSearchParams(await request.text()), values = requestValues(url, form);
  if (!valid(values)) return new Response("Invalid OAuth authorization request.", { status: 400 });
  const destination = new URL(values.redirectUri); destination.searchParams.set("state", values.state);
  if (form.get("decision") !== "allow") { destination.searchParams.set("error", "access_denied"); return Response.redirect(destination, 303); }
  const user = await requireUser();
  if (!user) return new Response("Authentication required", { status: 401 });
  const { code } = await issueAlexaAuthorizationCode(user.id, values.redirectUri);
  destination.searchParams.set("code", code);
  return Response.redirect(destination, 303);
}
