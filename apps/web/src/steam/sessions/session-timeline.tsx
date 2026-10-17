import { type ChartDataColumn, ChartDataTable } from "@/components/chart-data-table";
import { ChartTooltipShell } from "@/components/chart-tooltip";
import { useElementWidth } from "@/lib/use-element-width";
import { FactCard } from "@/steam/_shared/fact-card";
import { FactCardData } from "@/steam/_shared/fact-card-data";
import { Brush } from "@visx/brush";
import type { Bounds } from "@visx/brush";
import { scaleLinear } from "@visx/scale";
import {
  OWNER_TIME_ZONE,
  type SteamPlaySessionDigest,
  type SteamSessions,
  formatHoursMinutes,
  localSlot,
} from "@vyoh/shared";
import { useMemo, useState } from "react";
import { clockOf, headlineFor } from "./session-copy";
import { useSteamSessions } from "./use-sessions";

const TITLE = "The strip";
const ROW_H = 20;
const BAR_H = 12;
const AXIS_H = 16;
const LABEL_W = 44;
const MINIMAP_H = 32;
const MINIMAP_LABEL_H = 12;
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const DAY_MIN = 24 * 60;
/**
 * A row runs from this owner-local hour to the next day's, so a session that
 * crosses midnight stays on the evening it began instead of splitting in two.
 */
const DAY_START_HOUR = 6;
const MIDNIGHT_OFFSET_H = (24 - DAY_START_HOUR) % 24;
/**
 * Rows shown at once. Fixed rather than resizable so the chart keeps its
 * height while the brush moves; a resize would shift the brush under the
 * pointer mid-drag.
 */
const SPAN_DAYS = 14;
const SPAN_WORDS = "two weeks";
/** Rough advance of one 10px glyph, for deciding whether a name fits beside its bar. */
const CHAR_W = 5.6;
/** Width the `now` mark's label claims to the right of its line. */
const NOW_W = 24;

const DAY_LABEL = new Intl.DateTimeFormat("en-GB", {
  timeZone: OWNER_TIME_ZONE,
  weekday: "short",
  day: "numeric",
});
const DATE_LABEL = new Intl.DateTimeFormat("en-GB", {
  timeZone: OWNER_TIME_ZONE,
  weekday: "long",
  day: "numeric",
  month: "long",
});
const MONTH_LABEL = new Intl.DateTimeFormat("en-GB", {
  timeZone: OWNER_TIME_ZONE,
  day: "numeric",
  month: "short",
});
const DAY_OF_MONTH = new Intl.DateTimeFormat("en-GB", {
  timeZone: OWNER_TIME_ZONE,
  day: "numeric",
});

interface Bar {
  id: string;
  appid: number;
  name: string;
  start: number;
  end: number;
  live: boolean;
  session: SteamPlaySessionDigest | null;
  unlockTimes: number[];
}

interface PlayDay {
  start: number;
  end: number;
}

/** A bar's share of one row, in wall-clock minutes since `DAY_START_HOUR`. */
interface Segment {
  bar: Bar;
  x0: number;
  x1: number;
  unlocks: number[];
}

// Every session laid on a clock: one row per owner-local day, the hours of
// that day across, so a reader sees *when* in the day play happened and how
// long it ran, and an empty row reads as a day off. A brush under it moves
// the fortnight through the window. Two tones rather than a hue per game:
// the span's most played game takes the accent and the rest stay muted with
// their names beside them, the same rule the landing card's day strip keeps.
function toBars(data: SteamSessions): Bar[] {
  const bars: Bar[] = data.sessions.map((s) => ({
    id: s.id,
    appid: s.game.appid,
    name: s.game.name,
    start: Date.parse(s.startedAt),
    end: Date.parse(s.endedAt),
    live: false,
    session: s,
    unlockTimes: s.unlocks.map((u) => Date.parse(u.unlockedAt)),
  }));
  if (data.live) {
    bars.push({
      id: data.live.id,
      appid: data.live.game.appid,
      name: data.live.game.name,
      start: Date.parse(data.live.startedAt),
      end: Date.parse(data.window.to),
      live: true,
      session: null,
      unlockTimes: [],
    });
  }
  return bars.sort((a, b) => a.start - b.start);
}

