"use client";

import * as React from "react";
import {
  AlertTriangle,
  BellRing,
  Camera,
  Clock3,
  DoorOpen,
  Eye,
  Lock,
  LockKeyhole,
  Plus,
  Radar,
  ShieldAlert,
  ShieldCheck,
  Siren,
  Unlock,
  Wifi,
  WifiOff,
} from "lucide-react";

import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SectionCards, type MetricCardItem } from "@/components/section-cards";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

type SecurityMode = "armed" | "home" | "disarmed";
type SecurityStatus = "safe" | "warning" | "alert";
type DeviceType = "camera" | "lock" | "motion" | "door";
type DeviceStatus = "online" | "offline" | "warning";

type SecurityDevice = {
  id: string;
  name: string;
  room: string;
  type: DeviceType;
  status: DeviceStatus;
  enabled: boolean;
  lastActive: string;
};

const securityDevices: SecurityDevice[] = [
  {
    id: "SEC-001",
    name: "Front Door Lock",
    room: "Entrance",
    type: "lock",
    status: "online",
    enabled: true,
    lastActive: "2 min ago",
  },
  {
    id: "SEC-002",
    name: "Garage Camera",
    room: "Garage",
    type: "camera",
    status: "offline",
    enabled: false,
    lastActive: "1 hr ago",
  },
  {
    id: "SEC-003",
    name: "Living Room Motion",
    room: "Living Room",
    type: "motion",
    status: "warning",
    enabled: true,
    lastActive: "8 min ago",
  },
  {
    id: "SEC-004",
    name: "Back Door Sensor",
    room: "Kitchen",
    type: "door",
    status: "online",
    enabled: true,
    lastActive: "Now",
  },
];

const securityEvents = [
  {
    title: "Back door opened",
    location: "Kitchen",
    time: "Now",
    severity: "warning",
    icon: DoorOpen,
  },
  {
    title: "Motion detected",
    location: "Living Room",
    time: "8 min ago",
    severity: "warning",
    icon: Radar,
  },
  {
    title: "Garage camera offline",
    location: "Garage",
    time: "1 hr ago",
    severity: "alert",
    icon: WifiOff,
  },
  {
    title: "Front door locked",
    location: "Entrance",
    time: "2 hrs ago",
    severity: "safe",
    icon: Lock,
  },
];

const securityMetrics: MetricCardItem[] = [
  {
    title: "Security Mode",
    value: "Armed",
    badge: "Night",
    trend: "up",
    icon: ShieldCheck,
    tone: "green",
    footerTitle: "Protection active",
    footerText: "Doors, motion sensors, and cameras are being monitored.",
  },
  {
    title: "Active Sensors",
    value: "12",
    badge: "92%",
    trend: "up",
    icon: Radar,
    tone: "blue",
    footerTitle: "Sensor network healthy",
    footerText: "Most security devices are reporting in real time.",
  },
  {
    title: "Warnings",
    value: "2",
    badge: "Review",
    trend: "neutral",
    icon: AlertTriangle,
    tone: "amber",
    footerTitle: "Attention required",
    footerText: "Motion and door events need confirmation.",
  },
  {
    title: "Offline Devices",
    value: "1",
    badge: "Camera",
    trend: "neutral",
    icon: WifiOff,
    tone: "red",
    footerTitle: "Connection issue",
    footerText: "Garage camera needs reconnection.",
  },
];

const securityDeviceIconMap = {
  camera: Camera,
  lock: LockKeyhole,
  motion: Radar,
  door: DoorOpen,
};

const statusStyles = {
  online: "border-green-500/20 bg-green-500/10 text-green-400",
  offline: "border-red-500/20 bg-red-500/10 text-red-400",
  warning: "border-amber-500/20 bg-amber-500/10 text-amber-400",
};

