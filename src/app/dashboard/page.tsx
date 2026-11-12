"use client";

import { AppSidebar } from "@/components/app-sidebar";
import { ChartAreaInteractive } from "@/components/chart-area-interactive";
import { DataTable } from "@/components/data-table";
import { SectionCards, type MetricCardItem } from "@/components/section-cards";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

import data from "./data.json";
import { Activity, Cpu, PlugZap, ShieldCheck } from "lucide-react";
import { useDevices, useSmartEstate } from "@/components/providers/device-state-provider";

export default function DashboardPage() {
  const { dashboard, currentHouse, eventStatus } = useSmartEstate();
  const { devices, states } = useDevices();
  const online = dashboard?.onlineDevices ?? Object.values(states).filter((state) => state.connectivity === "ONLINE").length;
  const metrics: MetricCardItem[] = [
    { title: "Total Devices", value: dashboard?.totalDevices ?? devices.length, badge: `${online} online`, icon: Cpu, tone: "blue", footerTitle: currentHouse?.name ?? "Current house", footerText: `Live updates: ${eventStatus}` },
    { title: "Online Devices", value: online, badge: devices.length ? `${Math.round((online / devices.length) * 100)}%` : "0%", icon: Activity, tone: "green", footerTitle: "Current connectivity", footerText: "Reported by the device state service" },
    { title: "Energy Today", value: `${dashboard?.energyTodayKwh ?? 0} kWh`, icon: PlugZap, tone: "amber", footerTitle: "Backend summary", footerText: "Aggregate for the selected house" },
    { title: "Security Mode", value: dashboard?.securityMode ?? "—", badge: `${dashboard?.activeAutomations ?? 0} automations`, icon: ShieldCheck, tone: "purple", footerTitle: "House security", footerText: "Current dashboard state" },
  ];
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
          <div className="@container/main flex flex-1 flex-col gap-2">
            <div className="flex flex-col gap-5 px-4 py-4 md:gap-6 md:px-6 md:py-6">
              <section>
                <p className="text-sm text-muted-foreground">
                  Real-time smart home intelligence
                </p>
                <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white md:text-3xl">
                  Home Overview
                </h1>
              </section>

              <SectionCards items={metrics} />

              <div className="grid gap-5 xl:grid-cols-[1.5fr_0.9fr]">
                <ChartAreaInteractive />

                <div className="rounded-2xl border border-white/10 bg-card/80 p-5 shadow-xl shadow-black/20 backdrop-blur">
                  <div className="mb-5">
                    <h2 className="text-lg font-semibold text-white">
                      Automation Preview
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      Active smart rules across the home.
                    </p>
                  </div>

                  <div className="space-y-4">
                    {[
                      {
                        rule: "Motion detected",
                        action: "Turn on hallway lights",
                        status: "Active",
                      },
                      {
                        rule: "Temperature above 30°C",
                        action: "Activate cooling mode",
                        status: "Monitoring",
                      },
                      {
                        rule: "Door opened after 10 PM",
                        action: "Send security alert",
                        status: "Armed",
                      },
                    ].map((item) => (
                      <div
                        key={item.rule}
                        className="rounded-xl border border-white/10 bg-white/[0.03] p-4"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-medium text-white">
                            If {item.rule}
                          </p>
                          <span className="rounded-full bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-400">
                            {item.status}
                          </span>
                        </div>
                        <p className="mt-2 text-sm text-muted-foreground">
                          → {item.action}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <DataTable data={data} />
            </div>
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
