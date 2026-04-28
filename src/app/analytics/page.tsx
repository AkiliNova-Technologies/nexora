"use client";

import * as React from "react";
import {
  Activity,
  BarChart3,
  Bot,
  Clock3,
  Flame,
  Lightbulb,
  PlugZap,
  Thermometer,
  TrendingDown,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts";

import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SectionCards, type MetricCardItem } from "@/components/section-cards";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { cn } from "@/lib/utils";

const analyticsMetrics: MetricCardItem[] = [
  {
    title: "Automation Runs",
    value: "43",
    badge: "+12%",
    trend: "up",
    icon: Bot,
    tone: "blue",
    footerTitle: "Rules executed today",
    footerText: "Most activity came from lighting and climate rules.",
  },
  {
    title: "Energy Saved",
    value: "12%",
    badge: "-2.4 kWh",
    trend: "down",
    icon: PlugZap,
    tone: "green",
    footerTitle: "Lower power usage",
    footerText: "Automation reduced idle device consumption.",
  },
  {
    title: "Avg Temperature",
    value: "24°C",
    badge: "Stable",
    trend: "neutral",
    icon: Thermometer,
    tone: "amber",
    footerTitle: "Comfort maintained",
    footerText: "Rooms stayed within preferred climate range.",
  },
  {
    title: "Device Uptime",
    value: "96%",
    badge: "+3%",
    trend: "up",
    icon: Activity,
    tone: "purple",
    footerTitle: "Strong connectivity",
    footerText: "Most devices remained responsive throughout the day.",
  },
];

const temperatureData = [
  { time: "6 AM", living: 21, bedroom: 20, kitchen: 23 },
  { time: "8 AM", living: 23, bedroom: 22, kitchen: 25 },
  { time: "10 AM", living: 25, bedroom: 24, kitchen: 27 },
  { time: "12 PM", living: 26, bedroom: 25, kitchen: 28 },
  { time: "2 PM", living: 24, bedroom: 23, kitchen: 26 },
  { time: "4 PM", living: 22, bedroom: 21, kitchen: 24 },
  { time: "6 AM", living: 21, bedroom: 20, kitchen: 23 },
  { time: "8 AM", living: 23, bedroom: 22, kitchen: 25 },
  { time: "10 PM", living: 25, bedroom: 24, kitchen: 27 },
  { time: "12 AM", living: 26, bedroom: 25, kitchen: 28 },
  { time: "2 AM", living: 24, bedroom: 23, kitchen: 26 },
  { time: "4 AM", living: 22, bedroom: 21, kitchen: 24 },
];

const energyData = [
  { room: "Living", usage: 3.4 },
  { room: "Kitchen", usage: 5.8 },
  { room: "Bedroom", usage: 2.1 },
  { room: "Office", usage: 2.9 },
  { room: "Security", usage: 1.2 },
];

const automationData = [
  { hour: "6 AM", runs: 3 },
  { hour: "8 AM", runs: 5 },
  { hour: "10 AM", runs: 12 },
  { hour: "12 PM", runs: 3 },
  { hour: "2 PM", runs: 5 },
  { hour: "4 PM", runs: 12 },
  { hour: "6 PM", runs: 3 },
  { hour: "8 PM", runs: 7 },
  { hour: "10 PM", runs: 5 },
  { hour: "00 AM", runs: 9 },
  { hour: "2 AM", runs: 12 },
  { hour: "4 AM", runs: 7 },
];

