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

function titleForValue(value: Value | undefined): string {
  const count = typeof value?.count === "number" ? value.count : 0;
  if (count === 0) return "";
  return count === 1 ? `1 game on ${value?.date}` : `${count} games on ${value?.date}`;
}

const DAYS_WINDOW = 365;

export function ProfileActivityCalendar({ matches }: { matches: MatchSummary[] }) {
  if (matches.length === 0) return null;

  const values = buildValues(matches);
  const endDate = new Date();
  const startDate = new Date(endDate);
  startDate.setDate(endDate.getDate() - DAYS_WINDOW);

  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-sm font-medium text-muted-foreground">Activity</h3>
      <CalendarHeatmap
        startDate={startDate}
        endDate={endDate}
        values={values}
        classForValue={classForValue}
        titleForValue={titleForValue}
        showMonthLabels
        showWeekdayLabels
        transformDayElement={(element, _value, index) => {
          const el = element as ReactElement<SVGProps<SVGRectElement>>;
          const col = Math.floor(index / 7);
          const row = index % 7;
          return cloneElement(el, {
            className: `${el.props.className ?? ""} heatmap-cell`.trim(),
            style: { animationDelay: `${(col + row) * 10}ms` },
          });
        }}
      />
    </section>
  );
}
