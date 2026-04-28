"use client";

import * as React from "react";
import {
  BellRing,
  Bot,
  Clock3,
  Flame,
  Lightbulb,
  Lock,
  Plus,
  Power,
  ShieldCheck,
  Snowflake,
  Sparkles,
  Zap,
} from "lucide-react";

import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SectionCards, type MetricCardItem } from "@/components/section-cards";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { RuleBuilder } from "@/components/automation/rule-builder";

type AutomationCategory = "lighting" | "climate" | "security" | "energy";
type AutomationPriority = "normal" | "high" | "critical";

type AutomationRule = {
  id: string;
  name: string;
  description: string;
  category: AutomationCategory;
  priority: AutomationPriority;
  enabled: boolean;
  trigger: string;
  condition: string;
  action: string;
  lastTriggered: string;
  runsToday: number;
};

const automationRules: AutomationRule[] = [
  {
    id: "AUTO-001",
    name: "Motion Night Lights",
    description:
      "Turns hallway lights on when motion is detected after sunset.",
    category: "lighting",
    priority: "normal",
    enabled: true,
    trigger: "Motion detected",
    condition: "After 7:00 PM",
    action: "Turn on hallway lights",
    lastTriggered: "12 min ago",
    runsToday: 5,
  },
  {
    id: "AUTO-002",
    name: "Smart Cooling",
    description:
      "Activates cooling when indoor temperature rises above comfort level.",
    category: "climate",
    priority: "high",
    enabled: true,
    trigger: "Temperature > 30°C",
    condition: "Room occupied",
    action: "Set AC to 23°C",
    lastTriggered: "34 min ago",
    runsToday: 3,
  },
  {
    id: "AUTO-003",
    name: "Door Security Alert",
    description: "Sends alert when the front door opens during security hours.",
    category: "security",
    priority: "critical",
    enabled: true,
    trigger: "Front door opened",
    condition: "Security mode armed",
    action: "Send instant alert",
    lastTriggered: "2 hrs ago",
    runsToday: 1,
  },
  {
    id: "AUTO-004",
    name: "Idle Power Saver",
    description:
      "Switches off unused plugs when devices stay idle for too long.",
    category: "energy",
    priority: "high",
    enabled: false,
    trigger: "No activity for 30 min",
    condition: "Power draw < 10W",
    action: "Turn off smart plugs",
    lastTriggered: "Yesterday",
    runsToday: 0,
  },
];

const automationMetrics: MetricCardItem[] = [
  {
    title: "Active Rules",
    value: "18",
    badge: "+4 optimized",
    trend: "up",
    icon: Bot,
    tone: "blue",
    footerTitle: "Automation engine online",
    footerText: "Rules are monitoring rooms, devices, and events.",
  },
  {
    title: "Runs Today",
    value: "43",
    badge: "+12%",
    trend: "up",
    icon: Zap,
    tone: "green",
    footerTitle: "Smart actions executed",
    footerText: "Automations are responding to real-time conditions.",
  },
  {
    title: "Energy Saved",
    value: "12%",
    badge: "Improved",
    trend: "down",
    icon: Power,
    tone: "amber",
    footerTitle: "Usage reduction detected",
    footerText: "Energy rules reduced unnecessary device activity.",
  },
  {
    title: "Security Rules",
    value: "5",
    badge: "Armed",
    trend: "up",
    icon: ShieldCheck,
    tone: "red",
    footerTitle: "Protection logic active",
    footerText: "Critical alerts are ready for door and motion events.",
  },
];

const categoryIconMap = {
  lighting: Lightbulb,
  climate: Snowflake,
  security: Lock,
  energy: Flame,
};

const categoryStyles = {
  lighting: "border-blue-500/20 bg-blue-500/10 text-blue-400",
  climate: "border-cyan-500/20 bg-cyan-500/10 text-cyan-400",
  security: "border-red-500/20 bg-red-500/10 text-red-400",
  energy: "border-amber-500/20 bg-amber-500/10 text-amber-400",
};

const priorityStyles = {
  normal: "border-white/10 bg-white/[0.04] text-muted-foreground",
  high: "border-amber-500/20 bg-amber-500/10 text-amber-400",
  critical: "border-red-500/20 bg-red-500/10 text-red-400",
};