/** Every owner-local `DAY_START_HOUR`-to-`DAY_START_HOUR` day overlapping [from, to). */
function playDays(from: number, to: number): PlayDay[] {
  const bounds: number[] = [];
  // Brussels sits on whole-hour offsets, so the boundary is on a UTC hour;
  // after a hit the next one is 23–25 h out, so skip ahead rather than test each.
  let t = Math.floor((from - DAY_MS) / HOUR_MS) * HOUR_MS;
  const stop = to + DAY_MS + 2 * HOUR_MS;
  while (t <= stop) {
    if (localSlot(new Date(t), OWNER_TIME_ZONE).hour === DAY_START_HOUR) {
      bounds.push(t);
      t += 22 * HOUR_MS;
    }
    t += HOUR_MS;
  }
  const days: PlayDay[] = [];
  for (const [i, start] of bounds.entries()) {
    const end = bounds[i + 1];
    if (end === undefined) break;
    if (end > from && start < to) days.push({ start, end });
  }
  return days;
}

/**
 * Wall-clock minutes since the row's start hour, not elapsed time, so a bar
 * sits where the clock said it did even on a 23- or 25-hour day.
 */
function clockOffset(t: number, day: PlayDay): number {
  if (t <= day.start) return 0;
  if (t >= day.end) return DAY_MIN;
  const at = new Date(t);
  const { hour } = localSlot(at, OWNER_TIME_ZONE);
  return (
    ((hour - DAY_START_HOUR + 24) % 24) * 60 +
    at.getUTCMinutes() +
    at.getUTCSeconds() / 60
  );
}

function segmentsOf(bars: readonly Bar[], day: PlayDay): Segment[] {
  const out: Segment[] = [];
  for (const bar of bars) {
    if (bar.end <= day.start || bar.start >= day.end) continue;
    const x0 = clockOffset(bar.start, day);
    out.push({
      bar,
      x0,
      x1: Math.max(x0, clockOffset(bar.end, day)),
      // Steam stamps a batch of unlocks with one instant; they draw as one dot.
      unlocks: [
        ...new Set(
          bar.unlockTimes
            .filter((t) => t >= day.start && t < day.end)
            .map((t) => clockOffset(t, day))
        ),
      ],
    });
  }
  return out;
}

interface GameShare {
  appid: number;
  name: string;
  ms: number;
}

/** Time per game inside [lo, hi), most played first. */
function sharesIn(bars: readonly Bar[], lo: number, hi: number): GameShare[] {
  const byApp = new Map<number, GameShare>();
  for (const bar of bars) {
    const ms = Math.min(bar.end, hi) - Math.max(bar.start, lo);
    if (ms <= 0) continue;
    const share = byApp.get(bar.appid) ?? { appid: bar.appid, name: bar.name, ms: 0 };
    share.ms += ms;
    byApp.set(bar.appid, share);
  }
  return [...byApp.values()].sort((a, b) => b.ms - a.ms);
}

function playedOn(bars: readonly Bar[], day: PlayDay): boolean {
  return bars.some((b) => b.end > day.start && b.start < day.end);
}

function verdictFor(bars: readonly Bar[], days: readonly PlayDay[]): string {
  const span = days.slice(-SPAN_DAYS);
  const first = span[0];
  const last = span.at(-1);
  const games = first && last ? sharesIn(bars, first.start, last.end) : [];
  const lead = games[0];
  if (!lead) return `Nothing played in the last ${SPAN_WORDS}.`;
  const minutes = (ms: number) => formatHoursMinutes(Math.round(ms / 60_000));
  const across = `across ${span.filter((d) => playedOn(bars, d)).length} of ${span.length} days`;
  if (games.length === 1) {
    return `${lead.name} had the last ${SPAN_WORDS} to itself: ${minutes(lead.ms)} ${across}.`;
  }
  const total = games.reduce((sum, g) => sum + g.ms, 0);
  return `${lead.name} led the last ${SPAN_WORDS} with ${minutes(lead.ms)} of ${minutes(total)}, ${across}.`;
}

/** The name cut to fit `room` pixels, or null when too little of it would survive. */
function fitName(name: string, room: number): string | null {
  const max = Math.floor(room / CHAR_W);
  if (max >= name.length) return name;
  if (max < 6) return null;
  return `${name.slice(0, max - 1).trimEnd()}…`;
}

function clockLabel(offsetH: number): string {
  return `${String((DAY_START_HOUR + offsetH) % 24).padStart(2, "0")}:00`;
}

