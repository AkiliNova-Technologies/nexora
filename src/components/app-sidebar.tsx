"use client";

import * as React from "react";
import {
  Activity,
  BarChart3,
  Bolt,
  Bot,
  Cpu,
  Home,
  Lightbulb,
  Lock,
  Settings2,
  ShieldCheck,
  Thermometer,
  Zap,
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
      title: "Automation",
      url: "/automation",
      icon: <Bot />,
    },
    {
      title: "Analytics",
      url: "/analytics",
      icon: <BarChart3 />,
    },
    {
      title: "Security",
      url: "/security",
      icon: <Lock />,
    },
    {
      title: "Energy",
      url: "/energy",
      icon: <Bolt />,
    },
  ],
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
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

        <div className="mx-2 mt-6 rounded-xl border border-white/10 bg-white/[0.04] p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="size-4 text-green-400" />
              <span className="text-sm font-medium text-white">
                Live Status
              </span>
            </div>
            <span className="size-2 rounded-full bg-green-400 shadow-lg shadow-green-400/50" />
          </div>

          <div className="space-y-3 text-xs text-muted-foreground">
            <div className="flex items-center justify-between">
              <span>Temperature</span>
              <span className="font-medium text-white">24°C</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Energy Today</span>
              <span className="font-medium text-white">18.4 kWh</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Security</span>
              <span className="font-medium text-green-400">Armed</span>
            </div>
          </div>
        </div>

        <div className="mx-2 mt-4 rounded-xl border border-blue-500/20 bg-blue-500/10 p-4">
          <div className="flex items-center gap-2">
            <Thermometer className="size-4 text-blue-400" />
            <p className="text-sm font-medium text-white">Cooling Optimized</p>
          </div>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            Automation reduced energy usage by 12% this week.
          </p>
        </div>
      </SidebarContent>

      <SidebarFooter className="border-t border-white/10 p-2">
        <NavUser user={data.user} />
      </SidebarFooter>
    </Sidebar>
  );
}
