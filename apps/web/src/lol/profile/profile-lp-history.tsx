import { cn } from "@/lib/utils";
import { useAccountFromSlug } from "@/lol/_shared/use-account-from-slug";
import { type RangeKey, useRankHistory } from "@/lol/profile/use-rank-history";
import type { RankHistoryPoint } from "@vyoh/shared";
import { formatRank, normalizeLp } from "@vyoh/shared/lol/rank-history";
import { AnimatePresence, m, useReducedMotion } from "motion/react";
import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceDot,
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

export function ProfileLpHistory({ accountSlug }: { accountSlug: string }) {
  const account = useAccountFromSlug(accountSlug);
  const [range, setRange] = useState<RangeKey>("90d");
  const [queue, setQueue] = useState<QueueKey>("solo");
  const reduced = useReducedMotion();

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

  const streak = useMemo(() => findLongestStreak(points), [points]);
  const tierChangeIdxs = useMemo(() => findTierChanges(points), [points]);

  const isEmpty = !history.isLoading && points.length === 0;
  const stroke = QUEUE_COLOR[activeQueue];
  const gradientId = `lp-area-${activeQueue}`;

  // Tier-change dots are rendered as ReferenceDots; we need yMin/yMax for
  // the streak ReferenceArea so the shaded band spans the full chart.
  const yDomain = useMemo<[number | "auto", number | "auto"]>(() => {
    if (points.length === 0) return ["auto", "auto"];
    let min = points[0]?.totalLp ?? 0;
    let max = min;
    for (const p of points) {
      if (p.totalLp < min) min = p.totalLp;
      if (p.totalLp > max) max = p.totalLp;
    }
    const padding = Math.max(20, Math.round((max - min) * 0.1));
    return [Math.max(0, min - padding), max + padding];
  }, [points]);

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
            <span
              className={cn(
                "rounded-full border px-2 py-0.5 text-[10px] font-medium",
                streak.type === "win"
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                  : "border-rose-500/40 bg-rose-500/10 text-rose-400"
              )}
              title={`Longest ${streak.type} run in this range`}
            >
              {streak.length}
              {streak.type === "win" ? "W" : "L"} run
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <QueueTabs value={activeQueue} onChange={setQueue} available={available} />
          <RangeTabs value={range} onChange={setRange} />
        </div>
      </div>

      {isEmpty ? (
        <m.div
          className="flex h-48 items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground"
          initial={reduced ? {} : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          {history.isError
            ? "Couldn't load rank history."
            : "No rank snapshots yet — play a ranked match to start the timeline."}
        </m.div>
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
                domain={["dataMin", "dataMax"]}
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
              {streak && points[streak.startIdx] && points[streak.endIdx] && (
                <ReferenceArea
                  x1={points[streak.startIdx]?.t}
                  x2={points[streak.endIdx]?.t}
                  fill={streak.type === "win" ? "#34d399" : "#f87171"}
                  fillOpacity={0.08}
                  stroke="none"
                  ifOverflow="extendDomain"
                />
              )}
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
                const p = points[idx];
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
                    ifOverflow="extendDomain"
                  />
                );
              })}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </m.section>
  );
}
