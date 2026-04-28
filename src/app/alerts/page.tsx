"use client";

import * as React from "react";
import {
  AlertTriangle,
  Bell,
  BellRing,
  Camera,
  DoorOpen,
  Mail,
  MessageSquare,
  Radar,
  Save,
  ShieldCheck,
  Smartphone,
  Thermometer,
  WifiOff,
  Zap,
} from "lucide-react";

import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

const alertChannels = [
  {
    title: "Push Notifications",
    description: "Instant alerts on connected mobile devices.",
    icon: Smartphone,
    enabled: true,
  },
  {
    title: "Email Alerts",
    description: "Receive important summaries and critical events by email.",
    icon: Mail,
    enabled: true,
  },
  {
    title: "In-App Alerts",
    description: "Show alerts inside the Nexora dashboard interface.",
    icon: Bell,
    enabled: true,
  },
  {
    title: "SMS Alerts",
    description: "Fallback text alerts for critical security events.",
    icon: MessageSquare,
    enabled: false,
  },
];

const alertTypes = [
  {
    title: "Door Activity",
    description: "Notify when doors are opened, closed, locked, or unlocked.",
    icon: DoorOpen,
    tone: "blue",
    enabled: true,
  },
  {
    title: "Motion Detection",
    description: "Alert when motion is detected in protected zones.",
    icon: Radar,
    tone: "amber",
    enabled: true,
  },
  {
    title: "Camera Offline",
    description: "Notify when a camera loses connection or stops streaming.",
    icon: Camera,
    tone: "red",
    enabled: true,
  },
  {
    title: "Temperature Warning",
    description: "Alert when room temperatures exceed safe comfort limits.",
    icon: Thermometer,
    tone: "amber",
    enabled: true,
  },
  {
    title: "Energy Spike",
    description: "Warn when a device consumes unusual power.",
    icon: Zap,
    tone: "green",
    enabled: true,
  },
  {
    title: "Device Offline",
    description: "Notify when any smart device stops reporting status.",
    icon: WifiOff,
    tone: "red",
    enabled: true,
  },
];

const recentAlerts = [
  {
    title: "Garage camera offline",
    description: "Camera lost connection 1 hour ago.",
    severity: "critical",
    icon: Camera,
  },
  {
    title: "Motion detected",
    description: "Living Room motion detected during armed mode.",
    severity: "warning",
    icon: Radar,
  },
  {
    title: "Energy spike detected",
    description: "Kitchen Smart Plug exceeded normal load.",
    severity: "info",
    icon: Zap,
  },
];

export default function AlertsPage() {
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
                  Notification and alert control
                </p>
                <h1 className="mt-1 text-3xl font-semibold tracking-tight text-white">
                  Alert Preferences
                </h1>
              </div>

              <Button className="w-fit rounded-2xl bg-blue-500 px-5 text-white shadow-lg shadow-blue-500/20 hover:bg-blue-400">
                <Save className="size-4" />
                Save Preferences
              </Button>
            </section>

            <section className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
              <AlertSummary />
              <NotificationChannels />
            </section>

            <section className="grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
              <AlertTypes />
              <RecentAlerts />
            </section>
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}

