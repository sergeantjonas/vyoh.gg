import { EmptyLpHistoryIllustration, EmptyState } from "@/components/empty-state";
import { cn } from "@/lib/utils";
import { findPatchBoundaries } from "@/lol/_shared/patch-version";
import { useAccountFromSlug } from "@/lol/_shared/use-account-from-slug";
import { useMatchWindow } from "@/lol/matches/match-window-context";
import { type RangeKey, useRankHistory } from "@/lol/profile/use-rank-history";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { Brush } from "@visx/brush";
import type { BrushHandleRenderProps } from "@visx/brush/lib/BrushHandle";
import type { Bounds } from "@visx/brush/lib/types";
import { Group } from "@visx/group";
import { ParentSize } from "@visx/responsive";
import { scaleLinear } from "@visx/scale";
import { LinePath } from "@visx/shape";
import type { RankHistoryPoint } from "@vyoh/shared";
import { formatRank, normalizeLp } from "@vyoh/shared/lol/rank-history";
import { AnimatePresence, m, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useState } from "react";

const TOOLTIP_CONTENT_CLASS =
  "pointer-events-none z-50 max-w-xs rounded-md border bg-popover/85 px-2 py-1 text-xs text-popover-foreground shadow-xl backdrop-blur-md data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0 data-[state=delayed-open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type QueueKey = "solo" | "flex";

const QUEUE_LABEL: Record<QueueKey, string> = {
  solo: "Solo/Duo",
  flex: "Flex",
};

const RANGE_LABEL: Record<RangeKey, string> = {
  "30d": "30d",
  "90d": "90d",
  season: "Season",
};

const QUEUE_COLOR: Record<QueueKey, string> = {
  solo: "#34d399",
  flex: "#fbbf24",
};

const QUEUE_TYPE_FOR_BOUNDARIES: Record<QueueKey, string> = {
  solo: "Ranked Solo",
  flex: "Ranked Flex",
};

const STREAK_MIN_LENGTH = 3;

interface ChartPoint extends RankHistoryPoint {
  t: number;
  totalLp: number;
}

function toChartPoints(points: RankHistoryPoint[]): ChartPoint[] {
  return points.map((p) => ({
    ...p,
    t: new Date(p.capturedAt).getTime(),
    totalLp: normalizeLp(p.tier, p.rank, p.leaguePoints),
  }));
}

interface Streak {
  startIdx: number;
  endIdx: number;
  type: "win" | "loss";
  length: number;
}

function findLongestStreak(points: ChartPoint[]): Streak | null {
  if (points.length < STREAK_MIN_LENGTH + 1) return null;

  let best: Streak | null = null;
  let runStart = 0;
  let runType: "win" | "loss" | null = null;

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    if (!prev || !curr) continue;
    const delta = curr.totalLp - prev.totalLp;
    if (delta === 0) continue;
    const t: "win" | "loss" = delta > 0 ? "win" : "loss";

    if (t !== runType) {
      runStart = i - 1;
      runType = t;
    }

    const length = i - runStart;
    if (length >= STREAK_MIN_LENGTH && (!best || length > best.length)) {
      best = { startIdx: runStart, endIdx: i, type: t, length };
    }
  }

  return best;
}

function findTierChanges(points: ChartPoint[]): number[] {
  const indices: number[] = [];
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    if (!prev || !curr) continue;
    if (prev.tier !== curr.tier || prev.rank !== curr.rank) {
      indices.push(i);
    }
  }
  return indices;
}

