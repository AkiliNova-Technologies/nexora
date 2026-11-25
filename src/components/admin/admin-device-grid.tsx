"use client";

import * as React from "react";
import { Cpu, Search, Wifi, WifiOff } from "lucide-react";

import { DeviceCard, type DeviceCommandParameters } from "@/components/devices/device-card";
import { SectionCards, type MetricCardItem } from "@/components/section-cards";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { smartEstateApi } from "@/lib/api/client";
import type { AdminDeviceSummary, AdminOverviewResponse } from "@/lib/api/contracts";
import { cn } from "@/lib/utils";
import type { Device, DeviceCapability, DeviceCommandStatus, DeviceCommandType, DeviceConnectivity, DeviceState, DeviceStateValues, DeviceType } from "@/domain/smart-estate";

const TERMINAL = new Set(["EXECUTED", "FAILED", "TIMEOUT", "CANCELLED", "EXPIRED", "REJECTED"]);
const REFRESH_MS = 8000;

export function toDevice(summary: AdminDeviceSummary): Device {
  return {
    id: summary.id,
    houseId: summary.houseId ?? undefined,
    estateId: summary.estateId ?? undefined,
    name: summary.name,
    type: summary.type as DeviceType,
    capabilities: (summary.capabilities ?? []) as DeviceCapability[],
    executionMode: summary.executionMode,
    // Estate administrators may command every device in an administered estate;
    // the API re-checks this on every command.
    allowedOperations: ["VIEW", "READ_STATE", "COMMAND"],
  };
}

export function toState(summary: AdminDeviceSummary): DeviceState {
  return {
    deviceId: summary.id,
    connectivity: (summary.connectivity ?? "UNKNOWN") as DeviceConnectivity,
    desired: (summary.desired ?? null) as DeviceStateValues | null,
    reported: (summary.reported ?? {}) as DeviceStateValues,
    commandStatus: (summary.commandStatus ?? "IDLE") as DeviceCommandStatus,
    lastReportedAt: summary.lastReportedAt ?? "",
  };
}

