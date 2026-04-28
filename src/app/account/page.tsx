"use client";

import {
  Activity,
  BadgeCheck,
  Bell,
  Bot,
  CalendarDays,
  Home,
  Mail,
  MapPin,
  ShieldCheck,
  Smartphone,
  UserRound,
  Wifi,
  Zap,
} from "lucide-react";

import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const accountStats = [
  { label: "Connected Rooms", value: "8", icon: Home },
  { label: "Smart Devices", value: "42", icon: Wifi },
  { label: "Active Rules", value: "18", icon: Bot },
  { label: "Alerts Today", value: "3", icon: Bell },
];

const activity = [
  "Enabled Smart Cooling automation",
  "Viewed Security events",
  "Adjusted Living Room temperature",
  "Reviewed Energy recommendations",
];

export default function AccountPage() {
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
            <section>
              <p className="text-sm text-muted-foreground">
                User profile and access
              </p>
              <h1 className="mt-1 text-3xl font-semibold tracking-tight text-white">
                Account
              </h1>
            </section>

            <section className="grid gap-5 xl:grid-cols-[0.85fr_1.15fr]">
              <ProfileCard />
              <AccountStats />
            </section>

            <section className="grid gap-5 xl:grid-cols-[1fr_0.9fr]">
              <ConnectedModules />
              <RecentActivity />
            </section>
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}

function ProfileCard() {
  return (
    <Card className="border-white/10 bg-card/80 shadow-xl shadow-black/20 backdrop-blur">
      <CardHeader>
        <Avatar className="size-20 rounded-md">
            <AvatarFallback className="rounded-md bg-blue-500 text-white text-3xl font-bold">
              A
            </AvatarFallback>
          </Avatar>

        <CardTitle className="text-white">Albert</CardTitle>
        <CardDescription>Nexora Home Administrator</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <ProfileRow icon={Mail} label="Email" value="admin@nexora.home" />
        <ProfileRow icon={ShieldCheck} label="Role" value="System Admin" />
        <ProfileRow icon={MapPin} label="Home Region" value="Kampala, Uganda" />

        <Button className="mt-2 w-full h-11 rounded-2xl bg-blue-500 text-white shadow-lg shadow-blue-500/20 hover:bg-blue-400">
          <UserRound className="size-4" />
          Edit Profile
        </Button>
      </CardContent>
    </Card>
  );
}

function AccountStats() {
  return (
    <Card className="border-white/10 bg-card/80 shadow-xl shadow-black/20 backdrop-blur">
      <CardHeader>
        <CardTitle className="text-white">Smart Home Summary</CardTitle>
        <CardDescription>
          Overview of connected rooms, devices, rules, and alerts.
        </CardDescription>
      </CardHeader>

      <CardContent className="grid gap-4 sm:grid-cols-2">
        {accountStats.map((item) => {
          const Icon = item.icon;

          return (
            <div
              key={item.label}
              className="rounded-xl border border-white/10 bg-white/[0.03] p-5"
            >
              <div className="mb-4 flex size-11 items-center justify-center rounded-2xl border border-blue-500/20 bg-blue-500/10 text-blue-400">
                <Icon className="size-5" />
              </div>

              <p className="text-sm text-muted-foreground">{item.label}</p>
              <p className="mt-1 text-3xl font-semibold text-white">
                {item.value}
              </p>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function ConnectedModules() {
  const modules = [
    {
      name: "Security",
      status: "Armed",
      icon: ShieldCheck,
      tone: "green",
    },
    {
      name: "Automation",
      status: "18 active rules",
      icon: Bot,
      tone: "blue",
    },
    {
      name: "Energy",
      status: "12% saved",
      icon: Zap,
      tone: "amber",
    },
    {
      name: "Mobile Access",
      status: "Connected",
      icon: Smartphone,
      tone: "green",
    },
  ];

  return (
    <Card className="border-white/10 bg-card/80 shadow-xl shadow-black/20 backdrop-blur">
      <CardHeader>
        <CardTitle className="text-white">Connected Modules</CardTitle>
        <CardDescription>
          Active Nexora modules attached to this account.
        </CardDescription>
      </CardHeader>

      <CardContent className="grid gap-4 sm:grid-cols-2">
        {modules.map((module) => {
          const Icon = module.icon;

          return (
            <div
              key={module.name}
              className="rounded-xl border border-white/10 bg-white/[0.03] p-4"
            >
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="flex size-11 items-center justify-center rounded-2xl border border-blue-500/20 bg-blue-500/10 text-blue-400">
                  <Icon className="size-5" />
                </div>

                <Badge
                  variant="outline"
                  className="rounded-full border-green-500/20 bg-green-500/10 text-green-400"
                >
                  Active
                </Badge>
              </div>

              <h3 className="font-semibold text-white">{module.name}</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {module.status}
              </p>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function RecentActivity() {
  return (
    <Card className="border-white/10 bg-card/80 shadow-xl shadow-black/20 backdrop-blur">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Activity className="size-5 text-blue-400" />
          <CardTitle className="text-white">Recent Activity</CardTitle>
        </div>
        <CardDescription>
          Latest account actions across the smart home dashboard.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {activity.map((item, index) => (
          <div
            key={item}
            className="flex gap-3 rounded-3xl border border-white/10 bg-white/[0.03] p-4"
          >
            <div className="flex size-9 shrink-0 items-center justify-center rounded-2xl border border-blue-500/20 bg-blue-500/10 text-blue-400">
              <BadgeCheck className="size-4" />
            </div>

            <div>
              <p className="text-sm font-medium text-white">{item}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {index + 2} min ago
              </p>
            </div>
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
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-3xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-center gap-3">
        <Icon className="size-4 text-blue-400" />
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>

      <span className="text-sm font-semibold text-white">{value}</span>
    </div>
  );
}