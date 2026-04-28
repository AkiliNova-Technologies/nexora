"use client";

import * as React from "react";
import {
  BatteryCharging,
  Bolt,
  Clock3,
  Flame,
  Lightbulb,
  PlugZap,
  Power,
  Refrigerator,
  TrendingDown,
  Zap,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  XAxis,
  YAxis,
} from "recharts";

import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SectionCards, type MetricCardItem } from "@/components/section-cards";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { cn } from "@/lib/utils";

const energyMetrics: MetricCardItem[] = [
  {
    title: "Usage Today",
    value: "18.4 kWh",
    badge: "-12%",
    trend: "down",
    icon: PlugZap,
    tone: "green",
    footerTitle: "Energy usage improved",
    footerText: "Automation reduced idle consumption today.",
  },
  {
    title: "Estimated Cost",
    value: "$4.82",
    badge: "Today",
    trend: "neutral",
    icon: Bolt,
    tone: "blue",
    footerTitle: "Cost tracking active",
    footerText: "Based on current simulated tariff rate.",
  },
  {
    title: "Peak Load",
    value: "2.4 kW",
    badge: "6 PM",
    trend: "up",
    icon: Flame,
    tone: "amber",
    footerTitle: "Evening demand spike",
    footerText: "Kitchen and climate devices drove peak load.",
  },
  {
    title: "Saved This Week",
    value: "9.6 kWh",
    badge: "+18%",
    trend: "up",
    icon: BatteryCharging,
    tone: "purple",
    footerTitle: "Optimization working",
    footerText: "Energy rules are reducing wasteful runtime.",
  },
];

const roomEnergyData = [
  { room: "Kitchen", usage: 5.8 },
  { room: "Living", usage: 3.4 },
  { room: "Office", usage: 2.9 },
  { room: "Bedroom", usage: 2.1 },
  { room: "Security", usage: 1.2 },
];

const hourlyEnergyData = [
  { hour: "6 AM", usage: 1.2 },
  { hour: "8 AM", usage: 1.8 },
  { hour: "10 AM", usage: 2.1 },
  { hour: "12 PM", usage: 1.9 },
  { hour: "2 PM", usage: 2.4 },
  { hour: "4 PM", usage: 1.6 },
  { hour: "6 PM", usage: 1.2 },
  { hour: "8 PM", usage: 1.8 },
  { hour: "10 PM", usage: 2.1 },
  { hour: "12 AM", usage: 1.9 },
  { hour: "2 AM", usage: 2.4 },
  { hour: "4 AM", usage: 1.6 },
];

const highUsageDevices = [
  {
    name: "Kitchen Smart Plug",
    room: "Kitchen",
    usage: "5.8 kWh",
    icon: PlugZap,
    tone: "amber",
  },
  {
    name: "Bedroom Thermostat",
    room: "Bedroom",
    usage: "2.1 kWh",
    icon: Power,
    tone: "blue",
  },
  {
    name: "Refrigerator Monitor",
    room: "Kitchen",
    usage: "1.9 kWh",
    icon: Refrigerator,
    tone: "green",
  },
];

const recommendations = [
  {
    title: "Shift heavy usage away from 6 PM",
    description:
      "Peak load is highest around 6 PM. Schedule appliance-heavy tasks earlier where possible.",
    icon: Clock3,
    tone: "amber",
  },
  {
    title: "Enable idle plug shutdown",
    description:
      "Smart plugs with low activity can be turned off automatically after 30 minutes.",
    icon: Zap,
    tone: "blue",
  },
  {
    title: "Dim living room lights after 10 PM",
    description:
      "Reducing lighting brightness during late hours can lower total daily usage.",
    icon: Lightbulb,
    tone: "green",
  },
];

