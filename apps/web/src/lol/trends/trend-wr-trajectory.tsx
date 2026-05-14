// Baseline: personal — rolling WR within the current window compared to your prior window's mean.
import { ConclusionCard } from "@/lol/trends/_shared/conclusion-card";
import type { MatchSummary } from "@vyoh/shared";
import { useMemo } from "react";

const MIN_CURRENT = 20;
const WINDOW = 5;
const SVG_W = 200;
const SVG_H = 48;

function rollingWr(matches: MatchSummary[], window: number): number[] {
  const points: number[] = [];
  for (let i = window - 1; i < matches.length; i++) {
    const slice = matches.slice(i - window + 1, i + 1);
    points.push(slice.filter((m) => m.win).length / window);
  }
  return points;
}

function WrSparkline({
  points,
  previousMean,
}: {
  points: number[];
  previousMean: number | null;
}) {
  if (points.length < 2) return null;
  const n = points.length;
  const xs = points.map((_, i) => (i / (n - 1)) * SVG_W);
  const ys = points.map((p) => SVG_H - p * SVG_H);
  const polyline = xs.map((x, i) => `${x},${ys[i]}`).join(" ");
  const refY = previousMean !== null ? SVG_H - previousMean * SVG_H : null;

  return (
    <svg
      viewBox={`0 0 ${SVG_W} ${SVG_H}`}
      className="w-full"
      preserveAspectRatio="none"
      style={{ height: 48 }}
      role="img"
      aria-label="Rolling win rate over time"
    >
      {/* 50% baseline */}
      <line
        x1={0}
        y1={SVG_H / 2}
        x2={SVG_W}
        y2={SVG_H / 2}
        stroke="currentColor"
        strokeWidth={0.5}
        className="text-muted-foreground/20"
      />
      {/* Previous-window mean */}
      {refY !== null && (
        <line
          x1={0}
          y1={refY}
          x2={SVG_W}
          y2={refY}
          stroke="currentColor"
          strokeWidth={1}
          strokeDasharray="4 3"
          className="text-muted-foreground/40"
        />
      )}
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
        points={polyline}
        className="text-violet-400/80"
      />
    </svg>
  );
}

export function TrendWrTrajectory({
  current,
  previous,
}: {
  current: MatchSummary[];
  previous: MatchSummary[];
}) {
  const playedCount = useMemo(() => current.filter((m) => !m.remake).length, [current]);
  const stats = useMemo(() => {
    const played = current.filter((m) => !m.remake);
    if (played.length < MIN_CURRENT) return null;

    // Matches are newest-first; reverse to chronological for rolling window
    const chrono = [...played].reverse();
    const points = rollingWr(chrono, WINDOW);

    const currentWr = played.filter((m) => m.win).length / played.length;

    const prevPlayed = previous.filter((m) => !m.remake);
    const previousMean =
      prevPlayed.length > 0
        ? prevPlayed.filter((m) => m.win).length / prevPlayed.length
        : null;

    const deltaPp =
      previousMean !== null ? Math.round((currentWr - previousMean) * 100) : null;

    return { points, currentWr, previousMean, deltaPp, sampleSize: played.length };
  }, [current, previous]);

  if (!stats) {
    return (
      <ConclusionCard
        title="Win-rate trajectory"
        sampleSize={playedCount}
        verdict="Need 20+ games to plot win-rate trajectory."
        empty
      />
    );
  }

  const { points, previousMean, deltaPp, sampleSize } = stats;
  const currentPct = Math.round(stats.currentWr * 100);

  let verdict: string;
  if (deltaPp === null) {
    verdict = `${currentPct}% win rate over ${sampleSize} games.`;
  } else if (deltaPp === 0) {
    verdict = `WR steady vs prior window — ${currentPct}% overall.`;
  } else if (deltaPp > 0) {
    verdict = `WR up ${deltaPp}% vs prior window — ${currentPct}% overall.`;
  } else {
    verdict = `WR down ${Math.abs(deltaPp)}% vs prior window — what changed?`;
  }

  const prescription =
    deltaPp !== null && deltaPp <= -8
      ? "Take a break or change up your champion pool."
      : undefined;

  return (
    <ConclusionCard
      title="Win-rate trajectory"
      sampleSize={sampleSize}
      verdict={verdict}
      verdictMarkdown={verdict}
      prescription={prescription}
      prescriptionMarkdown={prescription}
      evidence={<WrSparkline points={points} previousMean={previousMean} />}
    />
  );
}
