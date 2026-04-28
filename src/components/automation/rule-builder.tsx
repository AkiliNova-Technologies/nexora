"use client";

import * as React from "react";
import {
  BellRing,
  Bot,
  CheckCircle2,
  ChevronRight,
  Clock3,
  DoorOpen,
  Lightbulb,
  Lock,
  Plus,
  Save,
  Thermometer,
  Trash2,
  Zap,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type TriggerType = "motion" | "temperature" | "door" | "time";
type ConditionType = "after_sunset" | "room_occupied" | "security_armed" | "energy_saving";
type ActionType = "turn_lights_on" | "cool_room" | "send_alert" | "turn_plugs_off";

const triggers = [
  {
    value: "motion",
    label: "Motion detected",
    icon: Zap,
  },
  {
    value: "temperature",
    label: "Temperature changes",
    icon: Thermometer,
  },
  {
    value: "door",
    label: "Door opened",
    icon: DoorOpen,
  },
  {
    value: "time",
    label: "Time reached",
    icon: Clock3,
  },
] satisfies { value: TriggerType; label: string; icon: React.ElementType }[];

const conditions = [
  {
    value: "after_sunset",
    label: "After sunset",
  },
  {
    value: "room_occupied",
    label: "Room is occupied",
  },
  {
    value: "security_armed",
    label: "Security mode is armed",
  },
  {
    value: "energy_saving",
    label: "Energy saving mode is active",
  },
] satisfies { value: ConditionType; label: string }[];

const actions = [
  {
    value: "turn_lights_on",
    label: "Turn lights on",
    icon: Lightbulb,
  },
  {
    value: "cool_room",
    label: "Activate cooling",
    icon: Thermometer,
  },
  {
    value: "send_alert",
    label: "Send security alert",
    icon: BellRing,
  },
  {
    value: "turn_plugs_off",
    label: "Turn smart plugs off",
    icon: Zap,
  },
] satisfies { value: ActionType; label: string; icon: React.ElementType }[];

export function RuleBuilder() {
  const [enabled, setEnabled] = React.useState(true);
  const [trigger, setTrigger] = React.useState<TriggerType>("motion");
  const [condition, setCondition] =
    React.useState<ConditionType>("after_sunset");
  const [action, setAction] = React.useState<ActionType>("turn_lights_on");

  const selectedTrigger = triggers.find((item) => item.value === trigger)!;
  const selectedCondition = conditions.find((item) => item.value === condition)!;
  const selectedAction = actions.find((item) => item.value === action)!;

  const TriggerIcon = selectedTrigger.icon;
  const ActionIcon = selectedAction.icon;

  return (
    <section className="rounded-[2rem] border border-blue-500/20 bg-card/80 p-5 shadow-2xl shadow-black/30 backdrop-blur md:p-6">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-3">
          <div className="flex size-11 items-center justify-center rounded-2xl border border-blue-500/20 bg-blue-500/10 text-blue-400">
            <Bot className="size-5" />
          </div>

          <div>
            <h2 className="text-lg font-semibold text-white">
              Rule Builder
            </h2>
            <p className="text-sm text-muted-foreground">
              Build automation logic using trigger, condition, and action.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Badge
            variant="outline"
            className={cn(
              "rounded-full",
              enabled
                ? "border-green-500/20 bg-green-500/10 text-green-400"
                : "border-white/10 bg-white/[0.04] text-muted-foreground"
            )}
          >
            <span className="mr-1.5 size-1.5 rounded-full bg-current" />
            {enabled ? "Enabled" : "Disabled"}
          </Badge>

          <Switch checked={enabled} onCheckedChange={setEnabled} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3 lg:items-stretch">
        <BuilderStep
          label="When"
          title="Trigger"
          icon={<TriggerIcon className="size-5" />}
          tone="blue"
        >
          <Select
            value={trigger}
            onValueChange={(value) => setTrigger(value as TriggerType)}
          >
            <SelectTrigger className="h-11 rounded-2xl border-white/10 bg-white/[0.04] text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-md p-2 border-white/10 bg-[#111827] text-white">
              {triggers.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <p className="mt-3 text-xs leading-5 text-muted-foreground">
            Starts the automation when a real-time event is detected.
          </p>
        </BuilderStep>

        <FlowArrow />

        <BuilderStep
          label="If"
          title="Condition"
          icon={<Lock className="size-5" />}
          tone="amber"
        >
          <Select
            value={condition}
            onValueChange={(value) => setCondition(value as ConditionType)}
          >
            <SelectTrigger className="h-11 rounded-2xl border-white/10 bg-white/[0.04] text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-md p-2 border-white/10 bg-[#111827] text-white">
              {conditions.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <p className="mt-3 text-xs leading-5 text-muted-foreground">
            Limits the rule so it only runs when the condition is true.
          </p>
        </BuilderStep>

        <FlowArrow />

        <BuilderStep
          label="Then"
          title="Action"
          icon={<ActionIcon className="size-5" />}
          tone="green"
        >
          <Select
            value={action}
            onValueChange={(value) => setAction(value as ActionType)}
          >
            <SelectTrigger className="h-11 rounded-2xl border-white/10 bg-white/[0.04] text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-md p-2 border-white/10 bg-[#111827] text-white">
              {actions.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <p className="mt-3 text-xs leading-5 text-muted-foreground">
            Executes the selected smart home action automatically.
          </p>
        </BuilderStep>
      </div>

      <div className="mt-6 rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <div className="mb-4 flex items-center gap-2 text-sm font-medium text-white">
          <CheckCircle2 className="size-4 text-green-400" />
          Rule Summary
        </div>

        <div className="flex flex-col gap-3 text-sm text-muted-foreground lg:flex-row lg:items-center">
          <SummaryPill label="When" value={selectedTrigger.label} />
          <ChevronRight className="hidden size-4 text-muted-foreground lg:block" />
          <SummaryPill label="If" value={selectedCondition.label} />
          <ChevronRight className="hidden size-4 text-muted-foreground lg:block" />
          <SummaryPill label="Then" value={selectedAction.label} />
        </div>
      </div>

      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        <Button
          variant="outline"
          className="rounded-2xl border-red-500/20 bg-red-500/10 text-red-400 hover:bg-red-500/15 hover:text-red-300"
        >
          <Trash2 className="size-4" />
          Clear Rule
        </Button>

        <div className="flex gap-3">
          <Button
            variant="outline"
            className="rounded-2xl border-white/10 bg-white/[0.04] text-white hover:bg-white/10"
          >
            <Plus className="size-4" />
            Add Condition
          </Button>

          <Button className="rounded-2xl bg-blue-500 text-white shadow-lg shadow-blue-500/20 hover:bg-blue-400">
            <Save className="size-4" />
            Save Automation
          </Button>
        </div>
      </div>
    </section>
  );
}

function BuilderStep({
  label,
  title,
  icon,
  tone,
  children,
}: {
  label: string;
  title: string;
  icon: React.ReactNode;
  tone: "blue" | "amber" | "green";
  children: React.ReactNode;
}) {
  const tones = {
    blue: "border-blue-500/20 bg-blue-500/10 text-blue-400",
    amber: "border-amber-500/20 bg-amber-500/10 text-amber-400",
    green: "border-green-500/20 bg-green-500/10 text-green-400",
  };

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.035] p-4">
      <div className="mb-4 flex items-center gap-3">
        <div
          className={cn(
            "flex size-10 items-center justify-center rounded-2xl border",
            tones[tone]
          )}
        >
          {icon}
        </div>

        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">
            {label}
          </p>
          <h3 className="text-sm font-semibold text-white">{title}</h3>
        </div>
      </div>

      {children}
    </div>
  );
}

// function FlowArrow() {
//   return (
//     <div className="hidden items-center justify-center xl:flex">
//       <div className="flex size-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-muted-foreground">
//         <ChevronRight className="size-5" />
//       </div>
//     </div>
//   );
// }

function FlowArrow() {
  return null;
}

function SummaryPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#0B0F14]/70 px-4 py-3">
      <span className="mr-2 text-[10px] font-bold uppercase tracking-[0.18em] text-blue-400">
        {label}
      </span>
      <span className="font-medium text-white">{value}</span>
    </div>
  );
}