import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import {
  type CivilDate,
  type DayRelease,
  brusselsCivilDate,
  pickCalendarAnchor,
} from "./bucketing";
import { WishlistCapsule, dayCountdownLabel } from "./wishlist-capsule";

// Invisible-grid calendar (§ Art direction): empty cells are a faint numeral on
// the page background — no borders, no boxes. Occupied days are art-forward
// capsule tiles; the figure is the release, the grid is ground. The frosted
// wrapper carries the only chrome (its children are bare cells → one glass
// crossing). Bounded to ~2 months of day-cells, so no virtualisation.

const MONTHS_VISIBLE = 2;
// European week start (owner is in Brussels): Monday-first columns.
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function dayKey(d: CivilDate): string {
  return `${d.year}-${d.month}-${d.day}`;
}

function addMonths(anchor: CivilDate, delta: number): CivilDate {
  const ordinal = anchor.year * 12 + anchor.month + delta;
  return { year: Math.floor(ordinal / 12), month: ((ordinal % 12) + 12) % 12, day: 1 };
}

interface WishlistCalendarProps {
  dayReleases: DayRelease[];
  now: Date;
}

export function WishlistCalendar({ dayReleases, now }: WishlistCalendarProps) {
  const today = useMemo(() => brusselsCivilDate(now), [now]);
  const initialAnchor = useMemo(
    () => pickCalendarAnchor(dayReleases, today),
    [dayReleases, today]
  );
  const [offset, setOffset] = useState(0);

  const byDay = useMemo(() => {
    const map = new Map<string, DayRelease[]>();
    for (const release of dayReleases) {
      const key = dayKey(release.date);
      const bucket = map.get(key);
      if (bucket) bucket.push(release);
      else map.set(key, [release]);
    }
    return map;
  }, [dayReleases]);

  const months = Array.from({ length: MONTHS_VISIBLE }, (_, i) =>
    addMonths(initialAnchor, offset + i)
  );

  return (
    <section className="flex flex-col gap-6 rounded-lg border border-border bg-card/60 p-4 backdrop-blur-sm sm:p-5">
      <div className="flex items-center justify-end gap-1">
        <NavButton label="Previous month" onClick={() => setOffset((o) => o - 1)}>
          <ChevronLeft className="size-4" aria-hidden />
        </NavButton>
        <NavButton label="Next month" onClick={() => setOffset((o) => o + 1)}>
          <ChevronRight className="size-4" aria-hidden />
        </NavButton>
      </div>

      {months.map((month) => (
        <MonthGrid
          key={`${month.year}-${month.month}`}
          month={month}
          today={today}
          byDay={byDay}
        />
      ))}
    </section>
  );
}

function NavButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="cursor-pointer rounded-md border border-border/60 p-1.5 text-muted-foreground outline-none transition hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      {children}
    </button>
  );
}

interface MonthGridProps {
  month: CivilDate;
  today: CivilDate;
  byDay: Map<string, DayRelease[]>;
}

function MonthGrid({ month, today, byDay }: MonthGridProps) {
  const { year, month: month0 } = month;
  const daysInMonth = new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();
  // 0 = Monday after the Mon-first shift.
  const leadingBlanks = (new Date(Date.UTC(year, month0, 1)).getUTCDay() + 6) % 7;

  const cells: (number | null)[] = [
    ...Array.from({ length: leadingBlanks }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  const releasesOn = (day: number | null): DayRelease[] =>
    day === null ? [] : (byDay.get(dayKey({ year, month: month0, day })) ?? []);

  const monthCount = weeks
    .flat()
    .reduce((sum: number, day) => sum + releasesOn(day).length, 0);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline gap-3">
        <h3 className="font-bold text-2xl tracking-tight text-foreground">
          {MONTH_NAMES[month0]}
        </h3>
        <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          {year} · {monthCount} {monthCount === 1 ? "launch" : "launches"}
        </span>
      </div>

      {/* Weekday header + the same gutter width every week reserves, so the 7
          day columns stay aligned across weeks and with this header. */}
      <div className="flex gap-2">
        <div className="grid flex-1 grid-cols-7 gap-1.5">
          {WEEKDAYS.map((label) => (
            <span
              key={label}
              className="text-[0.65rem] uppercase tracking-[0.15em] text-muted-foreground/60"
            >
              {label}
            </span>
          ))}
        </div>
        <div className="w-16 shrink-0 sm:w-24" aria-hidden />
      </div>

      <div className="flex flex-col gap-1.5">
        {weeks.map((week, wi) => {
          const weekCount = week.reduce(
            (sum: number, day) => sum + releasesOn(day).length,
            0
          );
          return (
            // biome-ignore lint/suspicious/noArrayIndexKey: weeks are positional rows
            <div key={wi} className="flex gap-2">
              <div className="grid flex-1 grid-cols-7 gap-1.5">
                {week.map((day, di) => (
                  <DayCell
                    // biome-ignore lint/suspicious/noArrayIndexKey: cells are positional
                    key={di}
                    day={day}
                    releases={releasesOn(day)}
                    isToday={
                      day !== null &&
                      today.year === year &&
                      today.month === month0 &&
                      today.day === day
                    }
                  />
                ))}
              </div>
              <div className="flex w-16 shrink-0 items-start sm:w-24">
                {weekCount >= 3 ? (
                  <span className="rounded-full bg-foreground/10 px-2 py-0.5 text-[0.65rem] font-medium text-muted-foreground">
                    {weekCount} this week
                  </span>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface DayCellProps {
  day: number | null;
  releases: DayRelease[];
  isToday: boolean;
}

function DayCell({ day, releases, isToday }: DayCellProps) {
  if (day === null) return <div aria-hidden />;

  const hasReleases = releases.length > 0;
  // Busy-day tint is a neutral alpha lift, never a hue (§ Art direction — the
  // accent token belongs to the hero's game on this page).
  const busy = releases.length >= 3;

  return (
    <div
      data-today={isToday ? "" : undefined}
      data-busy={busy ? "" : undefined}
      className={cn(
        "flex min-h-16 flex-col gap-1 rounded-md p-1",
        busy && "bg-foreground/5"
      )}
    >
      <span
        className={cn(
          "text-xs leading-none",
          hasReleases ? "font-medium text-foreground/70" : "text-muted-foreground/40",
          isToday &&
            "font-semibold text-foreground underline decoration-2 decoration-primary underline-offset-4"
        )}
      >
        {day}
      </span>
      {releases.map((release) => (
        <WishlistCapsule
          key={release.item.appid}
          item={release.item}
          detail={dayCountdownLabel(release.daysUntil)}
          ghost={release.isPast}
        />
      ))}
    </div>
  );
}
