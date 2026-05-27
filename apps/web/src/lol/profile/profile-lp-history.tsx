// Baseline: personal — your LP snapshots; streak overlay derives from your match results.
import { EmptyLpHistoryIllustration, EmptyState } from "@/components/empty-state";
import { SectionTitle } from "@/components/ui/section-title";
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
import type { RankHistoryPoint } from "@vyoh/shared";
import { detectSeasons, formatRank, normalizeLp } from "@vyoh/shared/lol/rank-history";
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

// Snapshots are only written on LP change, so a wide wall-clock gap between
// two points means the player wasn't playing — at a linear time scale this
// dominates the X axis with empty space and Recharts smoothly interpolates
// across it. Instead of breaking the line, we keep the line continuous and
// collapse oversized gaps to this cap. Within-session game-to-game spacing
// (~25-30 min) stays untouched; an overnight gap becomes a single visible
// step roughly 2x a normal between-game width.
const MAX_VISUAL_GAP_MS = 60 * 60 * 1000;

// Gap threshold separating two play sessions: anything longer than this
// between consecutive snapshots starts a new session bucket. Picked at 60min
// to forgive between-queue breaks (champ select + post-game) without leaking
// across meal/sleep breaks.
const SESSION_GAP_MS = 60 * 60 * 1000;

// Per-bucket aggregation density: trades intra-day detail for legibility.
// 30d view shows enough horizontal room per day for session-level nodes;
// 90d/season collapse to one node per Brussels day or the chart becomes
// a fuzzy dot caterpillar for active accounts (Agurin: 15+ games/day).
type Resolution = "per-game" | "session" | "day";

const RESOLUTION_FOR_RANGE: Record<RangeKey, Resolution> = {
  "30d": "session",
  "90d": "day",
  season: "day",
};

const DAY_KEY_FMT = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Brussels",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

// Normalized-LP boundaries for each tier (matches `normalizeLp` in shared).
// Master+ has no upper bound; we pin a large sentinel and rely on the chart's
// own Y domain to clip via `ifOverflow="hidden"`.
const TIER_BANDS: ReadonlyArray<{ name: string; fromLp: number; toLp: number }> = [
  { name: "Iron", fromLp: 0, toLp: 400 },
  { name: "Bronze", fromLp: 400, toLp: 800 },
  { name: "Silver", fromLp: 800, toLp: 1200 },
  { name: "Gold", fromLp: 1200, toLp: 1600 },
  { name: "Platinum", fromLp: 1600, toLp: 2000 },
  { name: "Emerald", fromLp: 2000, toLp: 2400 },
  { name: "Diamond", fromLp: 2400, toLp: 2800 },
  { name: "Master+", fromLp: 2800, toLp: 99_999 },
];

const TIER_SHORT: Record<string, string> = {
  IRON: "Iron",
  BRONZE: "Bronze",
  SILVER: "Silver",
  GOLD: "Gold",
  PLATINUM: "Plat",
  EMERALD: "Emerald",
  DIAMOND: "Diamond",
  MASTER: "Master",
  GRANDMASTER: "GM",
  CHALLENGER: "Chall",
};

const APEX_TIERS = new Set(["MASTER", "GRANDMASTER", "CHALLENGER"]);

function formatTierShort(tier: string, rank: string): string {
  const t = tier.toUpperCase();
  const display = TIER_SHORT[t] ?? tier;
  return APEX_TIERS.has(t) ? display : `${display} ${rank}`;
}

interface BucketMeta {
  kind: "session" | "day";
  gameCount: number;
  openLp: number;
  closeLp: number;
  lowLp: number;
  highLp: number;
  netLp: number;
  winCount: number;
  lossCount: number;
  startRealT: number;
  endRealT: number;
}

interface ChartPoint extends RankHistoryPoint {
  // Visual X position with oversized gaps collapsed. Use this for plotting
  // and for any overlay that needs to align with the data line.
  t: number;
  // Original wall-clock timestamp. Use this for tooltip labels and any
  // mapping from real time (e.g. patch boundaries) back onto the chart.
  realT: number;
  totalLp: number;
  // Set when the point represents more than one underlying snapshot
  // (session/day bucket). Undefined for per-game resolution.
  bucket?: BucketMeta;
}