export function AdminDeviceGrid({ data, houseId }: { data: AdminOverviewResponse; houseId?: string }) {
  const [devices, setDevices] = React.useState(data.devices);
  const [query, setQuery] = React.useState("");
  const [view, setView] = React.useState<"grid" | "compact">("grid");
  const estateId = data.estate.id;

  // Keep connectivity and reported state fresh without a page reload.
  React.useEffect(() => {
    let active = true;
    const timer = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      smartEstateApi.adminOverview(estateId).then((value) => { if (active) setDevices(value.devices); }).catch(() => undefined);
    }, REFRESH_MS);
    return () => { active = false; window.clearInterval(timer); };
  }, [estateId]);

  const patch = React.useCallback((id: string, values: Partial<AdminDeviceSummary>) => {
    setDevices((current) => current.map((device) => (device.id === id ? { ...device, ...values } : device)));
  }, []);

  const sendCommand = React.useCallback(async (deviceId: string, command: DeviceCommandType, parameters?: DeviceCommandParameters) => {
    patch(deviceId, { commandStatus: "PENDING" });
    try {
      const submitted = await smartEstateApi.command(deviceId, { command, parameters, clientRequestId: crypto.randomUUID() });
      let result = submitted;
      const deadline = Date.now() + 30_000;
      while (!TERMINAL.has(result.status) && Date.now() < deadline) {
        patch(deviceId, { commandStatus: result.status });
        await new Promise((resolve) => setTimeout(resolve, 1500));
        result = await smartEstateApi.commandStatus(submitted.id);
      }
      const state = await smartEstateApi.state(deviceId);
      patch(deviceId, { connectivity: state.connectivity, reported: state.reported as Record<string, unknown>, desired: state.desired as Record<string, unknown> | null, commandStatus: state.commandStatus, lastReportedAt: state.lastReportedAt });
      if (result.status !== "EXECUTED") throw new Error(result.error ?? (TERMINAL.has(result.status) ? `Command ${result.status.toLowerCase()}` : "Controller did not confirm the command in time"));
      return result;
    } catch (error) {
      patch(deviceId, { commandStatus: "FAILED" });
      throw error;
    }
  }, [patch]);

  const scoped = houseId ? devices.filter((device) => device.houseId === houseId) : devices;
  const houseName = (id?: string | null) => (id ? data.houses.find((house) => house.id === id)?.name ?? "House" : "Shared estate");
  const filtered = scoped.filter((device) => `${device.name} ${houseName(device.houseId)} ${device.type}`.toLowerCase().includes(query.toLowerCase()));
  const groups = [
    ...(houseId ? [] : [{ id: "estate", title: "Shared estate", items: filtered.filter((device) => !device.houseId) }]),
    ...data.houses.filter((house) => !houseId || house.id === houseId).map((house) => ({ id: house.id, title: house.name, items: filtered.filter((device) => device.houseId === house.id) })),
  ].filter((group) => group.items.length);

  const online = scoped.filter((device) => device.connectivity === "ONLINE").length;
  const metrics: MetricCardItem[] = [
    { title: "Total Devices", value: scoped.length, badge: `${online} online`, icon: Cpu, tone: "blue", footerTitle: "Registered inventory", footerText: houseId ? "Devices registered to this house." : "House and shared-estate devices." },
    { title: "Online Devices", value: online, badge: scoped.length ? `${Math.round((online / scoped.length) * 100)}%` : "0%", icon: Wifi, tone: "green", footerTitle: "Confirmed connectivity", footerText: "Online status comes from controller heartbeats and state reports." },
    { title: "Offline Devices", value: scoped.length - online, icon: WifiOff, tone: "red", footerTitle: "Maintenance required", footerText: "Devices that need reconnection or power checks." },
  ];

  return (
    <>
      <SectionCards items={metrics} />

      <section className="rounded-3xl border border-white/10 bg-card/80 p-4 shadow-xl shadow-black/20 backdrop-blur">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="relative w-full md:max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search devices, houses, or types..." className="h-10 rounded-full border-white/10 bg-white/[0.04] pl-9 text-white placeholder:text-muted-foreground" />
          </div>
          <div className="flex gap-2">
            {(["grid", "compact"] as const).map((option) => (
              <Button key={option} variant="outline" className={cn("rounded-full border-white/10 bg-white/[0.04] capitalize text-white hover:bg-white/10", view === option && "bg-blue-500/15 text-blue-400")} onClick={() => setView(option)}>
                {option}
              </Button>
            ))}
          </div>
        </div>
      </section>

      {groups.map((group) => (
        <section key={group.id} className="space-y-4">
          <h2 className="text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">{group.title} · {group.items.length}</h2>
          <div className={cn("grid gap-5", view === "grid" ? "grid-cols-1 md:grid-cols-2 xl:grid-cols-3" : "grid-cols-1")}>
            {group.items.map((summary) => (
              <DeviceCard
                key={summary.id}
                device={toDevice(summary)}
                state={toState(summary)}
                subtitle={houseName(summary.houseId)}
                compact={view === "compact"}
                extendedControls
                onCommand={(command, parameters) => sendCommand(summary.id, command, parameters)}
              />
            ))}
          </div>
        </section>
      ))}

      {!groups.length && (
        <div className="rounded-3xl border border-dashed border-white/10 bg-card/60 p-10 text-center">
          <Cpu className="mx-auto size-6 text-muted-foreground" />
          <h2 className="mt-4 font-semibold text-white">{scoped.length ? "No devices match your search" : "No devices registered yet"}</h2>
          <p className="mt-2 text-sm text-muted-foreground">Devices registered to this estate will appear here once configured.</p>
        </div>
      )}
    </>
  );
}
