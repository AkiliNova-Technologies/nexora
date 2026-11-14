import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function refreshSupabaseSession(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return NextResponse.next({ request });
  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(values) {
        for (const value of values) request.cookies.set(value.name, value.value);
        response = NextResponse.next({ request });
        for (const value of values) response.cookies.set(value.name, value.value, value.options);
      },
    },
  });
  await supabase.auth.getClaims();
  return response;
}

