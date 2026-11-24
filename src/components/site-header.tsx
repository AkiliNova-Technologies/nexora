"use client";

import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Bell, Cloud, CloudOff, Search } from "lucide-react";
import { useSmartEstate } from "@/components/providers/device-state-provider";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { Select,SelectContent,SelectItem,SelectTrigger,SelectValue } from "@/components/ui/select";

const pageMeta: Record<string, { title: string; description: string }> = {
  // Admin entries come first so nested admin routes match them before "/admin".
  "/admin/houses": { title: "Houses", description: "Homeowners, devices and security scope" },
  "/admin/residents": { title: "Residents", description: "Homeowner assignments across the estate" },
  "/admin/devices": { title: "Devices", description: "Monitor and control every estate device" },
  "/admin/security": { title: "Estate Security", description: "House and perimeter security modes" },
  "/admin/gate": { title: "Entrance Gate", description: "Shared entrance state and safety controls" },
  "/admin/controllers": { title: "Controllers", description: "Connectivity and hardware readiness" },
  "/admin/activity": { title: "Activity", description: "Recent commands and security events" },
  "/admin/settings": { title: "Estate Settings", description: "Estate identity and workspace configuration" },
  "/admin": { title: "Estate Overview", description: "Live operational data across the estate" },
  "/dashboard": {
    title: "Home Overview",
    description: "Live device monitoring and automation control",
  },
  "/rooms": {
    title: "Rooms",
    description: "Manage room zones, active devices, and smart scenes",
  },
  "/devices": {
    title: "Devices",
    description: "Monitor and control all connected smart devices",
  },
  "/automation": {
    title: "Automation",
    description: "Create and manage intelligent home automation rules",
  },
  "/analytics": {
    title: "Analytics",
    description: "Track energy usage, comfort trends, and device activity",
  },
  "/security": {
    title: "Security",
    description: "Monitor sensors, cameras, alerts, and access events",
  },
  "/energy": {
    title: "Energy",
    description: "Optimize power consumption across your smart home",
  },
  "/settings": {
    title: "Settings",
    description: "Configure system preferences and automation behavior",
  },
  "/account": {
    title: "Account",
    description: "View profile, subscription, and system health status",
  },
  "/alerts": {
    title: "Alerts",
    description: "Review and manage recent security and system alerts",
  },
};

export function SiteHeader() {
  const pathname = usePathname();
  const { eventStatus, user, houses, currentHouse, selectHouse } = useSmartEstate();
  // The homeowner house picker does not apply to the estate administrator workspace.
  const isAdmin = pathname === "/admin" || pathname.startsWith("/admin/");

  const currentPage =
    pageMeta[pathname] ??
    Object.entries(pageMeta).find(([path]) =>
      pathname.startsWith(`${path}/`),
    )?.[1] ??
    pageMeta["/dashboard"];

  return (
    <header className="sticky top-0 z-30 flex h-(--header-height) shrink-0 items-center border-b border-white/10 bg-[#0B0F14]/80 py-9 backdrop-blur-xl">
      <div className="flex w-full items-center justify-between gap-4 px-4 lg:px-6">
        <div className="flex items-center gap-3">
          <SidebarTrigger className="-ml-1 text-white hover:bg-white/10 hover:text-white" />

          <Separator
            orientation="vertical"
            className="mx-1 bg-white/10 data-[orientation=vertical]:h-5"
          />

          <div>
            <h1 className="text-base font-semibold text-white">
              {currentPage.title}
            </h1>
            <p className="text-xs text-muted-foreground">
              {currentPage.description}
            </p>
          </div>
        </div>

        <div className="hidden flex-1 justify-center px-8 md:flex">
          <div className="flex h-10 w-full max-w-md items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 text-sm text-muted-foreground">
            <Search className="size-4" />
            <span>{isAdmin ? "Search houses, devices, residents..." : "Search devices, rooms, automations..."}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!isAdmin && houses.length > 1 && <div className="hidden items-center gap-2 text-xs text-muted-foreground lg:flex"><span>House</span><Select value={currentHouse?.id} onValueChange={selectHouse}><SelectTrigger aria-label="Select house" className="h-9 w-44 border-white/10 bg-[#111827]"><SelectValue placeholder="Select a house"/></SelectTrigger><SelectContent>{houses.map(house=><SelectItem key={house.id} value={house.id}>{house.name}</SelectItem>)}</SelectContent></Select></div>}
          <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-medium text-muted-foreground sm:flex">
            {eventStatus === "live" ? <Cloud className="size-4 text-green-400" /> : <CloudOff className="size-4 text-amber-400" />}
            {eventStatus === "live" ? "Cloud connected" : eventStatus === "reconnecting" ? "Cloud reconnecting" : "Cloud status unknown"}
          </div>

          <Button
            size="icon"
            variant="outline"
            className="rounded-full border-white/10 bg-white/[0.04] text-white hover:bg-white/10 hover:text-white"
          >
            <Bell className="size-4" />
            <span className="sr-only">Notifications</span>
          </Button>

          <Avatar className="h-9 w-9 rounded-xl">
            <AvatarFallback className="rounded-xl bg-blue-500 text-white">
              {(user?.name ?? "User").slice(0, 1).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </div>
      </div>
    </header>
  );
}
