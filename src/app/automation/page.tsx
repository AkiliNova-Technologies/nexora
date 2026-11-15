"use client";
import { Bot } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { DashboardEmptyState } from "@/components/dashboard-empty-state";
import { useSmartEstate } from "@/components/providers/device-state-provider";
export default function AutomationPage(){const {currentHouse,error}=useSmartEstate();return <DashboardShell><section><p className="text-sm text-muted-foreground">{currentHouse?.name??"No house selected"}</p><h1 className="mt-1 text-3xl font-semibold text-white">Automation</h1><p className="mt-2 text-sm text-muted-foreground">Backend-managed rules and execution history.</p></section>{error&&<div role="alert" className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">{error}</div>}<DashboardEmptyState icon={Bot} title="No automations yet" description="The current backend does not expose automation rules or execution history. No rules are implied to be running." /></DashboardShell>}
