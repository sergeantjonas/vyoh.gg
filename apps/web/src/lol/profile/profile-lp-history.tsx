// Baseline: personal — your LP snapshots; streak overlay derives from your match results.
import { EmptyLpHistoryIllustration, EmptyState } from "@/components/empty-state";
import { SectionTitle } from "@/components/ui/section-title";
import {
  CHART_AXIS,
  CHART_CURSOR,
  CHART_GRID,
  CHART_NEGATIVE,
  CHART_POSITIVE,
} from "@/lib/chart-palette";
import { TOOLTIP_CONTENT_COMPACT } from "@/lib/tooltip";
import { cn } from "@/lib/utils";
import { useAccountFromSlug } from "@/lol/_shared/account/use-account-from-slug";
import { findPatchBoundaries } from "@/lol/_shared/patch/patch-version";
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
import {
  RANKED_QUEUE_KEY_LABEL,
  type RankedQueueKey,
  excludeRemakes,
} from "@vyoh/shared";
import { detectSeasons } from "@vyoh/shared/lol/rank-history";
import { m, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
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
import {
  QUEUE_COLOR,
  QUEUE_TYPE_FOR_BOUNDARIES,
  RANGE_LABEL,
  RESOLUTION_FOR_RANGE,
  TIER_BANDS,
} from "./profile-lp-history-constants";
import {
  type ChartPoint,
  findLongestStreak,
  findTierChanges,
  makeDayTicks,
  makeTickFormatter,
  mapRealToVisual,
  toChartPoints,
} from "./profile-lp-history-helpers";
import { LpTooltip } from "./profile-lp-history-tooltip";

function QueueTabs({
  value,
  onChange,
  available,
}: {
  value: RankedQueueKey;
  onChange: (v: RankedQueueKey) => void;
  available: Record<RankedQueueKey, boolean>;
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
            {RANKED_QUEUE_KEY_LABEL[q]}
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
  const [queue, setQueue] = useState<RankedQueueKey>("solo");
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

  const available = useMemo<Record<RankedQueueKey, boolean>>(
    () => ({
      solo: (history.data?.solo.length ?? 0) > 0,
      flex: (history.data?.flex.length ?? 0) > 0,
    }),
    [history.data]
  );

  const activeQueue: RankedQueueKey = available[queue]
    ? queue
    : available.solo
      ? "solo"
      : "flex";

  const resolution = RESOLUTION_FOR_RANGE[range];

  const points = useMemo(() => {
    const raw = history.data?.[activeQueue] ?? [];
    return toChartPoints(raw, resolution);
  }, [history.data, activeQueue, resolution]);

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

  const dateTicks = useMemo(() => makeDayTicks(visiblePoints), [visiblePoints]);
  const tickFormatter = useMemo(() => makeTickFormatter(visiblePoints), [visiblePoints]);

  const streak = useMemo(() => findLongestStreak(visiblePoints), [visiblePoints]);
  // Tier changes are computed against `points` (not visiblePoints) so the
  // index returned by Recharts' custom-dot function on `<Line data={points}>`
  // can be matched directly. Out-of-brush tier changes are clipped by the
  // ReferenceDot's `ifOverflow="hidden"`, so the user-facing behavior is
  // unchanged.
  const tierChanges = useMemo(() => findTierChanges(points), [points]);
  const tierChangeIdxSet = useMemo(
    () => new Set(tierChanges.map((tc) => tc.idx)),
    [tierChanges]
  );

  // Tier bands give the Y axis meaning that raw normalized LP can't. We only
  // render them when more than one tier is visible — a single full-chart band
  // adds noise without context (e.g. Master+ accounts whose LP stays above
  // 2800 see no bands, which is correct: there's no "next tier" to anchor to).
  const visibleTierBands = useMemo(() => {
    const pool = visiblePoints.length > 0 ? visiblePoints : points;
    if (pool.length === 0) return [];
    let yMin = pool[0]?.totalLp ?? 0;
    let yMax = yMin;
    for (const p of pool) {
      if (p.totalLp < yMin) yMin = p.totalLp;
      if (p.totalLp > yMax) yMax = p.totalLp;
    }
    const bands = TIER_BANDS.filter((b) => b.fromLp < yMax && b.toLp > yMin);
    return bands.length >= 2 ? bands : [];
  }, [visiblePoints, points]);

  // Patch boundaries are derived from ranked matches in the chart's queue
  // (timestamps line up with rank-snapshot timestamps closely enough). Out-of-
  // range boundaries are clipped via `ifOverflow="hidden"` on the ReferenceLine.
  const { matches: allMatches } = useMatchWindow();
  const patchBoundaries = useMemo(() => {
    if (!allMatches || points.length === 0) return [];
    const queueType = QUEUE_TYPE_FOR_BOUNDARIES[activeQueue];
    const chrono = excludeRemakes(allMatches)
      .filter((m) => m.queueType === queueType && m.gameVersion)
      .slice()
      .sort((a, b) => a.playedAt.localeCompare(b.playedAt));
    return findPatchBoundaries(
      chrono,
      (m) => m.gameVersion,
      (m) => new Date(m.playedAt).getTime()
    );
  }, [allMatches, activeQueue, points.length]);

  // Season detection runs on raw snapshots — `detectSeasons` keys off the
  // ≥7-day gap + ≥400 LP drop signature, which aggregation can't fuse across
  // (a week-long break always lands the bracketing snapshots in distinct
  // daily buckets). We then map each season's wall-clock window onto the
  // collapsed visual axis so the bands align with the line. Only render bands
  // when there's more than one season — a full-chart band carries no signal.
  const seasonBands = useMemo(() => {
    const raw = history.data?.[activeQueue] ?? [];
    if (raw.length === 0 || points.length === 0) return [];
    const seasons = detectSeasons(raw);
    if (seasons.length < 2) return [];
    return seasons.map((s, i) => ({
      key: `season-${s.startAt}`,
      index: i,
      x1: mapRealToVisual(new Date(s.startAt).getTime(), points),
      x2: mapRealToVisual(new Date(s.endAt).getTime(), points),
    }));
  }, [history.data, activeQueue, points]);

  const isEmpty = !history.isLoading && points.length === 0;
  const stroke = QUEUE_COLOR[activeQueue];
  const gradientId = `lp-area-${activeQueue}`;
  // Defer the static rank-band labels and tier-change markers so they fade
  // in alongside each Line re-animation instead of snapping to the new
  // position. CSS keyframes alone aren't enough — Recharts reuses its
  // label/marker elements when props change, and keyframes only fire on
  // mount. So we unmount + remount via labelsVisible going false→true on
  // each view change, which re-fires the keyframe.
  //
  // Initial mount stays visible (labelsVisible=true) and relies on the CSS
  // keyframe alone for its first fade-in. Forcing a delayed initial mount
  // here would require waiting for useReducedMotion to resolve, which is
  // async — and tests that read captures synchronously would see nothing.
  const [labelsVisible, setLabelsVisible] = useState(true);
  const isFirstMount = useRef(true);
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional re-defer on view change
  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }
    if (reduced) {
      setLabelsVisible(true);
      return;
    }
    setLabelsVisible(false);
    const t = setTimeout(() => setLabelsVisible(true), 1700);
    return () => clearTimeout(t);
  }, [range, activeQueue, reduced]);

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
    // Top padding is sized so a tier-change marker + label near the visible
    // max won't clip — both markers render ~22 px above their data point.
    const topPad = Math.max(35, Math.round((max - min) * 0.12));
    const botPad = Math.max(20, Math.round((max - min) * 0.08));
    return [Math.max(0, min - botPad), max + topPad];
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
          <SectionTitle>LP History</SectionTitle>
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
                  className={cn(TOOLTIP_CONTENT_COMPACT, "max-w-xs")}
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
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
              <XAxis
                dataKey="t"
                type="number"
                scale="time"
                domain={xDomain}
                ticks={dateTicks}
                allowDataOverflow
                tickFormatter={tickFormatter}
                tick={{ fill: CHART_AXIS, fontSize: 12 }}
                minTickGap={48}
              />
              <YAxis
                domain={yDomain}
                tick={{ fill: CHART_AXIS, fontSize: 12 }}
                width={40}
                allowDecimals={false}
              />
              <Tooltip
                content={<LpTooltip />}
                cursor={{ stroke: CHART_CURSOR, strokeWidth: 1 }}
              />
              {visibleTierBands.map((band, i) => {
                // State-gating controls when the text element mounts (and the
                // fade-in keyframe fires); the className on the label is
                // forwarded by Recharts to the underlying <text>, where the
                // animation lands. Conditionally spreading the `label` prop
                // avoids passing `undefined`, which `exactOptionalPropertyTypes`
                // rejects.
                const labelProps = labelsVisible
                  ? {
                      label: {
                        value: band.name,
                        position: "insideTopLeft" as const,
                        fill: "var(--muted-foreground)",
                        fontSize: 10,
                        offset: 6,
                        className: "lp-tier-band-label",
                      },
                    }
                  : {};
                return (
                  <ReferenceArea
                    key={`tier-band-${band.name}`}
                    y1={band.fromLp}
                    y2={band.toLp}
                    fill="var(--foreground)"
                    fillOpacity={i % 2 === 0 ? 0.035 : 0.012}
                    stroke="none"
                    ifOverflow="hidden"
                    className="lp-tier-band"
                    {...labelProps}
                  />
                );
              })}
              {seasonBands.map((b) => (
                <ReferenceArea
                  key={b.key}
                  x1={b.x1}
                  x2={b.x2}
                  fill="var(--foreground)"
                  fillOpacity={b.index % 2 === 0 ? 0.04 : 0.015}
                  stroke="none"
                  ifOverflow="hidden"
                  className="lp-season-band"
                />
              ))}
              {streak &&
                (() => {
                  const pt1 = visiblePoints[streak.startIdx];
                  const pt2 = visiblePoints[streak.endIdx];
                  if (!pt1 || !pt2) return null;
                  return (
                    <ReferenceArea
                      x1={pt1.t}
                      x2={pt2.t}
                      fill={streak.type === "win" ? CHART_POSITIVE : CHART_NEGATIVE}
                      fillOpacity={0.08}
                      stroke="none"
                      ifOverflow="hidden"
                    />
                  );
                })()}
              {patchBoundaries.map((b) => (
                <ReferenceLine
                  key={`patch-${b.fromPatch}-${b.toPatch}`}
                  x={mapRealToVisual(b.ts, points)}
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
                dot={(props: { cx?: number; cy?: number; index?: number }) => {
                  const { cx, cy, index } = props;
                  if (cx === undefined || cy === undefined) return <g />;
                  // Suppress the line's circle at tier-change indices so the
                  // ReferenceDot triangle isn't painted on top of by a circle
                  // (Recharts renders all reference elements before the Line).
                  if (typeof index === "number" && tierChangeIdxSet.has(index)) {
                    return <g key={`gap-${index}`} />;
                  }
                  return (
                    <circle
                      key={`dot-${index ?? `${cx}-${cy}`}`}
                      cx={cx}
                      cy={cy}
                      r={2.5}
                      fill={stroke}
                      stroke={stroke}
                    />
                  );
                }}
                activeDot={{ r: 5, fill: stroke, stroke }}
                fill={`url(#${gradientId})`}
                animationDuration={reduced ? 0 : 1400}
                animationBegin={reduced ? 0 : 200}
                animationEasing="ease-out"
                isAnimationActive={!reduced}
              />
              {labelsVisible &&
                tierChanges.map((tc) => {
                  const p = points[tc.idx];
                  if (!p) return null;
                  const color = tc.direction === "up" ? CHART_POSITIVE : CHART_NEGATIVE;
                  return (
                    <ReferenceDot
                      key={`tier-${tc.idx}`}
                      x={p.t}
                      y={p.totalLp}
                      ifOverflow="hidden"
                      className="lp-tier-marker"
                      shape={(props: { cx?: number; cy?: number }) => {
                        const { cx, cy } = props;
                        if (cx === undefined || cy === undefined) return <g />;
                        const s = 6;
                        const points =
                          tc.direction === "up"
                            ? `${cx},${cy - s} ${cx - s * 0.85},${cy + s * 0.7} ${cx + s * 0.85},${cy + s * 0.7}`
                            : `${cx},${cy + s} ${cx - s * 0.85},${cy - s * 0.7} ${cx + s * 0.85},${cy - s * 0.7}`;
                        return (
                          <polygon
                            points={points}
                            fill={color}
                            stroke="var(--background)"
                            strokeWidth={1.5}
                            data-testid="tier-change-marker"
                            data-direction={tc.direction}
                          />
                        );
                      }}
                      label={{
                        value: tc.label,
                        // Both labels render above the marker — placing the
                        // demotion label below the triangle pushed it into the
                        // X-axis tick labels at the chart floor.
                        position: "top",
                        fill: color,
                        fontSize: 10,
                        offset: 14,
                      }}
                    />
                  );
                })}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
      {!isEmpty && points.length >= 4 && (
        <div className="flex flex-col gap-1 rounded-md border border-border/60 bg-card/60 px-2 py-1.5 backdrop-blur-sm">
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
