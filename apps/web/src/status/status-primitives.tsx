import { CardTitle } from "@/components/ui/card-title";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

// Every operational zone on the status page is one of these: chromed card,
// in-card title with optional badges, and either a description or a control
// on the right. The children are one of two shapes — pill rows for lists that
// mix prose and state (jobs, accounts, ticks), or a bare divider table for
// genuinely tabular data (roster, curation, method limiters). The card carries
// the chrome, so neither shape brings a border of its own.
export function StatusCard({
  title,
  badges,
  description,
  action,
  children,
}: {
  title: string;
  badges?: ReactNode;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3 rounded-md border p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <CardTitle as="h2">{title}</CardTitle>
          {badges && <div className="flex items-center gap-2 text-xs">{badges}</div>}
        </div>
        {action ||
          (description && (
            <p className="max-w-sm text-right text-xs text-muted-foreground">
              {description}
            </p>
          ))}
      </div>
      {children}
    </section>
  );
}

// One row of a list inside a StatusCard.
export const STATUS_ROW_CLASS =
  "flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-md bg-muted/30 px-3 py-1.5 text-xs";

// Header row of a bare divider table inside a StatusCard.
export const STATUS_TABLE_HEAD_CLASS =
  "text-xs uppercase tracking-wide text-muted-foreground";

export function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="font-mono">{value}</span>
    </div>
  );
}

export function Badge({
  tone,
  children,
}: { tone: "ok" | "active" | "muted" | "bad" | "warn"; children: React.ReactNode }) {
  const styles =
    tone === "ok"
      ? "bg-emerald-500/15 text-emerald-500"
      : tone === "active"
        ? "bg-sky-500/15 text-sky-500 animate-pulse"
        : tone === "bad"
          ? "bg-destructive/15 text-destructive"
          : tone === "warn"
            ? "bg-amber-400/15 text-amber-300"
            : "bg-muted text-muted-foreground";
  return (
    <span className={cn("rounded-full px-2 py-0.5 font-medium", styles)}>{children}</span>
  );
}
