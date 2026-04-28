"use client";

import * as React from "react";
import {
  Bell,
  Bot,
  Clock3,
  Gauge,
  Globe2,
  Moon,
  Save,
  Settings2,
  ShieldCheck,
  Sun,
  Thermometer,
  Wifi,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export default function SettingsPage() {
  const [theme, setTheme] = React.useState("dark");
  const [temperatureUnit, setTemperatureUnit] = React.useState("celsius");
  const [energyUnit, setEnergyUnit] = React.useState("kwh");

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
                  Nexora system configuration
                </p>
                <h1 className="mt-1 text-3xl font-semibold tracking-tight text-white">
                  Settings
                </h1>
                {/* <p className="mt-2 text-sm text-muted-foreground">
                  Configure system preferences, automation behavior, alerts, and device defaults.
                </p> */}
              </div>

              <Button className="w-fit rounded-2xl bg-blue-500 px-5 text-white shadow-lg shadow-blue-500/20 hover:bg-blue-400">
                <Save className="size-4" />
                Save Changes
              </Button>
            </section>

            <section className="grid gap-5 xl:grid-cols-[0.85fr_1.15fr]">
              <SystemProfileCard />

              <div className="grid gap-5">
                <SettingsCard
                  icon={Moon}
                  title="Appearance"
                  description="Choose the visual experience for the dashboard."
                >
                  <div className="grid gap-3 sm:grid-cols-2">
                    <SettingOption
                      active={theme === "dark"}
                      icon={Moon}
                      title="Dark Mode"
                      description="Premium low-light dashboard experience."
                      onClick={() => setTheme("dark")}
                    />
                    <SettingOption
                      active={theme === "light"}
                      icon={Sun}
                      title="Light Mode"
                      description="Bright interface for daytime monitoring."
                      onClick={() => setTheme("light")}
                    />
                  </div>
                </SettingsCard>

                <SettingsCard
                  icon={Gauge}
                  title="Measurement Units"
                  description="Set preferred units for comfort and energy reporting."
                >
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Temperature Unit">
                      <Select
                        value={temperatureUnit}
                        onValueChange={setTemperatureUnit}
                      >
                        <SelectTrigger className="rounded-2xl w-full border-white/10 bg-white/[0.04] text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-md p-1 border-white/10 bg-[#111827] text-white">
                          <SelectItem value="celsius">Celsius (°C)</SelectItem>
                          <SelectItem value="fahrenheit">Fahrenheit (°F)</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>

                    <Field label="Energy Unit">
                      <Select value={energyUnit} onValueChange={setEnergyUnit}>
                        <SelectTrigger className="rounded-2xl w-full border-white/10 bg-white/[0.04] text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-md p-1 border-white/10 bg-[#111827] text-white">
                          <SelectItem value="kwh">Kilowatt-hour (kWh)</SelectItem>
                          <SelectItem value="watts">Watts (W)</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                  </div>
                </SettingsCard>
              </div>
            </section>

            <section className="grid gap-5 xl:grid-cols-3">
              <PreferenceGroup
                icon={Bot}
                title="Automation Defaults"
                description="Control how smart rules behave by default."
                items={[
                  "Enable new automations by default",
                  "Pause automations when security is disarmed",
                  "Allow energy-saving rules to override manual device states",
                ]}
              />

              <PreferenceGroup
                icon={Bell}
                title="Alert Preferences"
                description="Choose which events should notify the user."
                items={[
                  "Notify on door and motion activity",
                  "Notify when a device goes offline",
                  "Notify on unusual energy spikes",
                ]}
              />

              <PreferenceGroup
                icon={Wifi}
                title="Device Behavior"
                description="Manage how devices reconnect and report status."
                items={[
                  "Auto-reconnect offline devices",
                  "Run daily health checks",
                  "Show low battery warnings",
                ]}
              />
            </section>
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}

function SystemProfileCard() {
  return (
    <Card className="border-white/10 bg-card/80 shadow-xl shadow-black/20 backdrop-blur">
      <CardHeader>
        <div className="mb-3 flex size-12 items-center justify-center rounded-2xl border border-blue-500/20 bg-blue-500/10 text-blue-400">
          <Settings2 className="size-5" />
        </div>
        <CardTitle className="text-white">Nexora Home System</CardTitle>
        <CardDescription>
          Demo smart home environment configured for portfolio presentation.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <ProfileRow icon={ShieldCheck} label="Security Mode" value="Armed" tone="green" />
        <ProfileRow icon={Zap} label="Energy Rules" value="Active" tone="blue" />
        <ProfileRow icon={Thermometer} label="Climate Mode" value="Comfort" tone="amber" />
        <ProfileRow icon={Globe2} label="Region" value="Uganda" tone="neutral" />

        <div className="rounded-xl border border-green-500/20 bg-green-500/10 p-4">
          <p className="text-sm font-semibold text-green-400">
            System healthy
          </p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            All major modules are connected: devices, rooms, automation,
            analytics, security, and energy.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function SettingsCard({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="border-white/10 bg-card/80 shadow-xl shadow-black/20 backdrop-blur">
      <CardHeader>
        <div className="flex gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-blue-500/20 bg-blue-500/10 text-blue-400">
            <Icon className="size-5" />
          </div>

          <div>
            <CardTitle className="text-white">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent>{children}</CardContent>
    </Card>
  );
}

function SettingOption({
  active,
  icon: Icon,
  title,
  description,
  onClick,
}: {
  active: boolean;
  icon: React.ElementType;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-xl border p-4 text-left transition hover:-translate-y-0.5 hover:border-white/20",
        active
          ? "border-blue-500/30 bg-blue-500/10"
          : "border-white/10 bg-white/[0.03]"
      )}
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <div
          className={cn(
            "flex size-10 items-center justify-center rounded-2xl border",
            active
              ? "border-blue-500/20 bg-blue-500/10 text-blue-400"
              : "border-white/10 bg-white/[0.04] text-muted-foreground"
          )}
        >
          <Icon className="size-4" />
        </div>

        {active && (
          <Badge
            variant="outline"
            className="rounded-full border-blue-500/20 bg-blue-500/10 text-blue-400"
          >
            Active
          </Badge>
        )}
      </div>

      <h3 className="text-sm font-semibold text-white">{title}</h3>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">
        {description}
      </p>
    </button>
  );
}

function PreferenceGroup({
  icon: Icon,
  title,
  description,
  items,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  items: string[];
}) {
  const [enabled, setEnabled] = React.useState(
    items.reduce<Record<string, boolean>>((acc, item) => {
      acc[item] = true;
      return acc;
    }, {})
  );

  return (
    <Card className="border-white/10 bg-card/80 shadow-xl shadow-black/20 backdrop-blur">
      <CardHeader>
        <div className="flex gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-blue-500/20 bg-blue-500/10 text-blue-400">
            <Icon className="size-5" />
          </div>

          <div>
            <CardTitle className="text-white">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {items.map((item) => (
          <div
            key={item}
            className="flex items-center justify-between gap-4 rounded-3xl border border-white/10 bg-white/[0.03] p-4"
          >
            <p className="text-sm leading-6 text-white">{item}</p>
            <Switch
              checked={enabled[item]}
              onCheckedChange={(checked) =>
                setEnabled((current) => ({
                  ...current,
                  [item]: checked,
                }))
              }
            />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function ProfileRow({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  tone: "green" | "blue" | "amber" | "neutral";
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
            tone === "neutral" && "border-white/10 bg-white/[0.04] text-muted-foreground"
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

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-2">
      <span className="text-sm font-medium text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}