export default function SecurityPage() {
  const [mode, setMode] = React.useState<SecurityMode>("armed");
  const systemStatus: SecurityStatus =
    mode === "disarmed" ? "warning" : "safe";

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
                  Home protection center
                </p>
                <h1 className="mt-1 text-3xl font-semibold tracking-tight text-white">
                  Security
                </h1>
              </div>

              <Button className="w-fit rounded-2xl bg-blue-500 px-5 text-white shadow-lg shadow-blue-500/20 hover:bg-blue-400">
                <Plus className="size-4" />
                Add Security Device
              </Button>
            </section>

            <SectionCards items={securityMetrics} />

            <section className="grid gap-5 xl:grid-cols-[1fr_0.85fr]">
              <SecurityStatusPanel mode={mode} setMode={setMode} status={systemStatus} />
              <QuickActions />
            </section>

            <section className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
              <SecurityDeviceGrid />
              <SecurityEventsFeed />
            </section>
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}

function SecurityStatusPanel({
  mode,
  setMode,
  status,
}: {
  mode: SecurityMode;
  setMode: React.Dispatch<React.SetStateAction<SecurityMode>>;
  status: SecurityStatus;
}) {
  return (
    <section className="overflow-hidden rounded-[2rem] border border-green-500/20 bg-card/80 p-6 shadow-2xl shadow-black/30 backdrop-blur">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex gap-4">
          <div
            className={cn(
              "flex size-16 shrink-0 items-center justify-center rounded-3xl border",
              status === "safe" && "border-green-500/20 bg-green-500/10 text-green-400",
              status === "warning" && "border-amber-500/20 bg-amber-500/10 text-amber-400",
              status === "alert" && "border-red-500/20 bg-red-500/10 text-red-400"
            )}
          >
            <ShieldCheck className="size-8" />
          </div>

          <div>
            <Badge
              variant="outline"
              className={cn(
                "mb-3 rounded-full",
                status === "safe" && "border-green-500/20 bg-green-500/10 text-green-400",
                status === "warning" && "border-amber-500/20 bg-amber-500/10 text-amber-400",
                status === "alert" && "border-red-500/20 bg-red-500/10 text-red-400"
              )}
            >
              <span className="mr-1.5 size-1.5 rounded-full bg-current" />
              System {status}
            </Badge>

            <h2 className="text-2xl font-semibold text-white">
              Security system is {mode}
            </h2>

            <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
              Nexora is actively monitoring access points, room motion, and camera health.
            </p>
          </div>
        </div>

      </div>

        <div className="grid grid-cols-3 gap-2 rounded-3xl border border-white/10 bg-white/[0.03] p-2 mt-8">
          {(["armed", "home", "disarmed"] as SecurityMode[]).map((item) => (
            <Button
              key={item}
              variant="outline"
              onClick={() => setMode(item)}
              className={cn(
                "rounded-2xl border-white/10 bg-transparent capitalize text-muted-foreground hover:bg-white/10 hover:text-white",
                mode === item && "border-blue-500/20 bg-blue-500/15 text-blue-400"
              )}
            >
              {item}
            </Button>
          ))}
        </div>
    </section>
  );
}

function QuickActions() {
  const actions = [
    { label: "Lock All", icon: Lock, tone: "blue" },
    { label: "Panic Alert", icon: Siren, tone: "red" },
    { label: "Silence Alerts", icon: BellRing, tone: "amber" },
    { label: "View Cameras", icon: Eye, tone: "green" },
  ];

  return (
    <section className="rounded-[2rem] border border-white/10 bg-card/80 p-5 shadow-xl shadow-black/20 backdrop-blur">
      <div className="mb-5">
        <h2 className="text-lg font-semibold text-white">Quick Actions</h2>
        <p className="text-sm text-muted-foreground">
          Critical controls for immediate response.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {actions.map((action) => {
          const Icon = action.icon;

          return (
            <Button
              key={action.label}
              variant="outline"
              className={cn(
                "h-24 flex-col rounded-xl border-white/10 bg-white/[0.04] text-white hover:bg-white/10",
                action.tone === "red" && "hover:border-red-500/30 hover:text-red-400",
                action.tone === "green" && "hover:border-green-500/30 hover:text-green-400",
                action.tone === "amber" && "hover:border-amber-500/30 hover:text-amber-400",
                action.tone === "blue" && "hover:border-blue-500/30 hover:text-blue-400"
              )}
            >
              <Icon className="size-5" />
              <span>{action.label}</span>
            </Button>
          );
        })}
      </div>
    </section>
  );
}

