"use client";

import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider style={{ "--sidebar-width": "calc(var(--spacing) * 72)", "--header-height": "calc(var(--spacing) * 14)" } as React.CSSProperties}>
      <AppSidebar variant="inset" />
      <SidebarInset className="bg-transparent"><SiteHeader /><main className="flex flex-1 flex-col"><div className="mx-auto flex w-full flex-col gap-6 px-4 py-5 md:px-6 md:py-7">{children}</div></main></SidebarInset>
    </SidebarProvider>
  );
}
