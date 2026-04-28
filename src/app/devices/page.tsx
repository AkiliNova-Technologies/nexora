"use client";

import * as React from "react";
import {
  Camera,
  Cpu,
  Fan,
  Lightbulb,
  PlugZap,
  Plus,
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

type DeviceStatus = "online" | "offline" | "warning";
type DeviceType = "light" | "climate" | "security" | "power" | "sensor";

type Device = {
  id: string;
  name: string;
  room: string;
  type: DeviceType;
  status: DeviceStatus;
  isOn: boolean;
  value: number;
  unit: string;
  meta: string;
};

const devices: Device[] = [
  {
    id: "DEV-001",
    name: "Living Room Lights",
    room: "Living Room",
    type: "light",
    status: "online",
    isOn: true,
    value: 78,
    unit: "%",
    meta: "Brightness control",
  },
  {
    id: "DEV-002",
    name: "Bedroom Thermostat",
    room: "Bedroom",
    type: "climate",
    status: "online",
    isOn: true,
    value: 24,
    unit: "°C",
    meta: "Cooling mode",
  },
  {
    id: "DEV-003",
    name: "Kitchen Smart Plug",
    room: "Kitchen",
    type: "power",
    status: "warning",
    isOn: true,
    value: 740,
    unit: "W",
    meta: "High usage detected",
  },
  {
    id: "DEV-004",
    name: "Garage Camera",
    room: "Garage",
    type: "security",
    status: "offline",
    isOn: false,
    value: 0,
    unit: "%",
    meta: "Connection lost",
  },
  {
    id: "DEV-005",
    name: "Front Door Sensor",
    room: "Entrance",
    type: "sensor",
    status: "online",
    isOn: true,
    value: 86,
    unit: "%",
    meta: "Battery level",
  },
  {
    id: "DEV-006",
    name: "Office Fan",
    room: "Office",
    type: "climate",
    status: "online",
    isOn: false,
    value: 35,
    unit: "%",
    meta: "Speed control",
  },
];

const deviceMetrics: MetricCardItem[] = [
  {
    title: "Total Devices",
    value: "42",
    badge: "+6 online",
    trend: "up",
    icon: Cpu,
    tone: "blue",
    footerTitle: "Device network active",
    footerText: "All major rooms have connected smart devices.",
  },
  {
    title: "Online Devices",
    value: "36",
    badge: "86%",
    trend: "up",
    icon: Wifi,
    tone: "green",
    footerTitle: "Stable connectivity",
    footerText: "Most devices are responding in real time.",
  },
  {
    title: "Offline Devices",
    value: "3",
    badge: "Needs check",
    trend: "neutral",
    icon: WifiOff,
    tone: "red",
    footerTitle: "Maintenance required",
    footerText: "Some devices need reconnection or power checks.",
  },
  {
    title: "Energy Load",
    value: "2.4 kW",
    badge: "-12%",
    trend: "down",
    icon: PlugZap,
    tone: "amber",
    footerTitle: "Usage optimized",
    footerText: "Automation is reducing unnecessary consumption.",
  },
];

const deviceIconMap = {
  light: Lightbulb,
  climate: Thermometer,
  security: Camera,
  power: PlugZap,
  sensor: ShieldCheck,
};

export default function DevicesPage() {
  const [query, setQuery] = React.useState("");
  const [view, setView] = React.useState<"grid" | "compact">("grid");

  const filteredDevices = devices.filter((device) =>
    `${device.name} ${device.room} ${device.type}`
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

              <Button className="w-fit rounded-2xl bg-blue-500 px-5 text-white shadow-lg shadow-blue-500/20 hover:bg-blue-400">
                <Plus className="size-4" />
                Add Device
              </Button>
            </section>

            <SectionCards items={deviceMetrics} />

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
                  compact={view === "compact"}
                />
              ))}
            </section>
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}

function getDeviceControl(type: DeviceType) {
  switch (type) {
    case "light":
      return {
        kind: "slider" as const,
        label: "Brightness",
        min: 0,
        max: 100,
        unit: "%",
      };

    case "climate":
      return {
        kind: "slider" as const,
        label: "Temperature",
        min: 16,
        max: 30,
        unit: "°C",
      };

    case "power":
      return {
        kind: "status" as const,
        label: "Power Load",
        value: "Monitoring usage",
      };

    case "security":
      return {
        kind: "actions" as const,
        label: "Camera Controls",
        actions: ["View Feed", "Record"],
      };

    case "sensor":
      return {
        kind: "status" as const,
        label: "Sensor Reading",
        value: "Auto-reporting",
      };

    default:
      return {
        kind: "status" as const,
        label: "Device Status",
        value: "Monitoring",
      };
  }
}

function DeviceControl({
  type,
  enabled,
  status,
  value,
  setValue,
  control,
}: {
  type: DeviceType;
  enabled: boolean;
  status: DeviceStatus;
  value: number[];
  setValue: React.Dispatch<React.SetStateAction<number[]>>;
  control: ReturnType<typeof getDeviceControl>;
}) {
  const disabled = !enabled || status === "offline";

  if (control.kind === "slider") {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            {control.label}
          </span>
          <span className="text-xs font-semibold text-blue-400">
            {value[0]}
            {control.unit}
          </span>
        </div>

        <Slider
          value={value}
          onValueChange={setValue}
          min={control.min}
          max={control.max}
          step={1}
          disabled={disabled}
        />
      </div>
    );
  }

  if (control.kind === "actions") {
    return (
      <div className="grid grid-cols-2 gap-2">
        {control.actions.map((action) => (
          <Button
            key={action}
            variant="outline"
            disabled={disabled}
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

function getDeviceReading(device: Device, value: number) {
  switch (device.type) {
    case "light":
      return `${value}%`;
    case "climate":
      return `${value}°C`;
    case "power":
      return `${device.value}W`;
    case "security":
      return device.status === "offline" ? "No feed" : "Live";
    case "sensor":
      return `${device.value}% battery`;
    default:
      return `${device.value}${device.unit}`;
  }
}

function DeviceCard({
  device,
  compact,
}: {
  device: Device;
  compact?: boolean;
}) {
  const Icon = deviceIconMap[device.type];
  const [enabled, setEnabled] = React.useState(device.isOn);
  const [value, setValue] = React.useState([device.value]);

  const control = getDeviceControl(device.type);

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
              {device.room} · {device.meta}
            </p>
          </div>
        </div>

        <Switch checked={enabled} onCheckedChange={setEnabled} />
      </div>

      <div className={cn("mt-6 space-y-4", compact && "mt-0 md:w-[360px]")}>
        <div className="flex items-center justify-between gap-3">
          <StatusBadge status={device.status} />

          <span className="text-sm font-semibold text-white">
            {getDeviceReading(device, value[0])}
          </span>
        </div>

        <DeviceControl
          type={device.type}
          enabled={enabled}
          status={device.status}
          value={value}
          setValue={setValue}
          control={control}
        />

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{device.id}</span>
          <span>{enabled ? "Active" : "Inactive"}</span>
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
