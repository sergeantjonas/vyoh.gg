import { type ChartDataColumn, ChartDataTable } from "@/components/chart-data-table";
import { TOOLTIP_CONTENT_COMPACT } from "@/lib/tooltip";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import {
  type DayStripCell,
  type DayStripSession,
  type SteamLiveSession,
  type SteamPlaySessionDigest,
  buildDayStrip,
  dayStripActiveDays,
  dayStripPeakMinutes,
  formatHoursMinutes,
  localDay,
} from "@vyoh/shared";
import { useMemo } from "react";

// The landing card's miniature of the sessions route's strip: one bar per
// owner-local day over a trailing window, unlock ticks under it, the day the
// headline is about ringed. Deliberately not the visx timeline — that chart
// earns its brush and its per-game rows on a page that is only about
// sessions; here the question is just "when, and how much", which a CSS grid
// answers at a fraction of the bundle.
//
// The bar area is `flex-1` on purpose. This card shares a stretch grid row
// with a taller sibling, so the slack has to land somewhere; a fixed-height
// chart would just move the hole under itself.

const DAY_LABEL = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

/** Below this the bars are noise rather than a rhythm, and the strip is not drawn. */
const MIN_ACTIVE_DAYS = 2;

/** A played day never draws as a hairline — the shortest session must still read as one. */
const MIN_BAR_PERCENT = 12;

function labelFor(day: string): string {
  // The cell key is already an owner-local `YYYY-MM-DD`; parsing it as UTC
  // formats the same calendar day back, without a second zone conversion.
  return DAY_LABEL.format(new Date(`${day}T00:00:00Z`));
}

function cellTitle(cell: DayStripCell): string {
  // The games, not just the total: the bar's two tones say "this game and
  // something else", and the tooltip is where "something else" gets its name.
  const games = cell.byGame
    .map((g) => `${g.name} ${formatHoursMinutes(g.minutes)}`)
    .join(", ");
  const unlocks =
    cell.unlockCount > 0
      ? ` · ${cell.unlockCount} unlock${cell.unlockCount === 1 ? "" : "s"}`
      : "";
  return `${labelFor(cell.day)} · ${games}${unlocks}`;
}

const TABLE_COLUMNS: ChartDataColumn<DayStripCell>[] = [
  { key: "day", header: "Day", cell: (c) => labelFor(c.day) },
  { key: "minutes", header: "Played", cell: (c) => formatHoursMinutes(c.minutes) },
  // The two tones are the only visual carrier of which game a bar was, so the
  // table names them — colour alone never states a fact here.
  { key: "games", header: "Games", cell: (c) => c.byGame.map((g) => g.name).join(", ") },
  { key: "unlocks", header: "Unlocks", cell: (c) => c.unlockCount },
];

function DayBar({
  cell,
  peak,
  ringed,
  subjectAppid,
}: {
  cell: DayStripCell;
  peak: number;
  ringed: boolean;
  subjectAppid: number | undefined;
}) {
  const played = cell.minutes > 0;
  const height = played
    ? Math.max(MIN_BAR_PERCENT, Math.round((cell.minutes / peak) * 100))
    : 0;
  // Two tones, not a hue per game: the headline names one game, so the only
  // distinction the bar has to carry is that game against everything else. A
  // categorical palette here would need validating for a set that changes
  // every time the owner starts something new, to answer a question the
  // tooltip already answers by name.
  const subjectMinutes = cell.byGame.find((g) => g.appid === subjectAppid)?.minutes ?? 0;
  const subjectPercent = played ? Math.round((subjectMinutes / cell.minutes) * 100) : 0;

  const bar = (
    <div className="flex h-full w-full flex-col justify-end gap-1">
      <div className="relative flex h-full items-end">
        {played ? (
          <div
            className={`flex w-full flex-col justify-end overflow-hidden rounded-[2px] ${ringed ? "ring-1 ring-foreground/40" : ""}`}
            style={{ height: `${height}%` }}
          >
            {/* One percentage, two heights derived from it — rounding each
                independently lets the pair total 99 or 101. */}
            <div
              className="w-full bg-muted-foreground/30"
              style={{ height: `${100 - subjectPercent}%` }}
            />
            <div
              className="w-full bg-theme-strong/70"
              style={{ height: `${subjectPercent}%` }}
            />
          </div>
        ) : (
          // A played day and a silent one must not look like the same
          // small bar, so silence is a baseline rule rather than a stub.
          <div className="h-px w-full rounded-full bg-muted-foreground/25" />
        )}
      </div>
      <div
        aria-hidden="true"
        className={`mx-auto size-1 rounded-full ${cell.unlockCount > 0 ? "bg-foreground/45" : "bg-transparent"}`}
      />
    </div>
  );

  if (!played) return bar;
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>{bar}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side="top"
          sideOffset={4}
          className={TOOLTIP_CONTENT_COMPACT}
        >
          {cellTitle(cell)}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}

