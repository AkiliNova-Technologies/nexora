"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Radar } from "lucide-react";
import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { useDevices, useSmartEstate } from "@/components/providers/device-state-provider";
import { smartEstateApi, smartEstateMode } from "@/lib/api/client";
import type { SecurityEvent } from "@/domain/smart-estate";

const formatTime = (value: string) => new Date(value).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });

export default function SecurityEventHistoryPage() {
  const { currentHouse, rooms, securityEvents } = useSmartEstate();
  const { devices } = useDevices();
  const [page, setPage] = React.useState(0);
  const [pageSize, setPageSize] = React.useState(20);
  const [events, setEvents] = React.useState<SecurityEvent[]>([]);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const isMock = smartEstateMode === "MOCK";

  React.useEffect(() => {
    let active = true;
    if (isMock || !currentHouse) return;
    smartEstateApi.securityEventPage(currentHouse.id, page, pageSize)
      .then((result) => {
        if (!active) return;
        setEvents(result.items);
        setTotal(result.total);
        setError(null);
      })
      .catch((cause) => {
        if (active) setError(cause instanceof Error ? cause.message : "Unable to load event history");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [currentHouse, isMock, page, pageSize]);

  const displayedEvents = isMock ? securityEvents : events;
  const displayedTotal = isMock ? securityEvents.length : total;
  const displayedLoading = isMock ? false : loading;
  const totalPages = Math.max(1, Math.ceil(displayedTotal / pageSize));

  return <SidebarProvider style={{ "--sidebar-width": "calc(var(--spacing) * 72)", "--header-height": "calc(var(--spacing) * 14)" } as React.CSSProperties}>
    <AppSidebar variant="inset" />
    <SidebarInset className="bg-transparent"><SiteHeader />
      <main className="flex flex-1 flex-col"><div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-5 md:px-6 md:py-7">
        <div><Button asChild variant="ghost" className="mb-3 text-muted-foreground hover:text-white"><Link href="/security"><ArrowLeft />Security</Link></Button><h1 className="text-3xl font-semibold tracking-tight text-white">Security event history</h1><p className="mt-2 text-sm text-muted-foreground">Newest activity first. History remains on the authorized backend.</p></div>
        <section className="rounded-[2rem] border border-white/10 bg-card/80 p-5 shadow-xl shadow-black/20 backdrop-blur">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-muted-foreground">{displayedTotal} event{displayedTotal === 1 ? "" : "s"}</p><label className="flex items-center gap-2 text-sm text-muted-foreground">Events per page<select aria-label="Events per page" value={pageSize} onChange={(event) => { setPage(0); setPageSize(Number(event.target.value)); }} className="rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-white"><option value={10}>10</option><option value={20}>20</option><option value={50}>50</option></select></label></div>
          {displayedLoading && <p className="text-sm text-muted-foreground">Loading event history…</p>}{error && <p role="alert" className="text-sm text-red-400">{error}</p>}{!displayedLoading && !error && displayedEvents.length === 0 && <p className="text-sm text-muted-foreground">No security activity has been recorded.</p>}
          <div className="space-y-3">{displayedEvents.map((event) => { const device = devices.find((item) => item.id === event.deviceId); const room = rooms.find((item) => item.id === device?.roomId); const detected = event.type === "MOTION_DETECTED"; return <article key={event.id} className="flex gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4"><div className={detected ? "flex size-10 shrink-0 items-center justify-center rounded-2xl border border-amber-500/20 bg-amber-500/10 text-amber-400" : "flex size-10 shrink-0 items-center justify-center rounded-2xl border border-green-500/20 bg-green-500/10 text-green-400"}><Radar className="size-4" /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-start justify-between gap-2"><div><h2 className="text-sm font-semibold text-white">{detected ? "Motion detected" : "Motion cleared"}</h2><p className="text-sm text-muted-foreground">{room?.name ?? device?.name ?? "Unknown location"}</p></div><time className="text-xs text-muted-foreground" dateTime={event.occurredAt}>{formatTime(event.occurredAt)}</time></div></div></article>; })}</div>
          <nav className="mt-6 flex items-center justify-between gap-3" aria-label="Event history pagination"><Button variant="outline" disabled={displayedLoading || page === 0} onClick={() => setPage((current) => current - 1)}>Previous</Button><span className="text-sm text-muted-foreground">Page {page + 1} of {totalPages}</span><Button variant="outline" disabled={displayedLoading || page + 1 >= totalPages} onClick={() => setPage((current) => current + 1)}>Next</Button></nav>
        </section>
      </div></main>
    </SidebarInset>
  </SidebarProvider>;
}