interface Hover {
  bar: Bar;
  x: number;
  y: number;
}

function Strip({
  bars,
  days,
  to,
  width,
}: {
  bars: Bar[];
  days: PlayDay[];
  to: number;
  width: number;
}) {
  const latest = Math.max(0, days.length - SPAN_DAYS);
  // Held as the instant the span's first day starts rather than an index, so
  // a refetch that drops the oldest day off the window can't slide the rows
  // a day under the highlight.
  const [firstStart, setFirstStart] = useState<number | null>(null);
  const [brushKey, setBrushKey] = useState(0);
  const [hover, setHover] = useState<Hover | null>(null);
  const found = firstStart === null ? -1 : days.findIndex((d) => d.start >= firstStart);
  const start = found < 0 ? latest : Math.min(found, latest);
  const visible = useMemo(() => days.slice(start, start + SPAN_DAYS), [days, start]);
  const plotW = width - LABEL_W;
  const chartH = AXIS_H + visible.length * ROW_H;

  const xClock = useMemo(
    () => scaleLinear({ domain: [0, DAY_MIN], range: [LABEL_W, width] }),
    [width]
  );
  const windowStart = days[0]?.start ?? 0;
  const windowEnd = days.at(-1)?.end ?? 0;
  const xMini = useMemo(
    () => scaleLinear({ domain: [windowStart, windowEnd], range: [0, plotW] }),
    [windowStart, windowEnd, plotW]
  );
  const yMini = useMemo(() => scaleLinear({ domain: [0, 1], range: [MINIMAP_H, 0] }), []);

  const rows = useMemo(
    () => visible.map((day) => ({ day, segments: segmentsOf(bars, day) })),
    [bars, visible]
  );
  const games = useMemo(
    () => sharesIn(bars, visible[0]?.start ?? 0, visible.at(-1)?.end ?? 0),
    [bars, visible]
  );
  const lead = games[0];

  // Clipped to each day rather than credited to the day a session started,
  // so the minimap agrees with the rows it selects.
  const density = useMemo(() => {
    const ms = days.map((d) =>
      bars.reduce(
        (sum, b) =>
          sum + Math.max(0, Math.min(b.end, d.end) - Math.max(b.start, d.start)),
        0
      )
    );
    const max = Math.max(1, ...ms);
    return ms.map((v) => v / max);
  }, [bars, days]);
  const monthStarts = useMemo(
    () => days.filter((d) => DAY_OF_MONTH.format(new Date(d.start)) === "1"),
    [days]
  );

  const step = (plotW / 24) * 3 >= 40 ? 3 : 6;
  const ticks = Array.from({ length: 24 / step + 1 }, (_, i) => i * step);

  const nowRow = visible.findIndex((d) => to > d.start && to <= d.end);
  const nowDay = visible[nowRow];
  const nowX = nowDay ? xClock(clockOffset(to, nowDay)) : null;
  const nowLabelRight = nowX !== null && nowX + 3 + NOW_W <= width;

  const firstDay = visible[0];
  const lastDay = visible.at(-1);
  const initial = firstDay &&
    lastDay && {
      start: { x: xMini(firstDay.start) },
      end: { x: xMini(lastDay.end) },
    };

  return (
    <div className="flex flex-col gap-1.5">
      {lead && (
        <div
          className="flex min-w-0 items-center gap-1.5 text-[10px] text-muted-foreground/70 leading-none"
          style={{ paddingLeft: LABEL_W }}
        >
          <span
            aria-hidden="true"
            className="size-2 shrink-0 rounded-[2px] bg-theme-strong"
          />
          <span className="truncate">{lead.name}</span>
          {games.length > 1 && (
            <>
              <span
                aria-hidden="true"
                className="ml-2 size-2 shrink-0 rounded-[2px] bg-muted-foreground/45"
              />
              <span className="shrink-0">
                {games.length === 2 ? "1 other game" : `${games.length - 1} other games`}
              </span>
            </>
          )}
        </div>
      )}

      <div className="relative">
        <svg
          width={width}
          height={chartH}
          role="img"
          aria-label="Sessions by time of day, one row per day"
          onPointerLeave={() => setHover(null)}
        >
          <title>Sessions by time of day, one row per day</title>
          {/* Weekend rows */}
          {rows.map(({ day }, i) =>
            localSlot(new Date(day.start), OWNER_TIME_ZONE).weekday >= 5 ? (
              <rect
                key={day.start}
                x={LABEL_W}
                y={AXIS_H + i * ROW_H}
                width={plotW}
                height={ROW_H}
                className="fill-foreground/[0.04]"
              />
            ) : null
          )}
          {/* Hour grid; midnight drawn stronger so late nights read as late */}
          {ticks.map((h) => (
            <g key={h}>
              <line
                x1={xClock(h * 60)}
                x2={xClock(h * 60)}
                y1={AXIS_H - 3}
                y2={chartH}
                className={h === MIDNIGHT_OFFSET_H ? "stroke-border" : "stroke-border/40"}
                strokeWidth={1}
              />
              {h < 24 && (
                <text
                  x={xClock(h * 60)}
                  y={AXIS_H - 6}
                  textAnchor={h === 0 ? "start" : "middle"}
                  className="fill-muted-foreground/70 text-[9px] tabular-nums"
                >
                  {clockLabel(h)}
                </text>
              )}
            </g>
          ))}
          {rows.map(({ day, segments }, i) => {
            const y = AXIS_H + i * ROW_H;
            const barY = y + (ROW_H - BAR_H) / 2;
            const isNowRow = i === nowRow;
            return (
              <g key={day.start}>
                <text
                  x={LABEL_W - 8}
                  y={y + ROW_H / 2}
                  dominantBaseline="central"
                  textAnchor="end"
                  className={`text-[10px] tabular-nums ${isNowRow ? "fill-theme-strong" : "fill-muted-foreground"}`}
                >
                  {DAY_LABEL.format(new Date(day.start))}
                </text>
                {segments.map((seg, j) => {
                  const left = xClock(seg.x0);
                  const w = Math.max(2, xClock(seg.x1) - left);
                  const accent = seg.bar.appid === lead?.appid;
                  // Keeps the dot inside a bar that is narrower than the dot.
                  const pad = Math.min(3, w / 2);
                  const prev = segments[j - 1];
                  const next = segments[j + 1];
                  // A muted bar is named beside itself, once per run, where
                  // the gap before the next bar (or the now mark) holds it.
                  let label: string | null = null;
                  let labelX = left + w + 4;
                  if (!accent && prev?.bar.appid !== seg.bar.appid) {
                    let limit = next ? xClock(next.x0) - 6 : width;
                    if (isNowRow && nowX !== null) {
                      // A bar that ends before now stops short of the mark and
                      // its word; the live bar ends on the mark, so its name
                      // goes after the word instead.
                      if (!seg.bar.live && nowX >= labelX - 4) {
                        limit = Math.min(
                          limit,
                          nowLabelRight ? nowX - 4 : nowX - 3 - NOW_W - 4
                        );
                      } else if (nowLabelRight) {
                        labelX = Math.max(labelX, nowX + 3 + NOW_W + 4);
                      }
                    }
                    label = fitName(seg.bar.name, limit - labelX);
                  }
                  return (
                    <g key={`${seg.bar.id}-${day.start}`}>
                      <rect
                        x={left}
                        y={barY}
                        width={w}
                        height={BAR_H}
                        rx={2}
                        pointerEvents="none"
                        className={`${accent ? "fill-theme-strong" : "fill-muted-foreground/45"} ${
                          seg.bar.live
                            ? "opacity-70 motion-safe:animate-[pulse_2.4s_cubic-bezier(0.4,0,0.6,1)_infinite]"
                            : ""
                        }`}
                        strokeDasharray={seg.bar.live ? "3 2" : undefined}
                        stroke={
                          seg.bar.live
                            ? accent
                              ? "var(--color-theme-strong)"
                              : "var(--color-muted-foreground)"
                            : undefined
                        }
                      />
                      {seg.unlocks.map((t) => (
                        <circle
                          key={t}
                          cx={Math.min(Math.max(xClock(t), left + pad), left + w - pad)}
                          cy={barY + BAR_H / 2}
                          r={2}
                          className={`fill-background ${accent ? "stroke-theme-strong" : "stroke-muted-foreground"}`}
                          strokeWidth={1}
                          pointerEvents="none"
                        />
                      ))}
                      {label && (
                        <text
                          x={labelX}
                          y={y + ROW_H / 2}
                          dominantBaseline="central"
                          className="fill-muted-foreground text-[10px]"
                          pointerEvents="none"
                        >
                          {label}
                        </text>
                      )}
                      {/* Hit target taller and wider than the mark, so a
                          ten-minute session is still something to hover. */}
                      <rect
                        data-session={seg.bar.id}
                        x={left + w / 2 - Math.max(w, 10) / 2}
                        y={y}
                        width={Math.max(w, 10)}
                        height={ROW_H}
                        fill="transparent"
                        onPointerMove={(e) => {
                          const box =
                            e.currentTarget.ownerSVGElement?.getBoundingClientRect();
                          if (!box) return;
                          setHover({
                            bar: seg.bar,
                            x: e.clientX - box.left,
                            y: e.clientY - box.top,
                          });
                        }}
                      />
                    </g>
                  );
                })}
              </g>
            );
          })}
          {nowX !== null && (
            <g pointerEvents="none">
              <line
                x1={nowX}
                x2={nowX}
                y1={AXIS_H + nowRow * ROW_H + 1}
                y2={AXIS_H + (nowRow + 1) * ROW_H - 1}
                className="stroke-theme-strong/80"
                strokeWidth={1.5}
                strokeDasharray="2 2"
              />
              <text
                x={nowLabelRight ? nowX + 3 : nowX - 3}
                y={AXIS_H + nowRow * ROW_H + ROW_H / 2}
                dominantBaseline="central"
                textAnchor={nowLabelRight ? "start" : "end"}
                className="fill-theme-strong font-semibold text-[9px] uppercase tracking-[0.12em]"
              >
                now
              </text>
            </g>
          )}
        </svg>

        <div
          className="pointer-events-none absolute z-10"
          style={{
            left: hover ? Math.min(hover.x + 12, Math.max(0, width - 240)) : 0,
            top: hover ? hover.y + 12 : 0,
          }}
        >
          <ChartTooltipShell>
            {hover ? <BarTooltip bar={hover.bar} /> : null}
          </ChartTooltipShell>
        </div>
      </div>

      {/* Minimap + brush, under the plot rather than the day labels */}
      <svg
        width={plotW}
        height={MINIMAP_H + MINIMAP_LABEL_H}
        style={{ marginLeft: LABEL_W }}
        role="img"
        aria-label="Minutes played per day across the window; drag the highlight to choose the days shown above"
      >
        {days.map((d, i) => {
          const share = density[i] ?? 0;
          if (share <= 0) return null;
          return (
            <rect
              key={d.start}
              x={xMini(d.start)}
              y={yMini(share)}
              width={Math.max(1, xMini(d.end) - xMini(d.start) - 1)}
              height={MINIMAP_H - yMini(share)}
              rx={1}
              className="fill-foreground/25"
            />
          );
        })}
        {monthStarts.map((d) => (
          <g key={d.start}>
            <line
              x1={xMini(d.start)}
              x2={xMini(d.start)}
              y1={MINIMAP_H}
              y2={MINIMAP_H + 3}
              className="stroke-muted-foreground/50"
              strokeWidth={1}
            />
            <text
              x={xMini(d.start) + 2}
              y={MINIMAP_H + MINIMAP_LABEL_H - 1}
              className="fill-muted-foreground/60 text-[9px]"
            >
              {MONTH_LABEL.format(new Date(d.start))}
            </text>
          </g>
        ))}
        {initial && (
          <Brush
            key={brushKey}
            xScale={xMini}
            yScale={yMini}
            width={plotW}
            height={MINIMAP_H}
            margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
            brushDirection="horizontal"
            initialBrushPosition={initial}
            resizeTriggerAreas={[]}
            disableDraggingOverlay
            disableDraggingSelection={false}
            useWindowMoveEvents
            onChange={(bounds: Bounds | null) => {
              if (!bounds) return;
              // visx reports the box's left edge 2 px short (its SAFE_PIXEL).
              // On a phone that is over half a day, and with the remount
              // below it stepped the span back a day on every click.
              const x0 = bounds.x0 + xMini.invert(2) - xMini.invert(0);
              // Snap to the nearest day so a row is never half in the span.
              const nearest = days.reduce(
                (best, d, i) =>
                  Math.abs(d.start - x0) < Math.abs((days[best]?.start ?? 0) - x0)
                    ? i
                    : best,
                0
              );
              setFirstStart(nearest >= latest ? null : (days[nearest]?.start ?? null));
            }}
            // Remounting at the snapped span lines the highlight up with
            // the rows it selected once the drag lets go.
            onBrushEnd={() => setBrushKey((k) => k + 1)}
            selectedBoxStyle={{
              fill: "var(--color-theme-strong)",
              fillOpacity: 0.16,
              stroke: "var(--color-theme-strong)",
              strokeWidth: 1,
              strokeOpacity: 0.7,
            }}
          />
        )}
      </svg>

      <div
        className="flex items-center justify-between gap-2 text-[10px] text-muted-foreground/60"
        style={{ paddingLeft: LABEL_W }}
      >
        <span>
          {firstDay && lastDay
            ? `${DATE_LABEL.format(new Date(firstDay.start))} to ${DATE_LABEL.format(new Date(lastDay.start))} · `
            : ""}
          drag the highlight to move through the weeks
        </span>
        {start !== latest && (
          <button
            type="button"
            className="shrink-0 cursor-pointer rounded px-1.5 py-0.5 text-muted-foreground hover:bg-muted/40 hover:text-foreground"
            onClick={() => {
              setFirstStart(null);
              setBrushKey((k) => k + 1);
            }}
          >
            Back to latest
          </button>
        )}
      </div>
    </div>
  );
}

