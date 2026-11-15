"use client";

import * as React from "react";
import {
  Activity,
  Cpu,
  Home,
  DoorOpen,
  Lightbulb,
  Lock,
} from "lucide-react";

import { NavMain } from "@/components/nav-main";
import { NavUser } from "@/components/nav-user";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useSmartEstate } from "@/components/providers/device-state-provider";
import { useRouter } from "next/navigation";

const data = {
  user: {
    name: "Albert",
    email: "Nexora Admin",
    avatar: "",
  },
  navMain: [
    {
      title: "Dashboard",
      url: "/dashboard",
      icon: <Home />,
      isActive: true,
    },
    {
      title: "Rooms",
      url: "/rooms",
      icon: <Lightbulb />,
    },
    {
      title: "Devices",
      url: "/devices",
      icon: <Cpu />,
    },
    {
      title: "Security",
      url: "/security",
      icon: <Lock />,
    },
    {
      title: "Entrance Gate",
      url: "/gate",
      icon: <DoorOpen />,
    },
  ],
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { user, houses, currentHouse, eventStatus, logout, selectHouse } = useSmartEstate();
  const router = useRouter();
  return (
    <Sidebar collapsible="offcanvas" className="border-white/10" {...props}>
      <SidebarHeader className="border-b border-white/10">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="h-14 px-3 hover:bg-white/[0.04] data-[slot=sidebar-menu-button]:p-2!"
            >
              <a href="/dashboard">
                <div className="mr-2 flex size-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 shadow-lg shadow-blue-500/10 backdrop-blur">
                  <span className="text-2xl font-bold text-[#3B82F6]">N</span>
                </div>

                <div className="grid flex-1 text-left leading-tight">
                  <span className="text-base font-semibold text-white">
                    Nexora Home
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Smart IoT Control
                  </span>
                </div>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent className="px-2 py-4">
        <NavMain items={data.navMain} />

        {houses.length > 1 && <label className="mx-2 mt-4 block text-xs text-muted-foreground lg:hidden"><span className="mb-2 block">Selected house</span><select aria-label="Select house" value={currentHouse?.id ?? ""} onChange={(event)=>selectHouse(event.target.value)} className="h-10 w-full rounded-xl border border-white/10 bg-[#111827] px-3 text-sm text-white outline-none focus-visible:ring-2 focus-visible:ring-blue-500"><option value="" disabled>Select a house</option>{houses.map(house=><option key={house.id} value={house.id}>{house.name}</option>)}</select></label>}

        <div className="mx-2 mt-6 rounded-xl border border-white/10 bg-white/[0.04] p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className={eventStatus === "live" ? "size-4 text-green-400" : eventStatus === "reconnecting" ? "size-4 text-amber-400" : "size-4 text-muted-foreground"} />
              <span className="text-sm font-medium text-white">
                {eventStatus === "live" ? "Live Status" : eventStatus === "reconnecting" ? "Reconnecting" : "System Status"}
              </span>
            </div>
            <span className={eventStatus === "live" ? "size-2 rounded-full bg-green-400" : eventStatus === "reconnecting" ? "size-2 rounded-full bg-amber-400" : "size-2 rounded-full bg-slate-500"} />
          </div>

          <div className="space-y-3 text-xs text-muted-foreground">
            <div className="flex items-center justify-between">
              <span>Cloud connection</span>
              <span className="font-medium capitalize text-white">{eventStatus === "idle" ? "Unknown" : eventStatus}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>House</span>
              <span className="max-w-32 truncate font-medium text-white">{currentHouse?.name ?? "Not assigned"}</span>
            </div>
          </div>
        </div>

      </SidebarContent>

      <SidebarFooter className="border-t border-white/10 p-2">
        <NavUser user={{ name: user?.name ?? data.user.name, email: user?.email ?? data.user.email, avatar: "" }} onLogout={() => { void logout().finally(() => router.replace("/login")); }} />
      </SidebarFooter>
    </Sidebar>
  );
}
