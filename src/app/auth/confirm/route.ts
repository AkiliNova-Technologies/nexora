import type { EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const emailOtpTypes = new Set<EmailOtpType>(["email", "signup", "invite", "magiclink", "recovery", "email_change"]);

function safeDestination(value: string | null) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/dashboard";
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const rawType = request.nextUrl.searchParams.get("type");
  const destination = safeDestination(request.nextUrl.searchParams.get("next"));
  const supabase = await createSupabaseServerClient();

  let error: Error | null = null;
  if (code) {
    ({ error } = await supabase.auth.exchangeCodeForSession(code));
  } else if (tokenHash && rawType && emailOtpTypes.has(rawType as EmailOtpType)) {
    ({ error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: rawType as EmailOtpType }));
  } else {
    error = new Error("The confirmation link is incomplete");
  }

  if (error) return NextResponse.redirect(new URL("/login?error=confirmation", request.url));
  return NextResponse.redirect(new URL(destination, request.url));
}