function BarTooltip({ bar }: { bar: Bar }) {
  const start = new Date(bar.start).toISOString();
  const end = new Date(bar.end).toISOString();
  const minutes = Math.round((bar.end - bar.start) / 60_000);
  return (
    <div className="flex max-w-56 flex-col gap-0.5">
      <p className="font-medium text-foreground">
        {bar.name} · {formatHoursMinutes(minutes)}
      </p>
      <p className="text-muted-foreground tabular-nums">
        {DATE_LABEL.format(new Date(bar.start))} · {clockOf(start)} to{" "}
        {bar.live ? "now" : clockOf(end)}
      </p>
      {bar.session && (
        <p className="text-muted-foreground">
          {headlineFor(bar.session, "implicit").sentence}
        </p>
      )}
      {bar.unlockTimes.length > 0 && (
        <p className="text-muted-foreground">
          {bar.unlockTimes.length} {bar.unlockTimes.length === 1 ? "unlock" : "unlocks"}
        </p>
      )}
    </div>
  );
}

function ChartColumn(props: { bars: Bar[]; days: PlayDay[]; to: number }) {
  const { ref, width } = useElementWidth();
  return (
    <div ref={ref} className="min-w-0">
      {width >= LABEL_W + 80 && props.days.length > 0 && (
        <Strip {...props} width={width} />
      )}
    </div>
  );
}