function SecurityDeviceGrid() {
  return (
    <section className="rounded-[2rem] border border-white/10 bg-card/80 p-5 shadow-xl shadow-black/20 backdrop-blur">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white">Security Devices</h2>
          <p className="text-sm text-muted-foreground">
            Cameras, locks, sensors, and access monitors.
          </p>
        </div>
        <Badge variant="outline" className="rounded-full border-green-500/20 bg-green-500/10 text-green-400">
          <Wifi className="mr-1 size-3.5" />
          Live
        </Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {securityDevices.map((device) => (
          <SecurityDeviceCard key={device.id} device={device} />
        ))}
      </div>
    </section>
  );
}

function SecurityDeviceCard({ device }: { device: SecurityDevice }) {
  const Icon = securityDeviceIconMap[device.type];
  const [enabled, setEnabled] = React.useState(device.enabled);

  return (
    <article className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex gap-3">
          <div className={cn("flex size-11 shrink-0 items-center justify-center rounded-2xl border", statusStyles[device.status])}>
            <Icon className="size-5" />
          </div>

          <div>
            <h3 className="font-semibold text-white">{device.name}</h3>
            <p className="text-sm text-muted-foreground">{device.room}</p>
          </div>
        </div>

        <Switch checked={enabled} onCheckedChange={setEnabled} />
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 border-t border-white/10 pt-4">
        <Badge variant="outline" className={cn("rounded-full capitalize", statusStyles[device.status])}>
          <span className="mr-1.5 size-1.5 rounded-full bg-current" />
          {device.status}
        </Badge>

        <span className="text-xs text-muted-foreground">
          {device.lastActive}
        </span>
      </div>
    </article>
  );
}

function SecurityEventsFeed() {
  return (
    <section className="rounded-[2rem] border border-white/10 bg-card/80 p-5 shadow-xl shadow-black/20 backdrop-blur">
      <div className="mb-5">
        <h2 className="text-lg font-semibold text-white">Live Events</h2>
        <p className="text-sm text-muted-foreground">
          Recent security activity across the home.
        </p>
      </div>

      <div className="space-y-4">
        {securityEvents.map((event) => {
          const Icon = event.icon;

          return (
            <div
              key={`${event.title}-${event.time}`}
              className="flex gap-3 rounded-3xl border border-white/10 bg-white/[0.03] p-4"
            >
              <div
                className={cn(
                  "flex size-10 shrink-0 items-center justify-center rounded-2xl border",
                  event.severity === "safe" && "border-green-500/20 bg-green-500/10 text-green-400",
                  event.severity === "warning" && "border-amber-500/20 bg-amber-500/10 text-amber-400",
                  event.severity === "alert" && "border-red-500/20 bg-red-500/10 text-red-400"
                )}
              >
                <Icon className="size-4" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-white">
                      {event.title}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {event.location}
                    </p>
                  </div>

                  <span className="shrink-0 text-xs text-muted-foreground">
                    {event.time}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-5 rounded-xl border border-blue-500/20 bg-blue-500/10 p-4">
        <div className="flex items-center gap-2 text-blue-400">
          <ShieldAlert className="size-4" />
          <span className="text-sm font-semibold">Automation linked</span>
        </div>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Door and motion events can trigger alerts, lights, or camera recording.
        </p>
      </div>
    </section>
  );
}