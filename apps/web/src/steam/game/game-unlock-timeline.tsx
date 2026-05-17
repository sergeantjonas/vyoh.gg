import { useGameUnlockTimeline } from "@/steam/game/use-game-unlock-timeline";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import type { GameUnlockTimelineMonth } from "@vyoh/shared";

const TOOLTIP_CONTENT_CLASS =
  "pointer-events-none z-50 w-max max-w-48 rounded-md border bg-popover/85 p-3 text-popover-foreground shadow-xl backdrop-blur-md data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0 data-[state=delayed-open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95";

const MONTH_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function barClass(count: number, maxCount: number): string {
  if (count === 0) return "bg-muted/30";
  const density = Math.sqrt(count / maxCount);
  if (density < 0.25) return "bg-sky-500/30";
  if (density < 0.5) return "bg-sky-500/55";
  if (density < 0.75) return "bg-sky-500/75";
  return "bg-sky-500/90";
}

function monthLabel(year: number, month: number): string {
  return `${MONTH_SHORT[month - 1] ?? "?"} ${year}`;
}

function MonthBar({
  bucket,
  maxCount,
}: {
  bucket: GameUnlockTimelineMonth;
  maxCount: number;
}) {
  const heightPct =
    bucket.count === 0 ? 0 : Math.max(2, Math.sqrt(bucket.count / maxCount) * 100);
  const label = `${monthLabel(bucket.year, bucket.month)} · ${bucket.count} ${bucket.count === 1 ? "unlock" : "unlocks"}`;
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>
        <div className="flex min-w-2 flex-1 flex-col items-stretch justify-end">
          <div
            className={`${barClass(bucket.count, maxCount)} rounded-sm`}
            style={{ height: `${Math.max(2, heightPct)}%` }}
          />
        </div>
      </TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side="top"
          sideOffset={4}
          className={TOOLTIP_CONTENT_CLASS}
        >
          {label}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}

const MIN_BARS = 12;

function padMonths(months: GameUnlockTimelineMonth[]): GameUnlockTimelineMonth[] {
  if (months.length >= MIN_BARS) return months;
  const first = months[0];
  if (!first) return months;
  const prefix: GameUnlockTimelineMonth[] = [];
  let y = first.year;
  let m = first.month;
  for (let i = MIN_BARS - months.length; i > 0; i--) {
    m--;
    if (m === 0) {
      m = 12;
      y--;
    }
    prefix.unshift({ year: y, month: m, count: 0 });
  }
  return [...prefix, ...months];
}

export function GameUnlockTimeline({ appid }: { appid: number }) {
  const query = useGameUnlockTimeline(appid);
  if (query.isPending || !query.data || query.data.months.length === 0) return null;

  const { months, total } = query.data;
  const displayMonths = padMonths(months);
  const maxCount = Math.max(...displayMonths.map((m) => m.count), 1);
  const displayFirst = displayMonths[0];
  const displayLast = displayMonths[displayMonths.length - 1];
  if (!displayFirst || !displayLast) return null;

  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-card/50 px-4 py-4">
      <h3 className="text-xs uppercase tracking-wide text-muted-foreground">
        Unlock Timeline
      </h3>
      <p className="text-base font-semibold leading-snug text-foreground/90">
        When achievements landed.
      </p>
      <div className="mt-1 flex min-h-20 items-stretch gap-0.5 overflow-x-auto">
        {displayMonths.map((bucket) => (
          <MonthBar
            key={`${bucket.year}-${bucket.month}`}
            bucket={bucket}
            maxCount={maxCount}
          />
        ))}
      </div>
      <div className="flex justify-between text-[10px] tabular-nums text-muted-foreground/60">
        <span>{monthLabel(displayFirst.year, displayFirst.month)}</span>
        <span>{monthLabel(displayLast.year, displayLast.month)}</span>
      </div>
      <p className="mt-auto border-t border-border/40 pt-2.5 text-xs text-muted-foreground">
        {total} {total === 1 ? "unlock" : "unlocks"} across {months.length}{" "}
        {months.length === 1 ? "month" : "months"}
      </p>
    </div>
  );
}
