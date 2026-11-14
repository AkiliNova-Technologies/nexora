import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

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

export async function requireUser() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  const subject = claims?.sub;
  if (error || !claims || typeof subject !== "string") return null;
  return { id: subject, email: typeof claims.email === "string" ? claims.email : "", claims };
}
