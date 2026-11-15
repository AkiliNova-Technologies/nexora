import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function DashboardEmptyState({ icon: Icon, title, description, action, compact = false, className }: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
  compact?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center rounded-3xl border border-dashed border-white/10 bg-card/60 px-5 text-center", compact ? "min-h-44 py-7" : "min-h-72 py-10", className)}>
      <div className="flex size-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-muted-foreground"><Icon className="size-5" /></div>
      <h2 className="mt-4 text-base font-semibold text-white">{title}</h2>
      <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