const chartConfig = {
  living: {
    label: "Living Room",
    color: "var(--chart-1)",
  },
  bedroom: {
    label: "Bedroom",
    color: "var(--chart-2)",
  },
  kitchen: {
    label: "Kitchen",
    color: "var(--chart-3)",
  },
  usage: {
    label: "Energy Usage",
    color: "var(--chart-2)",
  },
  runs: {
    label: "Automation Runs",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig;

const insights = [
  {
    title: "Kitchen has highest usage",
    description:
      "Kitchen devices consumed 5.8 kWh today, mostly from smart plugs and appliance monitoring.",
    icon: Flame,
    tone: "amber",
  },
  {
    title: "Lighting automation is efficient",
    description:
      "Motion-based lighting prevented unnecessary runtime across hallway and living zones.",
    icon: Lightbulb,
    tone: "blue",
  },
  {
    title: "Peak automation activity",
    description:
      "Most automations triggered around 6 PM when occupancy and lighting demand increased.",
    icon: Clock3,
    tone: "green",
  },
];

export default function AnalyticsPage() {
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
                Smart home performance intelligence
              </p>
              <h1 className="mt-1 text-3xl font-semibold tracking-tight text-white">
                Analytics
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Track comfort, automation behavior, energy usage, and device
                health.
              </p>
            </section>

            <SectionCards items={analyticsMetrics} />

            <section className="grid gap-5 xl:grid-cols-[1.4fr_0.8fr]">
              <AnalyticsAreaChart
                title="Temperature Trends"
                description="Room temperature changes throughout the day."
                data={temperatureData}
                config={chartConfig}
              />

              <InsightsPanel />
            </section>

            <section className="grid gap-5 xl:grid-cols-2">
              <AnalyticsBarChart
                title="Energy Usage by Room"
                description="Daily usage distribution across smart room zones."
                data={energyData}
                dataKey="usage"
                xKey="room"
              />

              <AutomationRunsChart />
            </section>
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}

function AnalyticsAreaChart({
  title,
  description,
  data,
  config,
}: {
  title: string;
  description: string;
  data: typeof temperatureData;
  config: ChartConfig;
}) {
  return (
    <Card className="overflow-hidden border-white/10 bg-card/80 pt-0 shadow-xl shadow-black/20 backdrop-blur">
      <CardHeader className="flex items-center gap-2 space-y-0 border-b border-white/10 py-5 sm:flex-row">
        <div className="grid flex-1 gap-1">
          <CardTitle className="text-white">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
      </CardHeader>

      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        <ChartContainer
          config={config}
          className="aspect-auto h-[380px] w-full"
        >
          <AreaChart accessibilityLayer data={data}>
            <defs>
              <linearGradient id="fillLiving" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="var(--color-living)"
                  stopOpacity={0.8}
                />
                <stop
                  offset="95%"
                  stopColor="var(--color-living)"
                  stopOpacity={0.1}
                />
              </linearGradient>

              <linearGradient id="fillBedroom" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="var(--color-bedroom)"
                  stopOpacity={0.7}
                />
                <stop
                  offset="95%"
                  stopColor="var(--color-bedroom)"
                  stopOpacity={0.1}
                />
              </linearGradient>

              <linearGradient id="fillKitchen" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="var(--color-kitchen)"
                  stopOpacity={0.65}
                />
                <stop
                  offset="95%"
                  stopColor="var(--color-kitchen)"
                  stopOpacity={0.1}
                />
              </linearGradient>
            </defs>

            <CartesianGrid vertical={false} />

            <XAxis
              dataKey="time"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
            />

            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent indicator="dot" />}
            />

            <Area
              dataKey="living"
              type="natural"
              fill="url(#fillLiving)"
              stroke="var(--color-living)"
              stackId="a"
            />

            <Area
              dataKey="bedroom"
              type="natural"
              fill="url(#fillBedroom)"
              stroke="var(--color-bedroom)"
              stackId="a"
            />

            <Area
              dataKey="kitchen"
              type="natural"
              fill="url(#fillKitchen)"
              stroke="var(--color-kitchen)"
              stackId="a"
            />

            <ChartLegend content={<ChartLegendContent />} />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

function AnalyticsBarChart({
  title,
  description,
  data,
  dataKey,
  xKey,
}: {
  title: string;
  description: string;
  data: typeof energyData;
  dataKey: string;
  xKey: string;
}) {
  return (
    <Card className="overflow-hidden border-white/10 bg-card/80 shadow-xl shadow-black/20 backdrop-blur">
      <CardHeader>
        <CardTitle className="text-white">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>

      <CardContent>
        <ChartContainer config={chartConfig} className="h-[260px] w-full">
          <BarChart
            accessibilityLayer
            data={data}
            layout="vertical"
            margin={{
              left: -12,
              right: 16,
            }}
          >
            <XAxis type="number" dataKey={dataKey} hide />

            <YAxis
              dataKey={xKey}
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

            <Bar dataKey={dataKey} fill="var(--color-usage)" radius={6} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

function AutomationRunsChart() {
  return (
    <Card className="overflow-hidden border-white/10 bg-card/80 shadow-xl shadow-black/20 backdrop-blur">
      <CardHeader>
        <CardTitle className="text-white">Automation Runs</CardTitle>
        <CardDescription>
          How often smart rules executed during the day.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <ChartContainer config={chartConfig} className="h-[260px] w-full">
          <BarChart accessibilityLayer data={automationData}>
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

            <Bar dataKey="runs" fill="var(--color-runs)" radius={8} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

function InsightsPanel() {
  return (
    <Card className="border-white/10 bg-card/80 shadow-xl shadow-black/20 backdrop-blur">
      <CardHeader>
        <div className="flex items-center gap-2">
          <BarChart3 className="size-5 text-blue-400" />
          <CardTitle className="text-white">Smart Insights</CardTitle>
        </div>
        <CardDescription>
          Automated observations from your home activity.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {insights.map((item) => {
          const Icon = item.icon;

          return (
            <div
              key={item.title}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
            >
              <div className="flex gap-3">
                <div
                  className={cn(
                    "flex size-10 shrink-0 items-center justify-center rounded-xl border",
                    item.tone === "amber" &&
                      "border-amber-500/20 bg-amber-500/10 text-amber-400",
                    item.tone === "blue" &&
                      "border-blue-500/20 bg-blue-500/10 text-blue-400",
                    item.tone === "green" &&
                      "border-green-500/20 bg-green-500/10 text-green-400",
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

        <div className="rounded-2xl border border-green-500/20 bg-green-500/10 p-4">
          <div className="flex items-center gap-2 text-green-400">
            <TrendingDown className="size-4" />
            <span className="text-sm font-semibold">Efficiency improved</span>
          </div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Energy rules helped reduce idle power usage compared to yesterday.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
