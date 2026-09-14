import { type ChartDataColumn, ChartDataTable } from "@/components/chart-data-table";
import { ChartTooltipShell } from "@/components/chart-tooltip";
import { useElementWidth } from "@/lib/use-element-width";
import { FactCard } from "@/steam/_shared/fact-card";
import { FactCardData } from "@/steam/_shared/fact-card-data";
import { Brush } from "@visx/brush";
import type { Bounds, BrushHandleRenderProps } from "@visx/brush";
import { Group } from "@visx/group";
import { scaleLinear } from "@visx/scale";
import {
  OWNER_TIME_ZONE,
  type SteamLiveSession,
  type SteamPlaySessionDigest,
  type SteamSessions,
  formatHoursMinutes,
  localSlot,
} from "@vyoh/shared";
import { useMemo, useState } from "react";
import { clockOf, headlineFor } from "./session-copy";
import { useSteamSessions } from "./use-sessions";

const TITLE = "The strip";
const ROW_H = 22;
const AXIS_H = 18;
const MINIMAP_H = 36;
const LABEL_W = 128;
const MAX_ROWS = 8;
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
/** The span the brush opens on: two weeks reads as evenings, twelve as texture. */
const INITIAL_SPAN_MS = 14 * DAY_MS;

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

interface Bar {
  id: string;
  start: number;
  end: number;
  live: boolean;
  session: SteamPlaySessionDigest | null;
  unlockTimes: number[];
}

interface Row {
  appid: number;
  name: string;
  bars: Bar[];
}

// Every session as a bar on one continuous strip of time, one row per game,
// unlocks as dots inside the bar they landed in, and a brush under it to pick
// the span. Rows carry identity, so the bars share one hue and nothing on the
// chart asks a colour to tell games apart; the row label does that.
function toRows(data: SteamSessions): Row[] {
  const byApp = new Map<number, Row>();
  const order = data.perGame.map((g) => g.game.appid);
  for (const strip of data.perGame) {
    byApp.set(strip.game.appid, {
      appid: strip.game.appid,
      name: strip.game.name,
      bars: [],
    });
  }
  for (const s of data.sessions) {
    const row = byApp.get(s.game.appid);
    if (!row) continue;
    row.bars.push({
      id: s.id,
      start: Date.parse(s.startedAt),
      end: Date.parse(s.endedAt),
      live: false,
      session: s,
      unlockTimes: s.unlocks.map((u) => Date.parse(u.unlockedAt)),
    });
  }
  if (data.live) {
    const row = byApp.get(data.live.game.appid) ?? {
      appid: data.live.game.appid,
      name: data.live.game.name,
      bars: [],
    };
    byApp.set(data.live.game.appid, row);
    if (!order.includes(row.appid)) order.unshift(row.appid);
    row.bars.push({
      id: data.live.id,
      start: Date.parse(data.live.startedAt),
      end: Date.parse(data.window.to),
      live: true,
      session: null,
      unlockTimes: [],
    });
  }
  const rows = order
    .map((appid) => byApp.get(appid))
    .filter((r): r is Row => r !== undefined);
  if (rows.length <= MAX_ROWS) return rows;
  const head = rows.slice(0, MAX_ROWS - 1);
  const rest = rows.slice(MAX_ROWS - 1);
  head.push({
    appid: -1,
    name: `${rest.length} more games`,
    bars: rest.flatMap((r) => r.bars),
  });
  return head;
}

/** UTC instants of every owner-local midnight in [from, to]. */
function localMidnights(from: number, to: number): number[] {
  const out: number[] = [];
  // Brussels sits on whole-hour offsets, so midnight is on a UTC hour; after
  // a hit the next one is 23–25 h out, so skip ahead rather than test each.
  let t = Math.ceil(from / HOUR_MS) * HOUR_MS;
  while (t <= to) {
    if (localSlot(new Date(t), OWNER_TIME_ZONE).hour === 0) {
      out.push(t);
      t += 22 * HOUR_MS;
    }
    t += HOUR_MS;
  }
  return out;
}

function isWeekend(t: number): boolean {
  return localSlot(new Date(t), OWNER_TIME_ZONE).weekday >= 5;
}

interface Hover {
  bar: Bar;
  x: number;
  y: number;
}