export default function AutomationPage() {
  const [selectedCategory, setSelectedCategory] = React.useState<
    AutomationCategory | "all"
  >("all");

  const filteredRules =
    selectedCategory === "all"
      ? automationRules
      : automationRules.filter((rule) => rule.category === selectedCategory);

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
            <section className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-muted-foreground">
                  Intelligent smart home logic
                </p>
                <h1 className="mt-1 text-3xl font-semibold tracking-tight text-white">
                  Automation
                </h1>
              </div>

              <Button className="w-fit rounded-2xl bg-blue-500 px-5 text-white shadow-lg shadow-blue-500/20 hover:bg-blue-400">
                <Plus className="size-4" />
                Add Automation
              </Button>
            </section>

            <SectionCards items={automationMetrics} />

            <section className="grid gap-6">
              <RuleBuilder />

              <div className="grid gap-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-white">
                      Automation Rules
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      Manage active smart rules across lighting, climate,
                      security, and energy.
                    </p>
                  </div>

                  <CategoryFilter
                    selectedCategory={selectedCategory}
                    setSelectedCategory={setSelectedCategory}
                  />
                </div>

                <div className="grid gap-4">
                  {filteredRules.map((rule) => (
                    <AutomationRuleCard key={rule.id} rule={rule} />
                  ))}
                </div>
              </div>
            </section>
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}

function CategoryFilter({
  selectedCategory,
  setSelectedCategory,
}: {
  selectedCategory: AutomationCategory | "all";
  setSelectedCategory: React.Dispatch<
    React.SetStateAction<AutomationCategory | "all">
  >;
}) {
  const categories: (AutomationCategory | "all")[] = [
    "all",
    "lighting",
    "climate",
    "security",
    "energy",
  ];

  return (
    <div className="w-full rounded-3xl border border-white/10 bg-card/80 p-3 shadow-xl shadow-black/20 backdrop-blur sm:w-fit">
      <div className="flex flex-wrap gap-2">
        {categories.map((category) => (
          <Button
            key={category}
            variant="outline"
            onClick={() => setSelectedCategory(category)}
            className={cn(
              "rounded-full border-white/10 bg-white/[0.04] capitalize text-white hover:bg-white/10",
              selectedCategory === category && "bg-blue-500/15 text-blue-400",
            )}
          >
            {category}
          </Button>
        ))}
      </div>
    </div>
  );
}

function AutomationRuleCard({ rule }: { rule: AutomationRule }) {
  const [enabled, setEnabled] = React.useState(rule.enabled);
  const Icon = categoryIconMap[rule.category];

  return (
    <article
      className={cn(
        "rounded-3xl border border-white/10 bg-card/80 p-5 shadow-xl shadow-black/20 backdrop-blur transition hover:-translate-y-0.5 hover:border-white/20",
        enabled && "border-blue-500/20",
      )}
    >
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex gap-4">
          <div
            className={cn(
              "flex size-12 shrink-0 items-center justify-center rounded-2xl border",
              categoryStyles[rule.category],
            )}
          >
            <Icon className="size-5" />
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-semibold text-white">{rule.name}</h2>
              <Badge
                variant="outline"
                className={cn(
                  "rounded-full capitalize",
                  priorityStyles[rule.priority],
                )}
              >
                {rule.priority}
              </Badge>
            </div>

            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              {rule.description}
            </p>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <RuleStep label="Trigger" value={rule.trigger} />
              <RuleStep label="Condition" value={rule.condition} />
              <RuleStep label="Action" value={rule.action} />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 lg:flex-col lg:items-end">
          <Switch checked={enabled} onCheckedChange={setEnabled} />

          <div className="text-right text-xs text-muted-foreground">
            <p>Last triggered</p>
            <p className="font-medium text-white">{rule.lastTriggered}</p>
          </div>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock3 className="size-4" />
          <span>{rule.runsToday} runs today</span>
        </div>

        <Badge
          variant="outline"
          className={cn(
            "rounded-full",
            enabled
              ? "border-green-500/20 bg-green-500/10 text-green-400"
              : "border-white/10 bg-white/[0.04] text-muted-foreground",
          )}
        >
          <span className="mr-1.5 size-1.5 rounded-full bg-current" />
          {enabled ? "Enabled" : "Disabled"}
        </Badge>
      </div>
    </article>
  );
}

function RuleStep({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 text-sm font-medium text-white">{value}</p>
    </div>
  );
}