interface RawPoint extends RankHistoryPoint {
  totalLp: number;
  realT: number;
}

function withDerivedFields(p: RankHistoryPoint): RawPoint {
  return {
    ...p,
    totalLp: normalizeLp(p.tier, p.rank, p.leaguePoints),
    realT: new Date(p.capturedAt).getTime(),
  };
}

function aggregateBuckets(
  raw: RawPoint[],
  resolution: Resolution
): Array<RawPoint & { bucket?: BucketMeta }> {
  if (resolution === "per-game" || raw.length === 0) {
    return raw.map((p) => ({ ...p }));
  }

  const sameBucket = (prev: RawPoint, curr: RawPoint): boolean =>
    resolution === "session"
      ? curr.realT - prev.realT <= SESSION_GAP_MS
      : DAY_KEY_FMT.format(curr.realT) === DAY_KEY_FMT.format(prev.realT);

  const out: Array<RawPoint & { bucket?: BucketMeta }> = [];
  // Carry the closing LP of the *previous bucket* so within-bucket W/L can
  // be tallied relative to "before this bucket started", not just within it.
  let prevBucketClose: number | null = null;

  let i = 0;
  while (i < raw.length) {
    const first = raw[i];
    if (!first) {
      i++;
      continue;
    }
    let j = i + 1;
    while (j < raw.length) {
      const prev = raw[j - 1];
      const curr = raw[j];
      if (!prev || !curr || !sameBucket(prev, curr)) break;
      j++;
    }
    const bucketSlice = raw.slice(i, j);
    const last = bucketSlice[bucketSlice.length - 1] ?? first;

    let low = first.totalLp;
    let high = first.totalLp;
    let wins = 0;
    let losses = 0;
    let runningPrev = prevBucketClose;
    for (const snap of bucketSlice) {
      if (snap.totalLp < low) low = snap.totalLp;
      if (snap.totalLp > high) high = snap.totalLp;
      if (runningPrev !== null) {
        const delta = snap.totalLp - runningPrev;
        if (delta > 0) wins++;
        else if (delta < 0) losses++;
      }
      runningPrev = snap.totalLp;
    }
    const openLp = prevBucketClose ?? first.totalLp;
    const netLp = last.totalLp - openLp;

    if (bucketSlice.length === 1) {
      // A single-game bucket is structurally per-game; skip the metadata so
      // the chart treats it identically to per-game mode (no compound tooltip).
      out.push({ ...last });
    } else {
      out.push({
        ...last,
        bucket: {
          kind: resolution,
          gameCount: bucketSlice.length,
          openLp,
          closeLp: last.totalLp,
          lowLp: low,
          highLp: high,
          netLp,
          winCount: wins,
          lossCount: losses,
          startRealT: first.realT,
          endRealT: last.realT,
        },
      });
    }
    prevBucketClose = last.totalLp;
    i = j;
  }
  return out;
}

function toChartPoints(
  points: RankHistoryPoint[],
  resolution: Resolution = "per-game"
): ChartPoint[] {
  if (points.length === 0) return [];
  const aggregated = aggregateBuckets(points.map(withDerivedFields), resolution);
  const out: ChartPoint[] = [];
  let visualT = 0;
  let prevRealT = 0;
  for (let i = 0; i < aggregated.length; i++) {
    const p = aggregated[i];
    if (!p) continue;
    if (i === 0) {
      visualT = p.realT;
    } else {
      visualT += Math.min(p.realT - prevRealT, MAX_VISUAL_GAP_MS);
    }
    prevRealT = p.realT;
    out.push({
      ...p,
      t: visualT,
    });
  }
  return out;
}

// Map a real-time timestamp onto the collapsed visual axis by linearly
// interpolating between the two bracketing data points. Used for overlays
// (patch boundaries) whose source data lives in real wall-clock time but
// must render in chart coordinates.
function mapRealToVisual(realT: number, points: ChartPoint[]): number {
  if (points.length === 0) return realT;
  const first = points[0];
  if (first && realT <= first.realT) return first.t;
  for (let i = 1; i < points.length; i++) {
    const curr = points[i];
    const prev = points[i - 1];
    if (!curr || !prev) continue;
    if (curr.realT >= realT) {
      const span = curr.realT - prev.realT;
      const frac = span > 0 ? (realT - prev.realT) / span : 0;
      return prev.t + frac * (curr.t - prev.t);
    }
  }
  const last = points[points.length - 1];
  return last ? last.t : realT;
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

interface TierChange {
  idx: number;
  direction: "up" | "down";
  label: string;
}

function findTierChanges(points: ChartPoint[]): TierChange[] {
  const changes: TierChange[] = [];
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    if (!prev || !curr) continue;
    if (prev.tier !== curr.tier || prev.rank !== curr.rank) {
      changes.push({
        idx: i,
        direction: curr.totalLp >= prev.totalLp ? "up" : "down",
        label: formatTierShort(curr.tier, curr.rank),
      });
    }
  }
  return changes;
}

