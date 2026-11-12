"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useSmartEstate } from "./device-state-provider";

const publicRoutes = new Set(["/", "/login", "/register"]);

export function SessionGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { status, currentHouse, mode, error, onboardDemoHouse } = useSmartEstate();
  const protectedRoute = !publicRoutes.has(pathname);
  const [working, setWorking] = React.useState(false);

  React.useEffect(() => {
    if (protectedRoute && status === "anonymous") router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [pathname, protectedRoute, router, status]);

  if (!protectedRoute) return children;
  if (status !== "authenticated") return <CenteredMessage title={status === "loading" ? "Restoring your session…" : "Redirecting to sign in…"} detail={error} />;
  if (mode === "BACKEND" && !currentHouse) {
    const enabled = process.env.NODE_ENV === "development" && process.env.NEXT_PUBLIC_ENABLE_DEV_ONBOARDING === "true";
    return <CenteredMessage title="No house is linked to this account" detail={error || "Create the local demo house before opening the dashboard."} action={enabled ? <Button disabled={working} onClick={() => { setWorking(true); void onboardDemoHouse().finally(() => setWorking(false)); }}>{working ? "Creating…" : "Create development demo house"}</Button> : undefined} />;
  }
  return children;
}

function CenteredMessage({ title, detail, action }: { title: string; detail?: string | null; action?: React.ReactNode }) {
  return <main className="grid min-h-screen place-items-center bg-[#0B0F14] px-6 text-white"><div className="max-w-md rounded-3xl border border-white/10 bg-white/[0.04] p-8 text-center"><h1 className="text-xl font-semibold">{title}</h1>{detail && <p className="mt-3 text-sm text-muted-foreground">{detail}</p>}{action && <div className="mt-6">{action}</div>}</div></main>;
}