function AlertSummary() {
  return (
    <Card className="border-white/10 bg-card/80 shadow-xl shadow-black/20 backdrop-blur">
      <CardHeader>
        <div className="mb-3 flex size-12 items-center justify-center rounded-2xl border border-blue-500/20 bg-blue-500/10 text-blue-400">
          <BellRing className="size-5" />
        </div>

        <CardTitle className="text-white">Alert System</CardTitle>
        <CardDescription>
          Current alert profile for the Nexora demo home.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <SummaryRow icon={ShieldCheck} label="Security Alerts" value="Enabled" tone="green" />
        <SummaryRow icon={AlertTriangle} label="Critical Alerts" value="Immediate" tone="red" />
        <SummaryRow icon={Thermometer} label="Comfort Alerts" value="Enabled" tone="amber" />
        <SummaryRow icon={Zap} label="Energy Alerts" value="Enabled" tone="blue" />

        <div className="rounded-xl border border-green-500/20 bg-green-500/10 p-4">
          <p className="text-sm font-semibold text-green-400">
            Notifications active
          </p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Nexora is configured to notify you when important smart home events
            require attention.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function NotificationChannels() {
  return (
    <Card className="border-white/10 bg-card/80 shadow-xl shadow-black/20 backdrop-blur">
      <CardHeader>
        <CardTitle className="text-white">Notification Channels</CardTitle>
        <CardDescription>
          Choose where alerts should be delivered.
        </CardDescription>
      </CardHeader>

      <CardContent className="grid gap-4 sm:grid-cols-2">
        {alertChannels.map((channel) => (
          <ToggleCard
            key={channel.title}
            title={channel.title}
            description={channel.description}
            icon={channel.icon}
            defaultEnabled={channel.enabled}
          />
        ))}
      </CardContent>
    </Card>
  );
}

function AlertTypes() {
  return (
    <Card className="border-white/10 bg-card/80 shadow-xl shadow-black/20 backdrop-blur">
      <CardHeader>
        <CardTitle className="text-white">Alert Types</CardTitle>
        <CardDescription>
          Control which smart home events should generate alerts.
        </CardDescription>
      </CardHeader>

      <CardContent className="grid gap-4 md:grid-cols-2">
        {alertTypes.map((alert) => (
          <ToggleCard
            key={alert.title}
            title={alert.title}
            description={alert.description}
            icon={alert.icon}
            tone={alert.tone}
            defaultEnabled={alert.enabled}
          />
        ))}
      </CardContent>
    </Card>
  );
}

function RecentAlerts() {
  return (
    <Card className="border-white/10 bg-card/80 shadow-xl shadow-black/20 backdrop-blur">
      <CardHeader>
        <CardTitle className="text-white">Recent Alerts</CardTitle>
        <CardDescription>
          Preview of the latest notifications from the system.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {recentAlerts.map((alert) => {
          const Icon = alert.icon;

          return (
            <div
              key={alert.title}
              className="rounded-3xl border border-white/10 bg-white/[0.03] p-4"
            >
              <div className="flex gap-3">
                <div
                  className={cn(
                    "flex size-10 shrink-0 items-center justify-center rounded-2xl border",
                    alert.severity === "critical" &&
                      "border-red-500/20 bg-red-500/10 text-red-400",
                    alert.severity === "warning" &&
                      "border-amber-500/20 bg-amber-500/10 text-amber-400",
                    alert.severity === "info" &&
                      "border-blue-500/20 bg-blue-500/10 text-blue-400"
                  )}
                >
                  <Icon className="size-4" />
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-white">
                    {alert.title}
                  </h3>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    {alert.description}
                  </p>
                </div>
              </div>
            </div>
          );
        })}

        <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 p-4">
          <p className="text-sm font-semibold text-blue-400">
            Alert routing ready
          </p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            These preferences can later connect to push notifications, email,
            SMS, or webhook integrations.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function ToggleCard({
  title,
  description,
  icon: Icon,
  defaultEnabled,
  tone = "blue",
}: {
  title: string;
  description: string;
  icon: React.ElementType;
  defaultEnabled: boolean;
  tone?: string;
}) {
  const [enabled, setEnabled] = React.useState(defaultEnabled);

  return (
    <div
      className={cn(
        "rounded-xl border bg-white/[0.03] p-4 transition hover:border-white/20",
        enabled ? "border-blue-500/20" : "border-white/10 opacity-70"
      )}
    >
      <div className="mb-4 flex items-start justify-between gap-4">
        <div
          className={cn(
            "flex size-11 shrink-0 items-center justify-center rounded-2xl border",
            tone === "blue" && "border-blue-500/20 bg-blue-500/10 text-blue-400",
            tone === "green" && "border-green-500/20 bg-green-500/10 text-green-400",
            tone === "amber" && "border-amber-500/20 bg-amber-500/10 text-amber-400",
            tone === "red" && "border-red-500/20 bg-red-500/10 text-red-400"
          )}
        >
          <Icon className="size-5" />
        </div>

        <Switch checked={enabled} onCheckedChange={setEnabled} />
      </div>

      <h3 className="text-sm font-semibold text-white">{title}</h3>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">
        {description}
      </p>

      <Badge
        variant="outline"
        className={cn(
          "mt-4 rounded-full",
          enabled
            ? "border-green-500/20 bg-green-500/10 text-green-400"
            : "border-white/10 bg-white/[0.04] text-muted-foreground"
        )}
      >
        <span className="mr-1.5 size-1.5 rounded-full bg-current" />
        {enabled ? "Enabled" : "Disabled"}
      </Badge>
    </div>
  );
}

function SummaryRow({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  tone: "green" | "blue" | "amber" | "red";
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-3xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "flex size-10 items-center justify-center rounded-2xl border",
            tone === "green" && "border-green-500/20 bg-green-500/10 text-green-400",
            tone === "blue" && "border-blue-500/20 bg-blue-500/10 text-blue-400",
            tone === "amber" && "border-amber-500/20 bg-amber-500/10 text-amber-400",
            tone === "red" && "border-red-500/20 bg-red-500/10 text-red-400"
          )}
        >
          <Icon className="size-4" />
        </div>

        <span className="text-sm text-muted-foreground">{label}</span>
      </div>

      <span className="text-sm font-semibold text-white">{value}</span>
    </div>
  );
}