"use client";

import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Bell, Search, ShieldCheck } from "lucide-react";
import { Avatar, AvatarFallback } from "./ui/avatar";

const pageMeta: Record<string, { title: string; description: string }> = {
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
};

export function SiteHeader() {
  const pathname = usePathname();

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
            <span>Search devices, rooms, automations...</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden items-center gap-2 rounded-full border border-green-500/20 bg-green-500/10 px-3 py-2 text-xs font-medium text-green-400 sm:flex">
            <ShieldCheck className="size-4" />
            System Secure
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
              A
            </AvatarFallback>
          </Avatar>
        </div>
      </div>
    </header>
  );
}
