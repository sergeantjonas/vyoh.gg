// Baseline: personal — your WR after a win vs your WR after a loss.
import { computeHabitsStats } from "@/lol/profile/use-habits-stats";
import { ConclusionCard } from "@/lol/trends/_shared/conclusion-card";
import type { MatchSummary } from "@vyoh/shared";
import { useMemo } from "react";

const MIN_SAMPLE = 5;

function SplitBar({
  afterWinWR,
  afterLossWR,
  afterWinGames,
  afterLossGames,
}: {
  afterWinWR: number;
  afterLossWR: number;
  afterWinGames: number;
  afterLossGames: number;
}) {
  const pWin = Math.round(afterWinWR * 100);
  const pLoss = Math.round(afterLossWR * 100);
  return (
    <div className="flex flex-col gap-2 text-xs">
      <div className="flex items-center gap-2">
        <span className="w-20 shrink-0 text-muted-foreground">After a win</span>
        <div className="flex flex-1 items-center gap-2">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted/30">
            <div
              className="h-full rounded-full bg-emerald-500/70 transition-[width] duration-500"
              style={{ width: `${pWin}%` }}
            />
          </div>
          <span className="w-8 tabular-nums text-right text-muted-foreground">
            {pWin}%
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="w-20 shrink-0 text-muted-foreground">After a loss</span>
        <div className="flex flex-1 items-center gap-2">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted/30">
            <div
              className="h-full rounded-full bg-rose-500/70 transition-[width] duration-500"
              style={{ width: `${pLoss}%` }}
            />
          </div>
          <span className="w-8 tabular-nums text-right text-muted-foreground">
            {pLoss}%
          </span>
        </div>
      </div>
      <div className="flex gap-4 text-[10px] text-muted-foreground/60">
        <span>{afterWinGames} games</span>
        <span>{afterLossGames} games</span>
      </div>
    </div>
  );
}

export function TrendTiltIndicator({
  current,
  previous: _previous,
}: {
  current: MatchSummary[];
  previous: MatchSummary[];
}) {
  const playedCount = useMemo(() => current.filter((m) => !m.remake).length, [current]);
  const stats = useMemo(() => {
    if (current.length < 5) return null;
    return computeHabitsStats(current);
  }, [current]);

  if (!stats) {
    return (
      <ConclusionCard
        title="After last game"
        sampleSize={playedCount}
        verdict="Not enough games yet to detect tilt patterns."
        empty
      />
    );
  }

  const { afterWin, afterLoss } = stats.tilt;
  if (afterWin.games < MIN_SAMPLE || afterLoss.games < MIN_SAMPLE) {
    return (
      <ConclusionCard
        title="After last game"
        sampleSize={playedCount}
        verdict="Need 5+ games after a win and after a loss to detect tilt patterns."
        empty
      />
    );
  }

  const wrWin = afterWin.wins / afterWin.games;
  const wrLoss = afterLoss.wins / afterLoss.games;
  const diffPp = Math.round((wrWin - wrLoss) * 100);
  const sampleSize = afterWin.games + afterLoss.games;

  const verdict =
    Math.abs(diffPp) < 1
      ? "Win rate is stable regardless of your last result."
      : diffPp > 0
        ? `Win rate drops ${diffPp}% after a loss.`
        : `Win rate drops ${Math.abs(diffPp)}% after a win — fresh sessions help.`;

  const prescription = diffPp >= 8 ? "Consider stepping away after a loss." : undefined;

  return (
    <ConclusionCard
      title="After last game"
      sampleSize={sampleSize}
      verdict={verdict}
      verdictMarkdown={verdict}
      prescription={prescription}
      prescriptionMarkdown={prescription}
      evidence={
        <SplitBar
          afterWinWR={wrWin}
          afterLossWR={wrLoss}
          afterWinGames={afterWin.games}
          afterLossGames={afterLoss.games}
        />
      }
    />
  );
}
