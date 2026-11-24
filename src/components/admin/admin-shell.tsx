"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Activity, Building2, Cpu, DoorOpen, Home, Router, Settings, ShieldCheck, Users } from "lucide-react";
import { NavMain } from "@/components/nav-main";
import { NavUser } from "@/components/nav-user";
import { SiteHeader } from "@/components/site-header";
import { useSmartEstate } from "@/components/providers/device-state-provider";
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarInset, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider } from "@/components/ui/sidebar";

const navMain = [
  { title: "Overview", url: "/admin", icon: <Home />, exact: true },
  { title: "Houses", url: "/admin/houses", icon: <Building2 /> },
  { title: "Residents", url: "/admin/residents", icon: <Users /> },
  { title: "Devices", url: "/admin/devices", icon: <Cpu /> },
  { title: "Security", url: "/admin/security", icon: <ShieldCheck /> },
  { title: "Entrance Gate", url: "/admin/gate", icon: <DoorOpen /> },
  { title: "Controllers", url: "/admin/controllers", icon: <Router /> },
  { title: "Activity", url: "/admin/activity", icon: <Activity /> },
  { title: "Settings", url: "/admin/settings", icon: <Settings /> },
];

/** Administrator layout built from the same sidebar, header and content shell as the homeowner dashboard. */
export function AdminShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, eventStatus, logout } = useSmartEstate();
  return (
    <SidebarProvider style={{ "--sidebar-width": "calc(var(--spacing) * 72)", "--header-height": "calc(var(--spacing) * 14)" } as React.CSSProperties}>
      <Sidebar variant="inset" collapsible="offcanvas" className="border-white/10">
        <SidebarHeader className="border-b border-white/10">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild className="h-14 px-3 hover:bg-white/[0.04] data-[slot=sidebar-menu-button]:p-2!">
                <Link href="/admin">
                  <div className="mr-2 flex size-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 shadow-lg shadow-blue-500/10 backdrop-blur">
                    <span className="text-2xl font-bold text-[#3B82F6]">N</span>
                  </div>
                  <div className="grid flex-1 text-left leading-tight">
                    <span className="text-base font-semibold text-white">Nexora Estate</span>
                    <span className="text-xs text-muted-foreground">Administrator workspace</span>
                  </div>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        <SidebarContent className="px-2 py-4">
          <NavMain items={navMain} />
          <div className="mx-2 mt-6 rounded-xl border border-white/10 bg-white/[0.04] p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className={eventStatus === "live" ? "size-4 text-green-400" : eventStatus === "reconnecting" ? "size-4 text-amber-400" : "size-4 text-muted-foreground"} />
                <span className="text-sm font-medium text-white">{eventStatus === "live" ? "Live Status" : eventStatus === "reconnecting" ? "Reconnecting" : "System Status"}</span>
              </div>
              <span className={eventStatus === "live" ? "size-2 rounded-full bg-green-400" : eventStatus === "reconnecting" ? "size-2 rounded-full bg-amber-400" : "size-2 rounded-full bg-slate-500"} />
            </div>
            <div className="space-y-3 text-xs text-muted-foreground">
              <div className="flex items-center justify-between"><span>Cloud connection</span><span className="font-medium capitalize text-white">{eventStatus === "idle" ? "Unknown" : eventStatus}</span></div>
              <div className="flex items-center justify-between"><span>Role</span><span className="font-medium text-white">Estate administrator</span></div>
            </div>
          </div>
        </SidebarContent>

        <SidebarFooter className="border-t border-white/10 p-2">
          <NavUser user={{ name: user?.name ?? "Administrator", email: user?.email ?? "", avatar: "" }} onLogout={() => { void logout().finally(() => router.replace("/login")); }} />
        </SidebarFooter>
      </Sidebar>

      <SidebarInset className="bg-transparent">
        <SiteHeader />
        <main className="flex flex-1 flex-col">
          <div className="mx-auto flex w-full flex-col gap-6 px-4 py-5 md:px-6 md:py-7">{children}</div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