export interface SessionDayStripProps {
  sessions: readonly SteamPlaySessionDigest[];
  /** The open session, drawn up to `through` so today's bar reflects play in progress. */
  live?: SteamLiveSession | null;
  timeZone: string;
  days: number;
  /** End of the window, as `window.to` — the response's own clock, so server and client agree. */
  through: string;
}

export function SessionDayStrip({
  sessions,
  live = null,
  timeZone,
  days,
  through,
}: SessionDayStripProps) {
  const cells = useMemo(() => {
    const end = new Date(through);
    const rows: DayStripSession[] = sessions.map((s) => ({
      appid: s.game.appid,
      name: s.game.name,
      startedAt: new Date(s.startedAt),
      endedAt: new Date(s.endedAt),
      unlocks: s.unlocks,
    }));
    if (live) {
      rows.push({
        appid: live.game.appid,
        name: live.game.name,
        startedAt: new Date(live.startedAt),
        endedAt: end,
        unlocks: [],
      });
    }
    return buildDayStrip(rows, timeZone, days, end);
  }, [sessions, live, timeZone, days, through]);

  // The day the headline is about: the open session's, or the newest closed
  // one's. Ringing it is what ties the sentence above to a bar below.
  const highlightDay = useMemo(() => {
    const at = live?.startedAt ?? sessions[0]?.startedAt;
    return at ? localDay(new Date(at), timeZone) : undefined;
  }, [live, sessions, timeZone]);

  // The game the headline names. Its minutes take the accent; everything else
  // in the window takes the muted tone, so the window's other games are
  // visible as *not* the subject rather than absorbed into it.
  const subject = live?.game ?? sessions[0]?.game;
  const otherGames = useMemo(() => {
    const appids = new Set<number>();
    for (const cell of cells) {
      for (const g of cell.byGame) if (g.appid !== subject?.appid) appids.add(g.appid);
    }
    return appids.size;
  }, [cells, subject]);

  const peak = dayStripPeakMinutes(cells);
  if (dayStripActiveDays(cells) < MIN_ACTIVE_DAYS) return null;

  const first = cells[0];
  const last = cells.at(-1);

  return (
    // Grows into the row's slack, but capped: past this the bars stop reading
    // as a strip and start reading as a bar chart the card never promised.
    <div className="flex max-h-24 min-h-14 flex-1 flex-col gap-1">
      {/* One reveal on the strip, not one per bar: 28 elements each animating
          opacity would promote 28 layers for the duration of the entrance. */}
      <div
        className="heatmap-cell flex flex-1 items-stretch gap-[2px]"
        role="img"
        aria-label={`Minutes played per day over the last ${days} days`}
      >
        {cells.map((cell) => (
          <DayBar
            key={cell.day}
            cell={cell}
            peak={peak}
            ringed={cell.day === highlightDay}
            subjectAppid={subject?.appid}
          />
        ))}
      </div>
      <div className="flex items-center justify-between gap-2 text-[10px] text-muted-foreground/60 leading-none">
        <span className="shrink-0">{first ? labelFor(first.day) : ""}</span>
        {subject && otherGames > 0 && (
          <span className="flex min-w-0 items-center gap-1.5">
            <span
              aria-hidden="true"
              className="size-1.5 rounded-[1px] bg-theme-strong/70"
            />
            <span className="truncate">{subject.name}</span>
            <span
              aria-hidden="true"
              className="ml-1 size-1.5 rounded-[1px] bg-muted-foreground/30"
            />
            <span className="shrink-0">
              {otherGames === 1 ? "1 other game" : `${otherGames} other games`}
            </span>
          </span>
        )}
        <span className="shrink-0">{last ? labelFor(last.day) : ""}</span>
      </div>
      <ChartDataTable
        caption={`Minutes played per day over the last ${days} days — days with any play`}
        columns={TABLE_COLUMNS}
        rows={cells.filter((c) => c.minutes > 0)}
        rowKey={(c) => c.day}
      />
    </div>
  );
}
