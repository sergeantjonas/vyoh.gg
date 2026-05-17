import { useHomeDaySplit } from "@/home/use-home-day-split";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import type { HomeDaySplitHour } from "@vyoh/shared";

const TOOLTIP_CONTENT_CLASS =
  "pointer-events-none z-50 w-max max-w-48 rounded-md border bg-popover/85 p-3 text-popover-foreground shadow-xl backdrop-blur-md data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0 data-[state=delayed-open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95";

function formatHoursMinutes(minutes: number): string {
  if (minutes <= 0) return "0m";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

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
        Evening split
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

function HourBar({
  bucket,
  maxMinutes,
}: {
  bucket: HomeDaySplitHour;
  maxMinutes: number;
}) {
  const total = bucket.lolMinutes + bucket.steamMinutes;
  const heightPct = (total / maxMinutes) * 100;
  const lolPct = total > 0 ? (bucket.lolMinutes / total) * 100 : 0;
  const steamPct = total > 0 ? (bucket.steamMinutes / total) * 100 : 0;
  const hourLabel = String(bucket.hour).padStart(2, "0");
  const tooltipLines: string[] = [];
  if (bucket.lolMinutes > 0) {
    tooltipLines.push(`LoL ${formatHoursMinutes(bucket.lolMinutes)}`);
  }
  if (bucket.steamMinutes > 0) {
    tooltipLines.push(`Steam ${formatHoursMinutes(bucket.steamMinutes)}`);
  }
  const tooltip =
    tooltipLines.length === 0
      ? `${hourLabel}:00 · no play`
      : `${hourLabel}:00 · ${tooltipLines.join(" + ")}`;
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>
        <div className="flex flex-1 flex-col items-stretch justify-end">
          {total === 0 ? (
            <div className="rounded-sm bg-muted/30" style={{ height: "2%" }} />
          ) : (
            <div
              className="flex flex-col overflow-hidden rounded-sm"
              style={{ height: `${Math.max(2, heightPct)}%` }}
            >
              {bucket.steamMinutes > 0 && (
                <div className="bg-amber-500/80" style={{ height: `${steamPct}%` }} />
              )}
              {bucket.lolMinutes > 0 && (
                <div className="bg-sky-500/80" style={{ height: `${lolPct}%` }} />
              )}
            </div>
          )}
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

export function TileDaySplit() {
  const query = useHomeDaySplit();
  if (query.isPending) return <Empty verdict="Loading evening split…" />;
  if (!query.data) return <Empty verdict="No evening split available." />;

  const { hours, totalLolMinutes, totalSteamMinutes, timeZone } = query.data;
  const grandTotal = totalLolMinutes + totalSteamMinutes;
  if (grandTotal === 0) {
    return <Empty verdict="Not enough closed sessions yet." />;
  }

  const maxMinutes = Math.max(...hours.map((h) => h.lolMinutes + h.steamMinutes), 1);
  const tzLabel = timeZone.split("/").pop() ?? timeZone;
  const lolShare = Math.round((totalLolMinutes / grandTotal) * 100);
  const steamShare = 100 - lolShare;

  return (
    <Shell>
      <Heading />
      <p className="text-base font-semibold leading-snug text-foreground/90">
        {lolShare}% LoL, {steamShare}% Steam across the day.
      </p>
      <div className="mt-1 flex min-h-20 flex-1 items-stretch gap-0.5">
        {hours.map((bucket) => (
          <HourBar key={bucket.hour} bucket={bucket} maxMinutes={maxMinutes} />
        ))}
      </div>
      <div className="flex justify-between text-[10px] tabular-nums text-muted-foreground/60">
        <span>00</span>
        <span>06</span>
        <span>12</span>
        <span>18</span>
        <span>23</span>
      </div>
      <p className="mt-auto border-t border-border/40 pt-2.5 text-xs text-muted-foreground">
        Hours in {tzLabel} · {formatHoursMinutes(totalLolMinutes)} LoL +{" "}
        {formatHoursMinutes(totalSteamMinutes)} Steam
      </p>
    </Shell>
  );
}
