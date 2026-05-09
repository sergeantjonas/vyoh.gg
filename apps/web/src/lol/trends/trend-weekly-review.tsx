import { computeHabitsStats } from "@/lol/profile/use-habits-stats";
import type { HabitsStats } from "@/lol/profile/use-habits-stats";
import { ConclusionCard } from "@/lol/trends/_shared/conclusion-card";
import type { MatchSummary } from "@vyoh/shared";
import { useMemo } from "react";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function pickInsights(stats: HabitsStats): string[] {
  const insights: Array<{ score: number; text: string }> = [];

  // Tilt
  const { afterWin, afterLoss } = stats.tilt;
  if (afterWin.games >= 5 && afterLoss.games >= 5) {
    const wrWin = afterWin.wins / afterWin.games;
    const wrLoss = afterLoss.wins / afterLoss.games;
    const diff = Math.abs(wrWin - wrLoss);
    if (diff >= 0.08) {
      const pW = Math.round(wrWin * 100);
      const pL = Math.round(wrLoss * 100);
      insights.push({
        score: diff,
        text:
          wrWin > wrLoss
            ? `${pW}% WR after a win vs ${pL}% after a loss — momentum carries.`
            : `${pW}% WR after a win vs ${pL}% after a loss — fresh sessions seem to help.`,
      });
    }
  }

  // Game length
  const bucketsWithData = stats.gameLength.filter((b) => b.games >= 3);
  if (bucketsWithData.length >= 2) {
    const sorted = [...bucketsWithData].sort(
      (a, b) => b.wins / b.games - a.wins / a.games
    );
    const best = sorted[0];
    const worst = sorted.at(-1);
    if (best && worst) {
      const spread = best.wins / best.games - worst.wins / worst.games;
      if (spread >= 0.12) {
        const pBest = Math.round((best.wins / best.games) * 100);
        insights.push({
          score: spread,
          text: `${best.label} is your strongest — ${pBest}% WR over ${best.games} games.`,
        });
      }
    }
  }

  // Best hour slot
  const hotspotsWithData = stats.hourDay.filter((s) => s.games >= 3);
  const bestHotspot = [...hotspotsWithData].sort(
    (a, b) => b.wins / b.games - a.wins / a.games
  )[0];
  if (bestHotspot) {
    const slotWR = bestHotspot.wins / bestHotspot.games;
    const margin = slotWR - stats.overallWinRate;
    if (margin >= 0.15) {
      const pct = Math.round(slotWR * 100);
      insights.push({
        score: margin,
        text: `${DAY_LABELS[bestHotspot.day]} around ${bestHotspot.hour}:00 is a strong slot — ${pct}% WR over ${bestHotspot.games} games.`,
      });
    }
  }

  return insights
    .sort((a, b) => b.score - a.score)
    .slice(0, 2)
    .map((i) => i.text);
}

export function TrendWeeklyReview({ current }: { current: MatchSummary[] }) {
  const playedCount = useMemo(() => current.filter((m) => !m.remake).length, [current]);
  const insights = useMemo(() => {
    if (playedCount < 10) return [];
    return pickInsights(computeHabitsStats(current.filter((m) => !m.remake)));
  }, [current, playedCount]);

  if (insights.length === 0) {
    return (
      <ConclusionCard
        title="Briefing"
        sampleSize={playedCount}
        verdict="Not enough data yet to generate your briefing."
        empty
      />
    );
  }

  const sampleSize = playedCount;
  const [first, second] = insights;

  return (
    <ConclusionCard
      title="Briefing"
      sampleSize={sampleSize}
      verdict={first ?? ""}
      verdictMarkdown={first ?? ""}
      evidence={
        second !== undefined ? (
          <p className="text-sm text-foreground/70">{second}</p>
        ) : undefined
      }
    />
  );
}
