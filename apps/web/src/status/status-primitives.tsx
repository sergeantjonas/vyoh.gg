import { cn } from "@/lib/utils";

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
}: { tone: "ok" | "active" | "muted" | "bad"; children: React.ReactNode }) {
  const styles =
    tone === "ok"
      ? "bg-emerald-500/15 text-emerald-500"
      : tone === "active"
        ? "bg-sky-500/15 text-sky-500 animate-pulse"
        : tone === "bad"
          ? "bg-destructive/15 text-destructive"
          : "bg-muted text-muted-foreground";
  return (
    <span className={cn("rounded-full px-2 py-0.5 font-medium", styles)}>{children}</span>
  );
}
