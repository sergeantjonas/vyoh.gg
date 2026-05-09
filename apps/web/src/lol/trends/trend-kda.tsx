import { ConclusionCard } from "@/lol/trends/_shared/conclusion-card";
import { computeKdaSeries, computeTrendSummary } from "@/lol/trends/trend-stats";
import type { KdaPoint } from "@/lol/trends/trend-stats";
import type { MatchSummary } from "@vyoh/shared";
import { AnimatePresence, m, useReducedMotion } from "motion/react";
import { useMemo } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type KdaPointWithTrend = KdaPoint & { trendKda: number };

function addTrendLine(points: KdaPoint[]): KdaPointWithTrend[] {
  if (points.length < 2) return points.map((p) => ({ ...p, trendKda: p.kda }));
  const n = points.length;
  const sumX = points.reduce((s, p) => s + p.game, 0);
  const sumY = points.reduce((s, p) => s + p.kda, 0);
  const sumXY = points.reduce((s, p) => s + p.game * p.kda, 0);
  const sumX2 = points.reduce((s, p) => s + p.game * p.game, 0);
  const denom = n * sumX2 - sumX * sumX;
  if (denom === 0) return points.map((p) => ({ ...p, trendKda: p.kda }));
  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  return points.map((p) => ({ ...p, trendKda: slope * p.game + intercept }));
}

function KdaTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string | number;
}) {
  const reduced = useReducedMotion();
  return (
    <AnimatePresence>
      {active && payload?.length ? (
        <m.div
          initial={reduced ? {} : { opacity: 0, y: 4, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={reduced ? {} : { opacity: 0, scale: 0.96 }}
          transition={{ type: "spring", stiffness: 400, damping: 28 }}
          className="rounded-md border bg-popover/85 px-3 py-2 text-sm text-popover-foreground shadow-xl backdrop-blur-md"
        >
          <div className="mb-0.5 text-xs text-muted-foreground">Game {label}</div>
          <div className="font-semibold">{Number(payload[0]?.value).toFixed(2)} KDA</div>
        </m.div>
      ) : null}
    </AnimatePresence>
  );
}

function KdaChart({ points }: { points: KdaPointWithTrend[] }) {
  const reduced = useReducedMotion();
  return (
    <div className="h-44 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis
            dataKey="game"
            tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
          />
          <YAxis
            tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            width={30}
            domain={["auto", "auto"]}
          />
          <Tooltip
            content={<KdaTooltip />}
            cursor={{ stroke: "var(--border)", strokeWidth: 1 }}
          />
          <Line
            type="monotone"
            dataKey="kda"
            stroke="#34d399"
            strokeWidth={2}
            dot={{ r: 2.5, fill: "#34d399", stroke: "#34d399" }}
            activeDot={{ r: 4, fill: "#34d399", stroke: "#34d399" }}
            animationDuration={reduced ? 0 : 1200}
            animationBegin={reduced ? 0 : 200}
            animationEasing="ease-out"
          />
          <Line
            type="monotone"
            dataKey="trendKda"
            stroke="#a78bfa"
            strokeWidth={1.5}
            strokeDasharray="5 3"
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function TrendKda({
  current,
  previous,
}: {
  current: MatchSummary[];
  previous: MatchSummary[];
}) {
  const points = useMemo(() => computeKdaSeries(current), [current]);
  const pointsWithTrend = useMemo(() => addTrendLine(points), [points]);
  const currentSummary = useMemo(() => computeTrendSummary(current), [current]);
  const prevSummary = useMemo(
    () => (previous.length > 0 ? computeTrendSummary(previous) : null),
    [previous]
  );

  if (points.length === 0) return null;

  const sampleSize = currentSummary.games;

  let verdict: string;
  if (prevSummary && prevSummary.games > 0) {
    const delta = currentSummary.avgKda - prevSummary.avgKda;
    const abs = Math.abs(delta).toFixed(2);
    verdict =
      delta >= 0
        ? `KDA up ${abs} vs prior window — improving.`
        : `KDA down ${abs} vs prior window.`;
  } else {
    verdict = `Avg KDA: ${currentSummary.avgKda.toFixed(2)} over ${sampleSize} game${sampleSize !== 1 ? "s" : ""}.`;
  }

  return (
    <ConclusionCard
      title="KDA trend"
      sampleSize={sampleSize}
      verdict={verdict}
      verdictMarkdown={verdict}
      evidence={<KdaChart points={pointsWithTrend} />}
    />
  );
}
