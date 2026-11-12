"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSmartEstate } from "@/components/providers/device-state-provider";

export default function RegisterPage() {
  const { register, mode } = useSmartEstate(); const router = useRouter(); const [error, setError] = React.useState(""); const [busy, setBusy] = React.useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); setBusy(true); setError(""); const data = new FormData(event.currentTarget); try { await register({ name: String(data.get("name")), email: String(data.get("email")), password: String(data.get("password")) }); router.replace("/dashboard"); } catch (cause) { setError(cause instanceof Error ? cause.message : "Registration failed"); } finally { setBusy(false); } }
  return <main className="grid min-h-screen place-items-center bg-[#0B0F14] px-6 text-white"><section className="w-full max-w-md rounded-3xl border border-white/10 bg-card/80 p-8"><Link href="/" className="text-sm text-blue-400">← Nexora Home</Link><h1 className="mt-6 text-3xl font-semibold">Create your account</h1><p className="mb-6 mt-2 text-muted-foreground">Start with an authenticated Smart Estate session.</p><form className="space-y-4" onSubmit={submit}><Input name="name" placeholder="Name" required autoComplete="name"/><Input name="email" type="email" placeholder="Email" required autoComplete="email"/><Input name="password" type="password" minLength={8} placeholder="Password (8+ characters)" required autoComplete="new-password"/>{error && <p role="alert" className="text-sm text-red-400">{error}</p>}<Button className="w-full" disabled={busy || mode === "MOCK"}>{busy ? "Creating…" : mode === "MOCK" ? "Switch to backend mode to register" : "Create account"}</Button></form><p className="mt-5 text-sm text-muted-foreground">Already registered? <Link className="text-blue-400" href="/login">Sign in</Link></p></section></main>;
}
