"use client";

import * as React from "react";
import {
  Camera,
  Cpu,
  DoorOpen,
  Fan,
  Lightbulb,
  PlugZap,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Thermometer,
  Wifi,
  WifiOff,
} from "lucide-react";

import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SectionCards, type MetricCardItem } from "@/components/section-cards";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Device, DeviceState, DeviceType } from "@/domain/smart-estate";
import { getCapability } from "@/lib/device-capabilities";
import { useDeviceStore, useDevices, useSmartEstate } from "@/components/providers/device-state-provider";

type DeviceStatus = "online" | "offline" | "warning";

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

const deviceIconMap = {
  LIGHT: Lightbulb,
  FAN: Fan,
  THERMOSTAT: Thermometer,
  SMART_PLUG: PlugZap,
  CAMERA: Camera,
  CONTACT_SENSOR: ShieldCheck,
  MOTION_SENSOR: ShieldCheck,
  LOCK: ShieldCheck,
  BLIND: SlidersHorizontal,
  SPEAKER: Cpu,
  TEMPERATURE_SENSOR: Thermometer,
  HUMIDITY_SENSOR: Thermometer,
  ULTRASONIC_SENSOR: ShieldCheck,
  RGB_LIGHT: Lightbulb,
  SIREN: ShieldCheck,
  GATE: DoorOpen,
} satisfies Record<DeviceType, React.ElementType>;