const TABLE_COLUMNS: ChartDataColumn<SteamPlaySessionDigest>[] = [
  { key: "game", header: "Game", cell: (s) => s.game.name },
  {
    key: "start",
    header: "Started",
    cell: (s) => `${DATE_LABEL.format(new Date(s.startedAt))} ${clockOf(s.startedAt)}`,
  },
  {
    key: "duration",
    header: "Duration",
    cell: (s) => formatHoursMinutes(s.durationMinutes),
  },
  { key: "unlocks", header: "Unlocks", cell: (s) => s.unlocks.length },
];

export function SessionTimelineCard() {
  const query = useSteamSessions();
  return (
    <FactCardData
      query={query}
      title={TITLE}
      pendingLabel="Reading the log…"
      errorLabel="The strip is unavailable right now."
      emptyLabel="No closed session in the window yet."
      isEmpty={(d) => d.sessions.length === 0 && d.live === null}
    >
      {(data) => {
        const bars = toBars(data);
        const to = Date.parse(data.window.to);
        const days = playDays(Date.parse(data.window.from), to);
        return (
          <FactCard
            title={TITLE}
            // The header above counts every observed session, hidden games
            // included; this card can only draw the ones it may name, so it
            // speaks of games rather than restating a number that would differ.
            metric={data.perGame.length}
            metricLabel={{ singular: "game", plural: "games" }}
            verdict={verdictFor(bars, days)}
            evidence={
              <>
                <ChartColumn bars={bars} days={days} to={to} />
                <ChartDataTable
                  caption="Every observed session in the window"
                  columns={TABLE_COLUMNS}
                  rows={data.sessions}
                  rowKey={(s) => s.id}
                />
              </>
            }
          />
        );
      }}
    </FactCardData>
  );
}
