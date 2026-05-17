import { useHomeSessionLengths } from "@/home/use-home-session-lengths";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import type { HomeSessionLengthsBucket } from "@vyoh/shared";

const TOOLTIP_CONTENT_CLASS =
  "pointer-events-none z-50 w-max max-w-48 rounded-md border bg-popover/85 p-3 text-popover-foreground shadow-xl backdrop-blur-md data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0 data-[state=delayed-open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95";

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full flex-col gap-3 rounded-lg border bg-card/50 px-4 py-4">
      {children}
    </div>
  );
}

function Heading() {
  return (
    <div className="flex items-center justify-between gap-2">
      <h3 className="text-xs uppercase tracking-wide text-muted-foreground">
        Session lengths
      </h3>
      <div className="flex items-center gap-3 text-[10px] uppercase tracking-wide text-muted-foreground/70">
        <span className="flex items-center gap-1.5">
          <span className="inline-block size-2 rounded-sm bg-sky-500/80" />
          LoL
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block size-2 rounded-sm bg-amber-500/80" />
          Steam
        </span>
      </div>
    </div>
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

function plural(n: number, singular: string): string {
  return `${n} ${singular}${n === 1 ? "" : "s"}`;
}

function BucketBar({
  bucket,
  maxCount,
}: {
  bucket: HomeSessionLengthsBucket;
  maxCount: number;
}) {
  const total = bucket.lolCount + bucket.steamCount;
  const heightPct = (total / maxCount) * 100;
  const lolPct = total > 0 ? (bucket.lolCount / total) * 100 : 0;
  const steamPct = total > 0 ? (bucket.steamCount / total) * 100 : 0;
  const tooltipLines: string[] = [];
  if (bucket.lolCount > 0) tooltipLines.push(`LoL ${plural(bucket.lolCount, "session")}`);
  if (bucket.steamCount > 0) {
    tooltipLines.push(`Steam ${plural(bucket.steamCount, "session")}`);
  }
  const tooltip =
    tooltipLines.length === 0
      ? `${bucket.label} · no sessions`
      : `${bucket.label} · ${tooltipLines.join(" + ")}`;
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>
        <div className="flex flex-1 flex-col items-stretch gap-1.5">
          <div className="flex flex-1 flex-col justify-end">
            {total === 0 ? (
              <div className="rounded-sm bg-muted/30" style={{ height: "2%" }} />
            ) : (
              <div
                className="flex flex-col overflow-hidden rounded-sm"
                style={{ height: `${Math.max(4, heightPct)}%` }}
              >
                {bucket.steamCount > 0 && (
                  <div className="bg-amber-500/80" style={{ height: `${steamPct}%` }} />
                )}
                {bucket.lolCount > 0 && (
                  <div className="bg-sky-500/80" style={{ height: `${lolPct}%` }} />
                )}
              </div>
            )}
          </div>
          <span className="text-center text-[10px] tabular-nums text-muted-foreground/70">
            {bucket.label}
          </span>
        </div>
      </TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side="top"
          sideOffset={4}
          className={TOOLTIP_CONTENT_CLASS}
        >
          {tooltip}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}

export function TileSessionLengths() {
  const query = useHomeSessionLengths();
  if (query.isPending) return <Empty verdict="Loading session lengths…" />;
  if (!query.data) return <Empty verdict="No session-length data available." />;

  const { buckets, lolSessionCount, steamSessionCount } = query.data;
  const grandTotal = lolSessionCount + steamSessionCount;
  if (grandTotal === 0) {
    return <Empty verdict="Not enough closed sessions yet." />;
  }

  const maxCount = Math.max(...buckets.map((b) => b.lolCount + b.steamCount), 1);

  // Share of "short" sessions (< 1h: <30m and 30m–1h). Captures bursts vs sits
  // without picking a modal that flips noisily across small samples.
  const shortCount = buckets
    .filter((b) => b.label === "<30m" || b.label === "30m–1h")
    .reduce((sum, b) => sum + b.lolCount + b.steamCount, 0);
  const shortShare = Math.round((shortCount / grandTotal) * 100);

  return (
    <Shell>
      <Heading />
      <p className="text-base font-semibold leading-snug text-foreground/90">
        {shortShare}% of sessions are under 1h.
      </p>
      <div className="mt-1 flex min-h-20 flex-1 items-stretch gap-2">
        {buckets.map((bucket) => (
          <BucketBar key={bucket.label} bucket={bucket} maxCount={maxCount} />
        ))}
      </div>
      <p className="mt-auto border-t border-border/40 pt-2.5 text-xs text-muted-foreground">
        Counts, not minutes · {plural(lolSessionCount, "LoL session")} +{" "}
        {plural(steamSessionCount, "Steam session")}
      </p>
    </Shell>
  );
}
