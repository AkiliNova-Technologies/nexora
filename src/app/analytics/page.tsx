"use client";
import { BarChart3 } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { DashboardEmptyState } from "@/components/dashboard-empty-state";
import { useSmartEstate } from "@/components/providers/device-state-provider";
export default function AnalyticsPage(){const {currentHouse,error}=useSmartEstate();return <DashboardShell><section><p className="text-sm text-muted-foreground">{currentHouse?.name??"No house selected"}</p><h1 className="mt-1 text-3xl font-semibold text-white">Analytics</h1></section>{error?<div role="alert" className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">{error}</div>:<DashboardEmptyState icon={BarChart3} title="No activity data available" description="Charts and insights will appear when the backend exposes authoritative time-series measurements for this house." />}</DashboardShell>}