// One tick per calendar day, placed at the visual `t` of the first data point
// of that day. Recharts auto-generated ticks at "nice" clock boundaries in the
// compressed visual domain don't align with real calendar days, so we drive
// placement explicitly.
function makeDayTicks(points: ChartPoint[]): number[] {
  const seen = new Set<string>();
  const ticks: number[] = [];
  for (const p of points) {
    const key = new Date(p.realT).toLocaleDateString();
    if (!seen.has(key)) {
      seen.add(key);
      ticks.push(p.t);
    }
  }
  return ticks;
}

function makeTickFormatter(points: ChartPoint[]): (visualT: number) => string {
  const map = new Map(
    points.map((p) => [
      p.t,
      new Date(p.realT).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      }),
    ])
  );
  return (t) => map.get(t) ?? "";
}

function formatBucketHeader(bucket: BucketMeta): string {
  const start = new Date(bucket.startRealT);
  const end = new Date(bucket.endRealT);
  if (bucket.kind === "day") {
    return start.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  }
  const dateStr = start.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const timeFmt: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit" };
  return `${dateStr} · ${start.toLocaleTimeString(undefined, timeFmt)} – ${end.toLocaleTimeString(undefined, timeFmt)}`;
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
  const bucket = point?.bucket;
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
            {bucket
              ? formatBucketHeader(bucket)
              : new Date(point.realT).toLocaleString(undefined, {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
          </div>
          <div className="font-semibold">
            {formatRank(point.tier, point.rank, point.leaguePoints)}
          </div>
          {bucket ? (
            <div className="mt-1 flex flex-col gap-0.5 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <span>
                  {bucket.gameCount} {bucket.gameCount === 1 ? "game" : "games"}
                </span>
                {(bucket.winCount > 0 || bucket.lossCount > 0) && (
                  <span>
                    <span className="text-emerald-400">{bucket.winCount}W</span>
                    {" – "}
                    <span className="text-rose-400">{bucket.lossCount}L</span>
                  </span>
                )}
                <span
                  className={
                    bucket.netLp > 0
                      ? "text-emerald-400"
                      : bucket.netLp < 0
                        ? "text-rose-400"
                        : "text-muted-foreground"
                  }
                >
                  {bucket.netLp > 0 ? "+" : ""}
                  {bucket.netLp} LP
                </span>
              </div>
              {bucket.highLp !== bucket.lowLp && (
                <div>
                  Range {bucket.lowLp}–{bucket.highLp} LP
                </div>
              )}
            </div>
          ) : null}
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
                ticks={dateTicks}
                allowDataOverflow
                tickFormatter={tickFormatter}
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
              {visibleTierBands.map((band, i) => (
                <ReferenceArea
                  key={`tier-band-${band.name}`}
                  y1={band.fromLp}
                  y2={band.toLp}
                  fill="var(--foreground)"
                  fillOpacity={i % 2 === 0 ? 0.035 : 0.012}
                  stroke="none"
                  ifOverflow="hidden"
                  className="lp-tier-band"
                  label={{
                    value: band.name,
                    position: "insideTopLeft",
                    fill: "var(--muted-foreground)",
                    fontSize: 10,
                    offset: 6,
                  }}
                />
              ))}
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
                      fill={streak.type === "win" ? "#34d399" : "#f87171"}
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
              {tierChanges.map((tc) => {
                const p = points[tc.idx];
                if (!p) return null;
                const color = tc.direction === "up" ? "#34d399" : "#f87171";
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
                      position: tc.direction === "up" ? "top" : "bottom",
                      fill: color,
                      fontSize: 10,
                      offset: 8,
                    }}
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
