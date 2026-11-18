import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { refreshSupabaseSession } from "@/lib/supabase/proxy";

const machineRoutes = new Set([
  "/api/integrations/alexa/directives",
  "/api/oauth/token",
  "/api/oauth/revoke",
]);

export async function proxy(request: NextRequest) {
  if (machineRoutes.has(request.nextUrl.pathname)) return NextResponse.next();
  return refreshSupabaseSession(request);
}
export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"] };