function formatTickDate(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function LpTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: ChartPoint }>;
}) {
  const reduced = useReducedMotion();
  const point = payload?.[0]?.payload;
  return (
    <AnimatePresence>
      {active && point ? (
        <m.div
          initial={reduced ? {} : { opacity: 0, y: 4, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={reduced ? {} : { opacity: 0, scale: 0.96 }}
          transition={{ type: "spring", stiffness: 400, damping: 28 }}
          className="rounded-md border bg-popover/85 px-3 py-2 text-sm text-popover-foreground shadow-xl backdrop-blur-md"
        >
          <div className="mb-0.5 text-xs text-muted-foreground">
            {new Date(point.t).toLocaleString(undefined, {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </div>
          <div className="font-semibold">
            {formatRank(point.tier, point.rank, point.leaguePoints)}
          </div>
        </m.div>
      ) : null}
    </AnimatePresence>
  );
}

function QueueTabs({
  value,
  onChange,
  available,
}: {
  value: QueueKey;
  onChange: (v: QueueKey) => void;
  available: Record<QueueKey, boolean>;
}) {
  return (
    <div className="inline-flex rounded-md border bg-muted/40 p-0.5 text-xs">
      {(["solo", "flex"] as const).map((q) => {
        const disabled = !available[q];
        const active = value === q;
        return (
          <button
            key={q}
            type="button"
            disabled={disabled}
            onClick={() => onChange(q)}
            className={cn(
              "cursor-pointer rounded px-2.5 py-1 transition-colors",
              active
                ? "bg-background font-semibold text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
              disabled && "cursor-not-allowed opacity-40 hover:text-muted-foreground"
            )}
          >
            {QUEUE_LABEL[q]}
          </button>
        );
      })}
    </div>
  );
}

function RangeTabs({
  value,
  onChange,
}: {
  value: RangeKey;
  onChange: (v: RangeKey) => void;
}) {
  return (
    <div className="inline-flex rounded-md border bg-muted/40 p-0.5 text-xs">
      {(["30d", "90d", "season"] as const).map((r) => {
        const active = value === r;
        return (
          <button
            key={r}
            type="button"
            onClick={() => onChange(r)}
            className={cn(
              "cursor-pointer rounded px-2.5 py-1 transition-colors",
              active
                ? "bg-background font-semibold text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {RANGE_LABEL[r]}
          </button>
        );
      })}
    </div>
  );
}

function LpBrush({
  points,
  brushDomain,
  stroke,
  onChange,
}: {
  points: ChartPoint[];
  brushDomain: [number, number] | null;
  stroke: string;
  onChange: (range: [number, number] | null) => void;
}) {
  if (points.length < 4) return null;
  return (
    <ParentSize>
      {({ width }) => {
        if (width < 80) return null;
        const height = 44;
        const margin = { top: 6, bottom: 6, left: 0, right: 0 };
        const innerW = width;
        const innerH = height - margin.top - margin.bottom;

        const tMin = points[0]?.t ?? 0;
        const tMax = points[points.length - 1]?.t ?? tMin + 1;
        let lpMin = Number.POSITIVE_INFINITY;
        let lpMax = Number.NEGATIVE_INFINITY;
        for (const p of points) {
          if (p.totalLp < lpMin) lpMin = p.totalLp;
          if (p.totalLp > lpMax) lpMax = p.totalLp;
        }
        if (lpMin === lpMax) lpMax = lpMin + 1;

        const xScale = scaleLinear<number>({
          range: [0, innerW],
          domain: [tMin, tMax],
        });
        const yScale = scaleLinear<number>({
          range: [innerH, 0],
          domain: [lpMin, lpMax],
        });

        const initial =
          brushDomain && brushDomain[0] >= tMin && brushDomain[1] <= tMax
            ? {
                start: { x: xScale(brushDomain[0]) },
                end: { x: xScale(brushDomain[1]) },
              }
            : undefined;

        return (
          <svg
            width={width}
            height={height}
            role="img"
            aria-label="LP history range brush"
          >
            <Group top={margin.top}>
              <LinePath
                data={points}
                x={(d) => xScale(d.t)}
                y={(d) => yScale(d.totalLp)}
                stroke={stroke}
                strokeWidth={1}
                strokeOpacity={0.45}
                fill="none"
              />
              <Brush
                xScale={xScale}
                yScale={yScale}
                width={innerW}
                height={innerH}
                margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
                brushDirection="horizontal"
                initialBrushPosition={initial}
                resizeTriggerAreas={["left", "right"]}
                handleSize={10}
                onChange={(domain: Bounds | null) => {
                  if (!domain) {
                    onChange(null);
                    return;
                  }
                  onChange([domain.x0, domain.x1]);
                }}
                selectedBoxStyle={{
                  fill: stroke,
                  fillOpacity: 0.18,
                  stroke,
                  strokeWidth: 1,
                  strokeOpacity: 0.75,
                }}
                useWindowMoveEvents
                renderBrushHandle={({
                  x,
                  height,
                  isBrushActive,
                }: BrushHandleRenderProps) =>
                  isBrushActive ? (
                    <g>
                      <rect
                        x={x - 3}
                        y={0}
                        width={6}
                        height={height}
                        rx={1}
                        fill={stroke}
                        fillOpacity={0.85}
                      />
                      <line
                        x1={x}
                        y1={height * 0.3}
                        x2={x}
                        y2={height * 0.7}
                        stroke="var(--background)"
                        strokeWidth={1}
                      />
                    </g>
                  ) : null
                }
              />
            </Group>
          </svg>
        );
      }}
    </ParentSize>
  );
}

export function ProfileLpHistory({ accountSlug }: { accountSlug: string }) {
  const account = useAccountFromSlug(accountSlug);
  const [range, setRange] = useState<RangeKey>("90d");
  const [queue, setQueue] = useState<QueueKey>("solo");
  const [brushDomain, setBrushDomain] = useState<[number, number] | null>(null);
  // visx <Brush> owns its internal selection rect; clearing our React state
  // alone leaves the visual box behind. Bumping this key forces a remount.
  const [brushKey, setBrushKey] = useState(0);
  const reduced = useReducedMotion();

  const resetBrush = () => {
    setBrushDomain(null);
    setBrushKey((k) => k + 1);
  };

  const history = useRankHistory(account, range);

  const available = useMemo<Record<QueueKey, boolean>>(
    () => ({
      solo: (history.data?.solo.length ?? 0) > 0,
      flex: (history.data?.flex.length ?? 0) > 0,
    }),
    [history.data]
  );

  const activeQueue: QueueKey = available[queue]
    ? queue
    : available.solo
      ? "solo"
      : "flex";

  const points = useMemo(() => {
    const raw = history.data?.[activeQueue] ?? [];
    return toChartPoints(raw);
  }, [history.data, activeQueue]);

  // Reset the brush selection whenever the underlying dataset changes
  // (different range or queue) so the user never sees a stale selection
  // pointing at timestamps that aren't in the new dataset.
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional reset on range/queue change
  useEffect(() => {
    resetBrush();
  }, [range, activeQueue]);

  // Filter the visible series to the brush window if one is active.
  const visiblePoints = useMemo(() => {
    if (!brushDomain) return points;
    const [lo, hi] = brushDomain;
    return points.filter((p) => p.t >= lo && p.t <= hi);
  }, [points, brushDomain]);

  const streak = useMemo(() => findLongestStreak(visiblePoints), [visiblePoints]);
  const tierChangeIdxs = useMemo(() => findTierChanges(visiblePoints), [visiblePoints]);

  // Patch boundaries are derived from ranked matches in the chart's queue
  // (timestamps line up with rank-snapshot timestamps closely enough). Out-of-
  // range boundaries are clipped via `ifOverflow="hidden"` on the ReferenceLine.
  const { matches: allMatches } = useMatchWindow();
  const patchBoundaries = useMemo(() => {
    if (!allMatches || points.length === 0) return [];
    const queueType = QUEUE_TYPE_FOR_BOUNDARIES[activeQueue];
    const chrono = allMatches
      .filter((m) => m.queueType === queueType && !m.remake && m.gameVersion)
      .slice()
      .sort((a, b) => a.playedAt.localeCompare(b.playedAt));
    return findPatchBoundaries(
      chrono,
      (m) => m.gameVersion,
      (m) => new Date(m.playedAt).getTime()
    );
  }, [allMatches, activeQueue, points.length]);

  const isEmpty = !history.isLoading && points.length === 0;
  const stroke = QUEUE_COLOR[activeQueue];
  const gradientId = `lp-area-${activeQueue}`;

  // Y axis fits the brushed window so a narrow selection zooms vertically too.
  const yDomain = useMemo<[number | "auto", number | "auto"]>(() => {
    const pool = visiblePoints.length > 0 ? visiblePoints : points;
    if (pool.length === 0) return ["auto", "auto"];
    let min = pool[0]?.totalLp ?? 0;
    let max = min;
    for (const p of pool) {
      if (p.totalLp < min) min = p.totalLp;
      if (p.totalLp > max) max = p.totalLp;
    }
    const padding = Math.max(20, Math.round((max - min) * 0.1));
    return [Math.max(0, min - padding), max + padding];
  }, [visiblePoints, points]);

  const xDomain = useMemo<[number | "dataMin", number | "dataMax"]>(() => {
    if (brushDomain) return brushDomain;
    return ["dataMin", "dataMax"];
  }, [brushDomain]);

  return (
    <m.section
      className="flex flex-col gap-3"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 380, damping: 30 }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            LP History
          </div>
          {streak && (
            <TooltipPrimitive.Root>
              <TooltipPrimitive.Trigger asChild>
                <span
                  className={cn(
                    "cursor-help rounded-full border px-2 py-0.5 text-[10px] font-medium",
                    streak.type === "win"
                      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                      : "border-rose-500/40 bg-rose-500/10 text-rose-400"
                  )}
                >
                  {streak.length}
                  {streak.type === "win" ? "W" : "L"} run
                </span>
              </TooltipPrimitive.Trigger>
              <TooltipPrimitive.Portal>
                <TooltipPrimitive.Content
                  side="top"
                  sideOffset={4}
                  className={TOOLTIP_CONTENT_CLASS}
                >
                  Longest {streak.type} run in this range
                </TooltipPrimitive.Content>
              </TooltipPrimitive.Portal>
            </TooltipPrimitive.Root>
          )}
        </div>
        <div className="flex items-center gap-2">
          <QueueTabs value={activeQueue} onChange={setQueue} available={available} />
          <RangeTabs value={range} onChange={setRange} />
        </div>
      </div>

      {isEmpty ? (
        <div className="flex h-48 items-center justify-center rounded-md border border-dashed">
          <EmptyState
            illustration={<EmptyLpHistoryIllustration />}
            title={
              history.isError ? "Couldn't load rank history" : "No rank snapshots yet"
            }
            hint={
              history.isError
                ? undefined
                : "Play a ranked match — the timeline starts as snapshots come in."
            }
            className="py-2"
          />
        </div>
      ) : (
        <div className="h-48 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={stroke} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={stroke} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis
                dataKey="t"
                type="number"
                scale="time"
                domain={xDomain}
                allowDataOverflow
                tickFormatter={formatTickDate}
                tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                minTickGap={48}
              />
              <YAxis
                domain={yDomain}
                tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                width={40}
                allowDecimals={false}
              />
              <Tooltip
                content={<LpTooltip />}
                cursor={{ stroke: "var(--border)", strokeWidth: 1 }}
              />
              {streak &&
                visiblePoints[streak.startIdx] &&
                visiblePoints[streak.endIdx] && (
                  <ReferenceArea
                    x1={visiblePoints[streak.startIdx]?.t}
                    x2={visiblePoints[streak.endIdx]?.t}
                    fill={streak.type === "win" ? "#34d399" : "#f87171"}
                    fillOpacity={0.08}
                    stroke="none"
                    ifOverflow="hidden"
                  />
                )}
              {patchBoundaries.map((b) => (
                <ReferenceLine
                  key={`patch-${b.fromPatch}-${b.toPatch}`}
                  x={b.ts}
                  stroke="currentColor"
                  strokeOpacity={0.18}
                  strokeDasharray="2 3"
                  ifOverflow="hidden"
                  label={{
                    value: b.toPatch,
                    position: "insideTopRight",
                    fill: "var(--muted-foreground)",
                    fontSize: 10,
                  }}
                  className="text-muted-foreground"
                />
              ))}
              <Line
                type="monotone"
                dataKey="totalLp"
                stroke={stroke}
                strokeWidth={2}
                dot={{ r: 2.5, fill: stroke, stroke }}
                activeDot={{ r: 5, fill: stroke, stroke }}
                fill={`url(#${gradientId})`}
                animationDuration={reduced ? 0 : 1400}
                animationBegin={reduced ? 0 : 200}
                animationEasing="ease-out"
                isAnimationActive={!reduced}
              />
              {tierChangeIdxs.map((idx) => {
                const p = visiblePoints[idx];
                if (!p) return null;
                return (
                  <ReferenceDot
                    key={`tier-${idx}`}
                    x={p.t}
                    y={p.totalLp}
                    r={5}
                    fill="#facc15"
                    stroke="var(--background)"
                    strokeWidth={2}
                    ifOverflow="hidden"
                  />
                );
              })}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
      {!isEmpty && points.length >= 4 && (
        <div className="flex flex-col gap-1 rounded-md border border-border/60 bg-card/30 px-2 py-1.5">
          <div className="flex items-center justify-between gap-2 px-0.5 text-[10px] uppercase tracking-wide text-muted-foreground/60">
            <span>
              {brushDomain
                ? "Showing a sub-range — drag the highlighted band to pan"
                : "Drag across the strip to zoom into a date range"}
            </span>
            {brushDomain && (
              <button
                type="button"
                onClick={resetBrush}
                className="cursor-pointer rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-foreground/70 transition-colors hover:bg-muted/40 hover:text-foreground"
              >
                Show all
              </button>
            )}
          </div>
          <LpBrush
            key={brushKey}
            points={points}
            brushDomain={brushDomain}
            stroke={stroke}
            onChange={setBrushDomain}
          />
        </div>
      )}
    </m.section>
  );
}
