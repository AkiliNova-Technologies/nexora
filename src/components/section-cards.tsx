"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Activity,
  AlertTriangle,
  Cpu,
  Lightbulb,
  LucideIcon,
  PlugZap,
  TrendingDownIcon,
  TrendingUpIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

type MetricTone = "blue" | "green" | "amber" | "red" | "purple" | "neutral";
type MetricTrend = "up" | "down" | "neutral";

export type MetricCardItem = {
  title: string;
  value: string | number;
  badge?: string;
  trend?: MetricTrend;
  icon: LucideIcon;
  footerTitle?: string;
  footerText?: string;
  tone?: MetricTone;
};

const defaultMetrics: MetricCardItem[] = [
  {
    title: "Total Devices",
    value: "42",
    badge: "+6 online",
    trend: "up",
    icon: Cpu,
    footerTitle: "All smart zones connected",
    footerText: "Lights, sensors, plugs, thermostats, and security devices",
    tone: "blue",
  },
  {
    title: "Active Devices",
    value: "31",
    badge: "74%",
    trend: "up",
    icon: Activity,
    footerTitle: "Healthy activity level",
    footerText: "Most devices are responding in real time",
    tone: "green",
  },
  {
    title: "Energy Usage",
    value: "18.4 kWh",
    badge: "-12%",
    trend: "down",
    icon: PlugZap,
    footerTitle: "Energy usage reduced",
    footerText: "Automation lowered consumption this week",
    tone: "amber",
  },
  {
    title: "Alerts",
    value: "3",
    badge: "Needs review",
    trend: "neutral",
    icon: AlertTriangle,
    footerTitle: "Security checks pending",
    footerText: "Motion, door, and temperature alerts detected",
    tone: "red",
  },
];

const toneClasses: Record<MetricTone, string> = {
  blue: "border-blue-500/20 bg-blue-500/10 text-blue-400",
  green: "border-green-500/20 bg-green-500/10 text-green-400",
  amber: "border-amber-500/20 bg-amber-500/10 text-amber-400",
  red: "border-red-500/20 bg-red-500/10 text-red-400",
  purple: "border-purple-500/20 bg-purple-500/10 text-purple-400",
  neutral: "border-white/10 bg-white/[0.04] text-muted-foreground",
};

type SectionCardsProps = {
  items?: MetricCardItem[];
  className?: string;
};

export function SectionCards({ items = defaultMetrics, className }: SectionCardsProps) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4",
        className
      )}
    >
      {items.map((item) => (
        <MetricCard key={item.title} item={item} />
      ))}
    </div>
  );
}

function MetricCard({ item }: { item: MetricCardItem }) {
  const Icon = item.icon;
  const TrendIcon =
    item.trend === "down"
      ? TrendingDownIcon
      : item.trend === "up"
        ? TrendingUpIcon
        : null;

  return (
    <Card className="group overflow-hidden border-white/10 bg-card/80 shadow-xl shadow-black/20 backdrop-blur transition hover:-translate-y-0.5 hover:border-white/20 hover:bg-card">
      <CardContent className="px-5">
        <div className="flex items-start justify-between gap-4">
          <div
            className={cn(
              "flex size-11 shrink-0 items-center justify-center rounded-2xl border",
              toneClasses[item.tone ?? "neutral"]
            )}
          >
            <Icon className="size-5" />
          </div>

          {item.badge && (
            <Badge
              variant="outline"
              className="max-w-[140px] gap-1 truncate rounded-full border-white/10 bg-white/[0.03] text-xs text-muted-foreground"
            >
              {TrendIcon && <TrendIcon className="size-3.5 shrink-0" />}
              <span className="truncate">{item.badge}</span>
            </Badge>
          )}
        </div>

        <div className="mt-5 space-y-1">
          <p className="text-sm text-muted-foreground">{item.title}</p>
          <h3 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            {item.value}
          </h3>
        </div>

        {(item.footerTitle || item.footerText) && (
          <div className="mt-5 pt-4">
            {item.footerTitle && (
              <div className="flex items-center gap-2 text-sm font-medium text-white">
                <span className="line-clamp-1">{item.footerTitle}</span>
                <Lightbulb className="size-4 shrink-0 text-blue-400" />
              </div>
            )}

            {item.footerText && (
              <p className="mt-1 line-clamp-2 text-sm leading-5 text-muted-foreground">
                {item.footerText}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}