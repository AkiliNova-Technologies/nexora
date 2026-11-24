const INTERNAL_BASE = "https://nexora.invalid";

/**
 * Returns `value` only when it is a same-origin path ("/dashboard?x=1").
 * Rejects absolute URLs, protocol-relative "//host", backslash variants such
 * as "/\host" (browsers normalise "\" to "/"), and control characters, all of
 * which can turn a post-login redirect into an open redirect.
 */
export function safeInternalPath(value: string | null | undefined, fallback = "/dashboard") {
  if (!value || !value.startsWith("/") || value.startsWith("//") || /[\\\u0000-\u001f\u007f]/.test(value)) return fallback;
  try {
    const url = new URL(value, INTERNAL_BASE);
    if (url.origin !== INTERNAL_BASE) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