const chartConfig = {
  usage: {
    label: "Energy Usage",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig;

export default function EnergyPage() {
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
          <div className="mx-auto flex w-full flex-col gap-6 px-4 py-5 md:px-6 md:py-7">
            <section>
              <p className="text-sm text-muted-foreground">
                Smart energy optimization
              </p>
              <h1 className="mt-1 text-3xl font-semibold tracking-tight text-white">
                Energy Usage
              </h1>
            </section>

            <SectionCards items={energyMetrics} />

            <section className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
              <EnergyUsageByRoom />
              <EnergyRecommendations />
            </section>

            <section className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
              <HighUsageDevices />
              <HourlyEnergyChart />
            </section>
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}

function EnergyUsageByRoom() {
  return (
    <Card className="overflow-hidden border-white/10 bg-card/80 shadow-xl shadow-black/20 backdrop-blur">
      <CardHeader>
        <CardTitle className="text-white">Energy Usage by Room</CardTitle>
        <CardDescription>
          Daily consumption across connected smart zones.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <ChartContainer config={chartConfig} className="min-h-[300px] h-[400px] max-h-[480px] w-full">
          <BarChart
            accessibilityLayer
            data={roomEnergyData}
            layout="vertical"
            margin={{ right: 24 }}
          >
            <CartesianGrid horizontal={false} />
            <XAxis type="number" dataKey="usage" hide />
            <YAxis
              dataKey="room"
              type="category"
              tickLine={false}
              tickMargin={10}
              axisLine={false}
              width={80}
            />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent hideLabel />}
            />
            <Bar dataKey="usage" fill="var(--color-usage)" radius={6}>
              <LabelList
                dataKey="usage"
                position="right"
                offset={8}
                className="fill-foreground"
                fontSize={12}
                formatter={(value) => `${value} kWh`}
              />
            </Bar>
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

function HourlyEnergyChart() {
  return (
    <Card className="overflow-hidden border-white/10 bg-card/80 shadow-xl shadow-black/20 backdrop-blur">
      <CardHeader>
        <CardTitle className="text-white">Hourly Load Pattern</CardTitle>
        <CardDescription>
          Power demand across key periods of the day.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
          <BarChart accessibilityLayer data={hourlyEnergyData}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="hour"
              tickLine={false}
              tickMargin={10}
              axisLine={false}
            />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent hideLabel />}
            />
            <Bar dataKey="usage" fill="var(--color-usage)" radius={8}>
              <LabelList
                dataKey="usage"
                position="top"
                offset={10}
                className="fill-foreground"
                fontSize={12}
                formatter={(value) => `${value}`}
              />
            </Bar>
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

function HighUsageDevices() {
  return (
    <Card className="border-white/10 bg-card/80 shadow-xl shadow-black/20 backdrop-blur">
      <CardHeader>
        <CardTitle className="text-white">High-Usage Devices</CardTitle>
        <CardDescription>
          Devices contributing most to today’s consumption.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {highUsageDevices.map((device) => {
          const Icon = device.icon;

          return (
            <div
              key={device.name}
              className="rounded-3xl border border-white/10 bg-white/[0.03] p-4"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex min-w-0 items-center gap-3">
                  <div
                    className={cn(
                      "flex size-11 shrink-0 items-center justify-center rounded-2xl border",
                      device.tone === "amber" &&
                        "border-amber-500/20 bg-amber-500/10 text-amber-400",
                      device.tone === "blue" &&
                        "border-blue-500/20 bg-blue-500/10 text-blue-400",
                      device.tone === "green" &&
                        "border-green-500/20 bg-green-500/10 text-green-400"
                    )}
                  >
                    <Icon className="size-5" />
                  </div>

                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-semibold text-white">
                      {device.name}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {device.room}
                    </p>
                  </div>
                </div>

                <Badge
                  variant="outline"
                  className="rounded-full border-amber-500/20 bg-amber-500/10 text-amber-400"
                >
                  {device.usage}
                </Badge>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function EnergyRecommendations() {
  return (
    <Card className="border-white/10 bg-card/80 shadow-xl shadow-black/20 backdrop-blur">
      <CardHeader>
        <div className="flex items-center gap-2">
          <TrendingDown className="size-5 text-green-400" />
          <CardTitle className="text-white">Energy Recommendations</CardTitle>
        </div>
        <CardDescription>
          Smart suggestions to reduce waste and optimize cost.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {recommendations.map((item) => {
          const Icon = item.icon;

          return (
            <div
              key={item.title}
              className="rounded-3xl border border-white/10 bg-white/[0.03] p-4"
            >
              <div className="flex gap-3">
                <div
                  className={cn(
                    "flex size-10 shrink-0 items-center justify-center rounded-2xl border",
                    item.tone === "amber" &&
                      "border-amber-500/20 bg-amber-500/10 text-amber-400",
                    item.tone === "blue" &&
                      "border-blue-500/20 bg-blue-500/10 text-blue-400",
                    item.tone === "green" &&
                      "border-green-500/20 bg-green-500/10 text-green-400"
                  )}
                >
                  <Icon className="size-4" />
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-white">
                    {item.title}
                  </h3>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    {item.description}
                  </p>
                </div>
              </div>
            </div>
          );
        })}

        <div className="rounded-3xl border border-green-500/20 bg-green-500/10 p-4">
          <div className="flex items-center gap-2 text-green-400">
            <TrendingDown className="size-4" />
            <span className="text-sm font-semibold">Projected savings</span>
          </div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Applying all recommendations could reduce usage by another 7–10%.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}