import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export function GET() {
  const token = randomBytes(32).toString("base64url");
  const response = NextResponse.json({ token, headerName: "X-XSRF-TOKEN" });
  response.cookies.set("nexora-csrf", token, { httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 3600 });
  return response;
}