function Strip({
  rows,
  from,
  to,
  live,
  width,
}: {
  rows: Row[];
  from: number;
  to: number;
  live: SteamLiveSession | null;
  width: number;
}) {
  const [domain, setDomain] = useState<[number, number] | null>(null);
  const [brushKey, setBrushKey] = useState(0);
  const [hover, setHover] = useState<Hover | null>(null);
  const [x0, x1] = domain ?? [Math.max(from, to - INITIAL_SPAN_MS), to];
  const chartH = rows.length * ROW_H;
  const xs = useMemo(
    () => scaleLinear({ domain: [x0, x1], range: [0, width] }),
    [x0, x1, width]
  );
  const xMini = useMemo(
    () => scaleLinear({ domain: [from, to], range: [0, width] }),
    [from, to, width]
  );
  const yMini = useMemo(() => scaleLinear({ domain: [0, 1], range: [MINIMAP_H, 0] }), []);
  // Scanned once for the whole window; the visible span filters it, so a
  // brush drag never re-walks the calendar.
  const allMidnights = useMemo(() => localMidnights(from, to), [from, to]);
  const midnights = useMemo(
    () => allMidnights.filter((m) => m >= x0 && m <= x1),
    [allMidnights, x0, x1]
  );
  const labelEvery = Math.max(1, Math.ceil(48 / Math.max(1, xs(x0 + DAY_MS) - xs(x0))));

  // Minutes per local day, for the minimap's density. Whole session credited
  // to the day it started; the minimap is a guide, not the record.
  const days = useMemo(() => {
    const totals = new Map<number, number>();
    for (const row of rows) {
      for (const bar of row.bars) {
        const day =
          allMidnights.findLast((m) => m <= bar.start) ?? allMidnights[0] ?? from;
        totals.set(day, (totals.get(day) ?? 0) + (bar.end - bar.start));
      }
    }
    const max = Math.max(1, ...totals.values());
    return [...totals.entries()].map(([day, ms]) => ({ day, share: ms / max }));
  }, [rows, allMidnights, from]);

  const initial = {
    start: { x: xMini(Math.max(from, to - INITIAL_SPAN_MS)) },
    end: { x: xMini(to) },
  };

  return (
    <div className="relative flex flex-col gap-1">
      <svg
        width={width}
        height={chartH + AXIS_H}
        role="img"
        aria-label="Sessions as bars on a strip of time, one row per game"
        onPointerLeave={() => setHover(null)}
      >
        <title>Sessions, one row per game</title>
        {/* Weekend bands and day lines */}
        {midnights.map((m, i) => {
          const next = midnights[i + 1] ?? x1;
          return (
            <Group key={m}>
              {isWeekend(m + HOUR_MS) && (
                <rect
                  x={xs(m)}
                  y={0}
                  width={Math.max(0, xs(Math.min(next, x1)) - xs(m))}
                  height={chartH}
                  className="fill-foreground/[0.035]"
                />
              )}
              <line
                x1={xs(m)}
                x2={xs(m)}
                y1={0}
                y2={chartH}
                className="stroke-border/50"
                strokeWidth={1}
              />
              {i % labelEvery === 0 && (
                <text
                  x={xs(m) + 3}
                  y={chartH + AXIS_H - 5}
                  className="fill-muted-foreground/70 text-[9px] tabular-nums"
                >
                  {DAY_LABEL.format(new Date(m))}
                </text>
              )}
            </Group>
          );
        })}
        {/* Row separators */}
        {rows.map((row, i) => (
          <line
            key={row.appid}
            x1={0}
            x2={width}
            y1={(i + 1) * ROW_H - 0.5}
            y2={(i + 1) * ROW_H - 0.5}
            className="stroke-border/30"
            strokeWidth={1}
          />
        ))}
        {/* Bars */}
        {rows.map((row, i) =>
          row.bars.map((bar) => {
            if (bar.end < x0 || bar.start > x1) return null;
            const left = xs(Math.max(bar.start, x0));
            const right = xs(Math.min(bar.end, x1));
            const w = Math.max(2, right - left);
            // Keeps the dot inside a bar that is narrower than the dot.
            const pad = Math.min(3, w / 2);
            const y = i * ROW_H + 4;
            const h = ROW_H - 8;
            return (
              <Group key={bar.id}>
                <rect
                  x={left}
                  y={y}
                  width={w}
                  height={h}
                  rx={2}
                  className={bar.live ? "fill-theme-strong/60" : "fill-theme-strong"}
                  strokeDasharray={bar.live ? "3 2" : undefined}
                  stroke={bar.live ? "var(--color-theme-strong)" : undefined}
                  onPointerMove={(e) => {
                    const box = e.currentTarget.ownerSVGElement?.getBoundingClientRect();
                    if (!box) return;
                    setHover({ bar, x: e.clientX - box.left, y: e.clientY - box.top });
                  }}
                />
                {bar.unlockTimes.map((t) =>
                  t >= x0 && t <= x1 ? (
                    <circle
                      key={t}
                      cx={Math.min(Math.max(xs(t), left + pad), left + w - pad)}
                      cy={y + h / 2}
                      r={2.5}
                      className="fill-background stroke-theme-strong"
                      strokeWidth={1}
                      pointerEvents="none"
                    />
                  ) : null
                )}
              </Group>
            );
          })
        )}
        {live && x1 === to && (
          <line
            x1={xs(to)}
            x2={xs(to)}
            y1={0}
            y2={chartH}
            className="stroke-theme-strong/70"
            strokeWidth={1}
            strokeDasharray="2 2"
          />
        )}
      </svg>

      {/* Minimap + brush */}
      <svg
        width={width}
        height={MINIMAP_H}
        role="img"
        aria-label="Minutes played per day across the window; drag to choose the span shown above"
      >
        {days.map((d) => (
          <rect
            key={d.day}
            x={xMini(d.day)}
            y={yMini(d.share)}
            width={Math.max(1, xMini(d.day + DAY_MS) - xMini(d.day) - 1)}
            height={MINIMAP_H - yMini(d.share)}
            rx={1}
            className="fill-foreground/25"
          />
        ))}
        <Brush
          key={brushKey}
          xScale={xMini}
          yScale={yMini}
          width={width}
          height={MINIMAP_H}
          margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
          brushDirection="horizontal"
          initialBrushPosition={initial}
          resizeTriggerAreas={["left", "right"]}
          handleSize={10}
          useWindowMoveEvents
          disableDraggingSelection={false}
          onChange={(bounds: Bounds | null) => {
            if (!bounds) {
              setDomain(null);
              return;
            }
            const lo = Math.max(from, bounds.x0);
            const hi = Math.min(to, bounds.x1);
            if (hi - lo >= HOUR_MS) setDomain([lo, hi]);
          }}
          selectedBoxStyle={{
            fill: "var(--color-theme-strong)",
            fillOpacity: 0.16,
            stroke: "var(--color-theme-strong)",
            strokeWidth: 1,
            strokeOpacity: 0.7,
          }}
          renderBrushHandle={({ x, height }: BrushHandleRenderProps) => (
            <rect
              x={x - 2}
              y={height * 0.2}
              width={4}
              height={height * 0.6}
              rx={1}
              fill="var(--color-theme-strong)"
              fillOpacity={0.9}
              style={{ cursor: "ew-resize" }}
            />
          )}
        />
      </svg>

      <div className="flex items-center justify-between text-[10px] text-muted-foreground/60">
        <span>
          {DATE_LABEL.format(new Date(x0))} to {DATE_LABEL.format(new Date(x1))} · drag
          the strip below the chart to move or resize the span
        </span>
        {domain && (
          <button
            type="button"
            className="rounded px-1.5 py-0.5 text-muted-foreground hover:bg-muted/40 hover:text-foreground"
            onClick={() => {
              setDomain(null);
              setBrushKey((k) => k + 1);
            }}
          >
            Reset span
          </button>
        )}
      </div>

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
  );
}

