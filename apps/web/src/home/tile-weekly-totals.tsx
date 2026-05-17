import { useHomeWeeklyTotals } from "@/home/use-home-weekly-totals";
import { formatHoursMinutes } from "@vyoh/shared";

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full flex-col gap-3 rounded-lg border bg-card/50 px-4 py-4">
      {children}
    </div>
  );
}

function Heading() {
  return (
    <h3 className="text-xs uppercase tracking-wide text-muted-foreground">This week</h3>
  );
}

function Empty({ verdict }: { verdict: string }) {
  return (
    <Shell>
      <Heading />
      <p className="text-base font-semibold leading-snug text-muted-foreground/70">
        {verdict}
      </p>
    </Shell>
  );
}

export function TileWeeklyTotals() {
  const query = useHomeWeeklyTotals();
  if (query.isPending) return <Empty verdict="Loading weekly totals…" />;
  if (!query.data) return <Empty verdict="No weekly totals available." />;

  const { lolMatchCount, lolMinutes, steamMinutes, totalMinutes, weekEnd } = query.data;
  if (totalMinutes === 0 && lolMatchCount === 0) {
    return <Empty verdict="A quiet seven days." />;
  }

  const endLabel = new Date(weekEnd).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
  });

  return (
    <Shell>
      <Heading />
      <p className="text-base font-semibold leading-snug text-foreground/90">
        {formatHoursMinutes(totalMinutes)} gaming
      </p>
      <dl className="flex flex-col gap-1 text-sm">
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-muted-foreground">LoL</dt>
          <dd className="tabular-nums text-foreground/85">
            {lolMatchCount} {lolMatchCount === 1 ? "match" : "matches"} ·{" "}
            {formatHoursMinutes(lolMinutes)}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-muted-foreground">Steam</dt>
          <dd className="tabular-nums text-foreground/85">
            {steamMinutes > 0 ? formatHoursMinutes(steamMinutes) : "—"}
          </dd>
        </div>
      </dl>
      <p className="mt-auto border-t border-border/40 pt-2.5 text-xs text-muted-foreground">
        Last 7 days · ending {endLabel}
      </p>
    </Shell>
  );
}