export default function DevicesPage() {
  const [query, setQuery] = React.useState("");
  const [view, setView] = React.useState<"grid" | "compact">("grid");
  const { devices, states } = useDevices();
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
                  roomName={device.roomId ? roomNames[device.roomId] : undefined}
                  compact={view === "compact"}
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

function getDeviceControl(device: Device, state: DeviceState) {
  const brightness = getCapability(device, "BRIGHTNESS");
  if (brightness) return { kind: "slider" as const, label: "Brightness", command: "SET_BRIGHTNESS" as const, value: state.reported.brightness ?? 0, unit: "%", ...brightness };
  const fanSpeed = getCapability(device, "FAN_SPEED");
  if (fanSpeed) return { kind: "slider" as const, label: "Fan Speed", command: "SET_FAN_SPEED" as const, value: state.reported.fanSpeed ?? 0, unit: "%", ...fanSpeed };
  const temperature = getCapability(device, "TARGET_TEMPERATURE");
  if (temperature) return { kind: "slider" as const, label: "Temperature", command: "SET_TARGET_TEMPERATURE" as const, value: state.reported.targetTemperature ?? 22, ...temperature, unit: "°C" };
  if (device.type === "CAMERA") return { kind: "camera" as const };
  return { kind: "status" as const, label: device.type === "SMART_PLUG" ? "Power Load" : "Sensor Reading", value: device.type === "SMART_PLUG" ? "Monitoring usage" : "Auto-reporting" };
}

function DeviceControl({
  device,
  state,
  status,
  control,
}: {
  device: Device;
  state: DeviceState;
  status: DeviceStatus;
  control: ReturnType<typeof getDeviceControl>;
}) {
  const store = useDeviceStore();
  const disabled = state.reported.on === false || status === "offline" || ["PENDING", "ACCEPTED"].includes(state.commandStatus);

  if (control.kind === "slider") {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            {control.label}
          </span>
          <span className="text-xs font-semibold text-blue-400">
            {control.value}
            {control.unit}
          </span>
        </div>

        <Slider
          key={`${device.id}-${control.value}`}
          defaultValue={[control.value]}
          onValueCommit={([value]) => void store.sendCommand(device.id, control.command, value).catch(() => undefined)}
          min={control.min}
          max={control.max}
          step={1}
          disabled={disabled}
        />
      </div>
    );
  }

  if (control.kind === "camera") {
    return (
      <div className="grid grid-cols-2 gap-2">
        {["View Feed", "Record"].map((action) => (
          <Button
            key={action}
            variant="outline"
            disabled={disabled}
            onClick={action === "Record" ? () => void store.sendCommand(device.id, "START_RECORDING").catch(() => undefined) : undefined}
            className="rounded-2xl border-white/10 bg-white/[0.04] text-white hover:bg-white/10"
          >
            {action}
          </Button>
        ))}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          {control.label}
        </span>
        <span className="text-xs font-semibold text-white">
          {control.value}
        </span>
      </div>
    </div>
  );
}

function getDeviceReading(device: Device, state: DeviceState) {
  switch (device.type) {
    case "LIGHT": return `${state.reported.brightness ?? (state.reported.on ? 100 : 0)}%`;
    case "THERMOSTAT": return state.reported.targetTemperature == null ? "—" : `${state.reported.targetTemperature}°C`;
    case "FAN": return `${state.reported.fanSpeed ?? 0}%`;
    case "SMART_PLUG": return `${state.reported.powerWatts ?? 0}W`;
    case "CAMERA": return state.connectivity === "OFFLINE" ? "No feed" : "Live";
    case "CONTACT_SENSOR": return state.reported.batteryPercent == null ? "Reporting" : `${state.reported.batteryPercent}% battery`;
    default:
      return state.connectivity === "ONLINE" ? "Reporting" : "Unavailable";
  }
}

function deviceMeta(device: Device) {
  if (getCapability(device, "BRIGHTNESS")) return "Brightness control";
  if (getCapability(device, "FAN_SPEED")) return "Speed control";
  if (getCapability(device, "TARGET_TEMPERATURE")) return "Cooling mode";
  if (device.type === "SMART_PLUG") return "Power control";
  if (device.type === "CAMERA") return "Camera monitoring";
  return "Status reporting";
}

function DeviceCard({
  device,
  state,
  compact,
  roomName,
}: {
  device: Device;
  state: DeviceState;
  compact?: boolean;
  roomName?: string;
}) {
  const store = useDeviceStore();
  const Icon = deviceIconMap[device.type];
  const enabled = state.reported.on ?? true;
  const status: DeviceStatus = state.connectivity === "OFFLINE" ? "offline" : state.reported.powerWatts && state.reported.powerWatts > 700 ? "warning" : "online";
  const control = getDeviceControl(device, state);
  const canPower = getCapability(device, "POWER") !== undefined;
  const busy = state.commandStatus === "PENDING" || state.commandStatus === "ACCEPTED";

  return (
    <div
      className={cn(
        "rounded-3xl border border-white/10 bg-card/80 p-5 shadow-xl shadow-black/20 backdrop-blur transition hover:-translate-y-0.5 hover:border-white/20",
        compact &&
          "grid grid-cols-1 gap-5 md:grid-cols-[1fr_auto] md:items-center",
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <div
            className={cn(
              "flex size-12 shrink-0 items-center justify-center rounded-2xl border",
              enabled
                ? "border-blue-500/20 bg-blue-500/10 text-blue-400"
                : "border-white/10 bg-white/[0.04] text-muted-foreground",
            )}
          >
            <Icon className="size-5" />
          </div>

          <div className="min-w-0">
            <h2 className="truncate font-semibold text-white">{device.name}</h2>
            <p className="truncate text-sm text-muted-foreground">
              {roomName ?? "Unassigned"} · {deviceMeta(device)}
            </p>
          </div>
        </div>

        {canPower && (
          <Switch
            checked={enabled}
            disabled={state.connectivity === "OFFLINE" || busy}
            onCheckedChange={(checked) => void store.sendCommand(device.id, checked ? "TURN_ON" : "TURN_OFF").catch(() => undefined)}
          />
        )}
      </div>

      <div className={cn("mt-6 space-y-4", compact && "mt-0 md:w-[360px]")}>
        <div className="flex items-center justify-between gap-3">
          <StatusBadge status={status} />

          <span className="text-sm font-semibold text-white">
            {getDeviceReading(device, state)}
          </span>
        </div>

        <DeviceControl
          device={device}
          state={state}
          status={status}
          control={control}
        />

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{new Date(state.lastReportedAt).toLocaleString()}</span>
          <span>{busy ? state.commandStatus : state.commandStatus === "FAILED" || state.commandStatus === "TIMEOUT" ? state.commandStatus : enabled ? "Active" : "Inactive"}</span>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: DeviceStatus }) {
  const styles = {
    online: "border-green-500/20 bg-green-500/10 text-green-400",
    offline: "border-red-500/20 bg-red-500/10 text-red-400",
    warning: "border-amber-500/20 bg-amber-500/10 text-amber-400",
  };

  return (
    <Badge variant="outline" className={cn("rounded-full", styles[status])}>
      <span className="mr-1.5 size-1.5 rounded-full bg-current" />
      {status}
    </Badge>
  );
}