function BarTooltip({ bar }: { bar: Bar }) {
  const start = new Date(bar.start).toISOString();
  const end = new Date(bar.end).toISOString();
  const minutes = Math.round((bar.end - bar.start) / 60_000);
  return (
    <div className="flex max-w-56 flex-col gap-0.5">
      <p className="font-medium text-foreground">
        {bar.session?.game.name ?? "Now playing"} · {formatHoursMinutes(minutes)}
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

function ChartColumn(props: {
  rows: Row[];
  from: number;
  to: number;
  live: SteamLiveSession | null;
}) {
  const { ref, width } = useElementWidth();
  return (
    <div ref={ref} className="min-w-0 flex-1">
      {width >= 80 && <Strip {...props} width={width} />}
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
        const rows = toRows(data);
        const from = Date.parse(data.window.from);
        const to = Date.parse(data.window.to);
        return (
          <FactCard
            title={TITLE}
            // The header above counts every observed session, hidden games
            // included; this card can only draw the ones it may name, so it
            // speaks of games rather than restating a number that would differ.
            metric={data.perGame.length}
            metricLabel={{ singular: "game", plural: "games" }}
            verdict={`Sessions across ${data.perGame.length} ${data.perGame.length === 1 ? "game" : "games"}, laid on one strip of time. Hover a bar for the session; drag below to move the span.`}
            evidence={
              <>
                <div className="flex gap-2">
                  <ul className="shrink-0" style={{ width: LABEL_W, paddingTop: 0 }}>
                    {rows.map((row) => (
                      <li
                        key={row.appid}
                        className="truncate pr-2 text-right text-[11px] text-muted-foreground leading-none"
                        style={{ height: ROW_H, lineHeight: `${ROW_H}px` }}
                      >
                        {row.name}
                      </li>
                    ))}
                  </ul>
                  <ChartColumn rows={rows} from={from} to={to} live={data.live} />
                </div>
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
