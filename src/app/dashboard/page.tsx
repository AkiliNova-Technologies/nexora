"use client";
import { Activity, Cpu, History, House, ShieldCheck, WifiOff } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { DashboardEmptyState } from "@/components/dashboard-empty-state";
import { SectionCards, type MetricCardItem } from "@/components/section-cards";
import { useDevices, useSmartEstate } from "@/components/providers/device-state-provider";
import { Badge } from "@/components/ui/badge";

export default function DashboardPage() {
  const { currentHouse, rooms, securityEvents, securityMode, status, houseLoading, error, eventStatus } = useSmartEstate();
  const { devices, states } = useDevices();
  const online = Object.values(states).filter(s => s.connectivity === "ONLINE").length;
  const security = securityMode?.mode.replaceAll("_", " ") ?? "Unknown";
  const metrics: MetricCardItem[] = [
    { title: "Registered Devices", value: devices.length, icon: Cpu, tone: "blue", footerText: "Authoritative inventory for this house" },
    { title: "Online Devices", value: online, icon: Activity, tone: "green", footerText: "Controller-reported connectivity" },
    { title: "Offline Devices", value: Math.max(0, devices.length - online), icon: WifiOff, tone: "red", footerText: "Registered devices not currently online" },
    { title: "Security", value: security, icon: ShieldCheck, tone: securityMode ? "purple" : "neutral", footerText: securityMode ? "Current backend security mode" : "Security state unavailable" },
  ];
  return <DashboardShell>
    <section><p className="text-sm text-muted-foreground">{currentHouse?.name ?? "No house selected"}</p><h1 className="mt-1 text-3xl font-semibold text-white">Home Overview</h1></section>
    {error && <div role="alert" className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">{error}</div>}
    {status === "loading" || houseLoading ? <div className="h-32 animate-pulse rounded-3xl bg-white/[0.04]" aria-label="Loading dashboard" /> : <SectionCards items={metrics} />}
    <section className="grid gap-5 xl:grid-cols-[1fr_1.4fr]">
      <div className="rounded-3xl border border-white/10 bg-card/80 p-5"><div className="flex items-start justify-between gap-4"><div><h2 className="font-semibold text-white">House overview</h2><p className="mt-1 text-sm text-muted-foreground">Backend-assigned scope</p></div><Badge variant="outline" className="border-white/10">{eventStatus === "live" ? "Cloud connected" : eventStatus === "reconnecting" ? "Reconnecting" : "Connection unknown"}</Badge></div>{currentHouse ? <dl className="mt-6 grid grid-cols-2 gap-4 text-sm"><div><dt className="text-muted-foreground">House</dt><dd className="mt-1 font-medium text-white">{currentHouse.name}</dd></div><div><dt className="text-muted-foreground">Rooms</dt><dd className="mt-1 font-medium text-white">{rooms.length}</dd></div><div><dt className="text-muted-foreground">Devices</dt><dd className="mt-1 font-medium text-white">{devices.length}</dd></div><div><dt className="text-muted-foreground">Controller</dt><dd className="mt-1 font-medium text-white">{online ? `${online} reporting` : "Unavailable"}</dd></div></dl> : <DashboardEmptyState compact icon={House} title="No house assigned" description="Ask an administrator to link this account to a house." />}</div>
      <div className="rounded-3xl border border-white/10 bg-card/80 p-5"><h2 className="font-semibold text-white">Recent security activity</h2><p className="mt-1 text-sm text-muted-foreground">Verified sensor events</p>{securityEvents.length ? <div className="mt-5 divide-y divide-white/10">{securityEvents.map(event=><div key={event.id} className="flex items-center justify-between gap-4 py-3 text-sm"><div><p className="font-medium text-white">{event.type.replaceAll("_", " ")}</p><p className="text-muted-foreground">{devices.find(d=>d.id===event.deviceId)?.name ?? "House security"}</p></div><time className="shrink-0 text-xs text-muted-foreground" dateTime={event.occurredAt}>{new Date(event.occurredAt).toLocaleString()}</time></div>)}</div> : <DashboardEmptyState compact icon={History} title="No security events recorded" description="Events from configured sensors will appear here." />}</div>
    </section>
  </DashboardShell>;
}
