"use client";
import { Bolt } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { DashboardEmptyState } from "@/components/dashboard-empty-state";
import { useSmartEstate } from "@/components/providers/device-state-provider";
export default function EnergyPage(){const {currentHouse}=useSmartEstate();return <DashboardShell><section><p className="text-sm text-muted-foreground">{currentHouse?.name??"No house selected"}</p><h1 className="mt-1 text-3xl font-semibold text-white">Energy</h1></section><DashboardEmptyState icon={Bolt} title="No measurements available" description="Energy analytics requires compatible metering hardware and backend telemetry. No consumption or savings estimates are currently available." /></DashboardShell>}
