"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSmartEstate } from "@/components/providers/device-state-provider";
import { safeInternalPath } from "@/lib/safe-redirect";

export default function LoginPage() {
  return <React.Suspense fallback={<main className="grid min-h-screen place-items-center bg-[#0B0F14] text-white">Loading sign in…</main>}><LoginForm /></React.Suspense>;
}

function LoginForm() {
  const { login, mode, status } = useSmartEstate(); const router = useRouter(); const search = useSearchParams();
  const [error, setError] = React.useState(""); const [busy, setBusy] = React.useState(false);
  React.useEffect(() => {
    if (status === "authenticated") router.replace(safeInternalPath(search.get("next")));
  }, [router, search, status]);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); const data = new FormData(event.currentTarget);
    try { await login({ email: String(data.get("email")), password: String(data.get("password")) }); router.replace(safeInternalPath(search.get("next"))); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Sign in failed"); } finally { setBusy(false); }
  }
  return <AuthShell title="Welcome back" detail="Sign in to your Smart Estate account.">{search.get("error") === "confirmation" && <p role="alert" className="mb-4 rounded-lg border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-300">That confirmation link is invalid or expired. Request a new link or try registering again.</p>}<form className="space-y-4" onSubmit={submit}><Input name="email" type="email" placeholder="Email" required autoComplete="email"/><Input name="password" type="password" placeholder="Password" required autoComplete="current-password"/>{error && <p role="alert" className="text-sm text-red-400">{error}</p>}<Button className="w-full" disabled={busy || mode === "MOCK"}>{busy ? "Signing in…" : mode === "MOCK" ? "Mock mode is already signed in" : "Sign in"}</Button></form><p className="mt-5 text-sm text-muted-foreground">New here? <Link className="text-blue-400" href="/register">Create an account</Link></p></AuthShell>;
}

function AuthShell({ title, detail, children }: { title: string; detail: string; children: React.ReactNode }) { return <main className="grid min-h-screen place-items-center bg-[#0B0F14] px-6 text-white"><section className="w-full max-w-md rounded-3xl border border-white/10 bg-card/80 p-8 shadow-2xl"><Link href="/" className="text-sm text-blue-400">← Nexora Home</Link><h1 className="mt-6 text-3xl font-semibold">{title}</h1><p className="mb-6 mt-2 text-muted-foreground">{detail}</p>{children}</section></main>; }
