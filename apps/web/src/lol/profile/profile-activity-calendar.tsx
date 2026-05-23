import { useAccountFromSlug } from "@/lol/_shared/account/use-account-from-slug";
import { useCachedMatchesWindow } from "@/lol/matches/use-matches";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import type { MatchSummary } from "@vyoh/shared";
import { cloneElement } from "react";
import type { ReactElement, SVGProps } from "react";
import CalendarHeatmap from "react-calendar-heatmap";

type Value = CalendarHeatmap.ReactCalendarHeatmapValue<string>;

const COLOR_EMPTY = "fill-muted/30";
const COLOR_LEVEL_1 = "fill-emerald-500/40";
const COLOR_LEVEL_2 = "fill-emerald-500/60";
const COLOR_LEVEL_3 = "fill-emerald-500/80";
const COLOR_LEVEL_4 = "fill-emerald-500";

// 365-day cadence at up to ~5 games/day covers all but the most extreme grind
// rates. The cached endpoint is DB-only (no Riot calls) so the upper bound is
// just transport cost — light players get whatever they actually have.
const ACTIVITY_FETCH_COUNT = 2000;

function buildValues(matches: MatchSummary[]): Value[] {
  const counts = new Map<string, number>();
  for (const m of matches) {
    const day = m.playedAt.slice(0, 10);
    counts.set(day, (counts.get(day) ?? 0) + 1);
  }
  return [...counts.entries()].map(([date, count]) => ({ date, count }));
}

function classForValue(value: Value | undefined): string {
  const count = typeof value?.count === "number" ? value.count : 0;
  if (count === 0) return COLOR_EMPTY;
  if (count === 1) return COLOR_LEVEL_1;
  if (count === 2) return COLOR_LEVEL_2;
  if (count <= 4) return COLOR_LEVEL_3;
  return COLOR_LEVEL_4;
}

function labelForValue(value: Value | undefined): string {
  const count = typeof value?.count === "number" ? value.count : 0;
  if (count === 0) return "";
  return count === 1 ? `1 game on ${value?.date}` : `${count} games on ${value?.date}`;
}

const DAYS_WINDOW = 365;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function ProfileActivityCalendar({ accountSlug }: { accountSlug: string }) {
  // Self-fetches a wide window so the heatmap doesn't get truncated by the
  // user's match-list count selector (which only the matches page cares
  // about). No queue filter — activity is identity/cadence, not performance.
  const account = useAccountFromSlug(accountSlug);
  const { data } = useCachedMatchesWindow(account, ACTIVITY_FETCH_COUNT);
  const matches = data?.matches ?? [];
  if (matches.length === 0) return null;

  const values = buildValues(matches);
  const endDate = new Date();
  const startDate = new Date(endDate.getTime() - DAYS_WINDOW * MS_PER_DAY);

  // Newest-first ordering means matches[length - 1] is oldest. Riot's Match-V5
  // API caps history at ~1000 matches per puuid, which for a heavy grinder
  // can be only ~3 months of data. We still render the full 365-day frame so
  // the cell size stays consistent across players; the caption surfaces how
  // far back the actual data goes.
  const oldestMatch = matches[matches.length - 1];
  const oldestDate = oldestMatch ? new Date(oldestMatch.playedAt) : startDate;
  const isCapped = oldestDate.getTime() > startDate.getTime();
  const daysShown = Math.max(
    1,
    Math.round((endDate.getTime() - oldestDate.getTime()) / MS_PER_DAY)
  );

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-medium text-muted-foreground">Activity</h3>
        {isCapped && (
          <TooltipPrimitive.Root delayDuration={150}>
            <TooltipPrimitive.Trigger asChild>
              <span className="cursor-help text-xs text-muted-foreground/70">
                {daysShown} days · from{" "}
                {oldestDate.toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })}
              </span>
            </TooltipPrimitive.Trigger>
            <TooltipPrimitive.Portal>
              <TooltipPrimitive.Content
                side="top"
                sideOffset={6}
                collisionPadding={8}
                className="pointer-events-none z-50 max-w-64 rounded-md border bg-popover/85 px-3 py-2 text-xs text-popover-foreground shadow-xl backdrop-blur-md"
              >
                Riot's match history endpoint caps how many matches it returns per player.
                For high-volume players this surfaces as a shorter window here.
              </TooltipPrimitive.Content>
            </TooltipPrimitive.Portal>
          </TooltipPrimitive.Root>
        )}
      </div>
      <CalendarHeatmap
        startDate={startDate}
        endDate={endDate}
        values={values}
        classForValue={classForValue}
        showMonthLabels
        showWeekdayLabels
        transformDayElement={(element, value, index) => {
          const el = element as ReactElement<SVGProps<SVGRectElement>>;
          const col = Math.floor(index / 7);
          const row = index % 7;
          const rect = cloneElement(el, {
            className: `${el.props.className ?? ""} heatmap-cell`.trim(),
            style: { animationDelay: `${(col + row) * 10}ms` },
          });
          const label = labelForValue(value as Value | undefined);
          if (!label) return rect;
          return (
            <TooltipPrimitive.Root key={index} delayDuration={150}>
              <TooltipPrimitive.Trigger asChild>{rect}</TooltipPrimitive.Trigger>
              <TooltipPrimitive.Portal>
                <TooltipPrimitive.Content
                  side="top"
                  sideOffset={6}
                  className="pointer-events-none z-50 rounded-md border bg-popover/85 px-2 py-1 text-xs text-popover-foreground shadow-xl backdrop-blur-md"
                >
                  {label}
                </TooltipPrimitive.Content>
              </TooltipPrimitive.Portal>
            </TooltipPrimitive.Root>
          );
        }}
      />
    </section>
  );
}
