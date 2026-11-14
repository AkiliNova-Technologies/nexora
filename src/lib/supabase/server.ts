import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";

function configuration() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase public configuration is missing");
  return { url, key };
}

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  const { url, key } = configuration();
  return createServerClient(url, key, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(values) {
        try { for (const value of values) cookieStore.set(value.name, value.value, value.options); }
        catch { /* Server Components cannot write cookies; proxy refreshes them. */ }
      },
    },
  });
}

export async function createSupabaseRouteClient() {
  const cookieStore = await cookies();
  const { url, key } = configuration();
  const pendingCookies: Array<{ name: string; value: string; options: CookieOptions }> = [];
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(values) {
        pendingCookies.push(...values);
        for (const value of values) cookieStore.set(value.name, value.value, value.options);
      },
    },
  });
  return {
    supabase,
    applyCookies<T extends NextResponse>(response: T) {
      for (const value of pendingCookies) response.cookies.set(value.name, value.value, value.options);
      return response;
    },
  };
}

export async function requireUser() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  const subject = claims?.sub;
  if (error || !claims || typeof subject !== "string") return null;
  return { id: subject, email: typeof claims.email === "string" ? claims.email : "", claims };
}
