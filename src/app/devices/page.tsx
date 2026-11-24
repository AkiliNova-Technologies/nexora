"use client";

import * as React from "react";
import { Cpu, Search, Wifi, WifiOff } from "lucide-react";

import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SectionCards, type MetricCardItem } from "@/components/section-cards";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useDeviceStore, useDevices, useSmartEstate } from "@/components/providers/device-state-provider";
import { DeviceCard } from "@/components/devices/device-card";

function deviceMetrics(total: number, online: number): MetricCardItem[] { return [
  {
    title: "Total Devices",
    value: total,
    badge: `${online} online`,
    icon: Cpu,
    tone: "blue",
    footerTitle: "Registered inventory",
    footerText: "Devices returned by the selected house backend.",
  },
  {
    title: "Online Devices",
    value: online,
    badge: total ? `${Math.round((online / total) * 100)}%` : "0%",
    icon: Wifi,
    tone: "green",
    footerTitle: "Confirmed connectivity",
    footerText: "Online status comes from device state reports.",
  },
  {
    title: "Offline Devices",
    value: total - online,
    icon: WifiOff,
    tone: "red",
    footerTitle: "Maintenance required",
    footerText: "Some devices need reconnection or power checks.",
  },
]; }

export default function DevicesPage() {
  const [query, setQuery] = React.useState("");
  const [view, setView] = React.useState<"grid" | "compact">("grid");
  const { devices, states } = useDevices();
  const store = useDeviceStore();
  const { rooms, eventStatus, mode, houseLoading, error } = useSmartEstate();
  const roomNames = React.useMemo(() => Object.fromEntries(rooms.map((room) => [room.id, room.name])), [rooms]);

  const filteredDevices = devices.filter((device) =>
    `${device.name} ${device.roomId ? roomNames[device.roomId] : "Unassigned"} ${device.type}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 14)",
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="inset" />

      <SidebarInset className="bg-transparent">
        <SiteHeader />

        <main className="flex flex-1 flex-col">
          <div className="mx-auto flex w-full flex-col gap-6 px-4 py-5 md:px-6 md:py-7">
            <section className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-muted-foreground">
                  Connected smart ecosystem
                </p>
                <h1 className="mt-1 text-3xl font-semibold tracking-tight text-white">
                  Devices
                </h1>
              </div>
              <Badge variant="outline" className="w-fit rounded-full border-white/10 text-muted-foreground">{mode} · {eventStatus}</Badge>

            </section>

            <SectionCards items={deviceMetrics(devices.length, Object.values(states).filter((state) => state.connectivity === "ONLINE").length)} />

            <section className="rounded-3xl border border-white/10 bg-card/80 p-4 shadow-xl shadow-black/20 backdrop-blur">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="relative w-full md:max-w-md">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search devices, rooms, or types..."
                    className="h-10 rounded-full border-white/10 bg-white/[0.04] pl-9 text-white placeholder:text-muted-foreground"
                  />
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className={cn(
                      "rounded-full border-white/10 bg-white/[0.04] text-white hover:bg-white/10",
                      view === "grid" && "bg-blue-500/15 text-blue-400",
                    )}
                    onClick={() => setView("grid")}
                  >
                    Grid
                  </Button>

                  <Button
                    variant="outline"
                    className={cn(
                      "rounded-full border-white/10 bg-white/[0.04] text-white hover:bg-white/10",
                      view === "compact" && "bg-blue-500/15 text-blue-400",
                    )}
                    onClick={() => setView("compact")}
                  >
                    Compact
                  </Button>
                </div>
              </div>
            </section>

            <section
              className={cn(
                "grid gap-5",
                view === "grid"
                  ? "grid-cols-1 md:grid-cols-2 xl:grid-cols-3"
                  : "grid-cols-1",
              )}
            >
              {filteredDevices.map((device) => (
                <DeviceCard
                  key={device.id}
                  device={device}
                  state={states[device.id]}
                  subtitle={device.roomId ? roomNames[device.roomId] : undefined}
                  compact={view === "compact"}
                  onCommand={(command, parameters) => store.sendCommand(device.id, command, parameters?.value)}
                />
              ))}
              {houseLoading && <div className="col-span-full h-48 animate-pulse rounded-3xl bg-white/[0.04]" aria-label="Loading devices"/>}
              {!houseLoading&&error&&<div role="alert" className="col-span-full rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">{error}</div>}
              {!houseLoading&&!error&&devices.length === 0 && <div className="col-span-full rounded-3xl border border-dashed border-white/10 bg-card/60 p-10 text-center"><Cpu className="mx-auto size-6 text-muted-foreground"/><h2 className="mt-4 font-semibold text-white">No devices connected yet</h2><p className="mt-2 text-sm text-muted-foreground">Devices registered to this house will appear here once configured.</p></div>}
            </section>
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
