import { computeLpDeltaMap } from "@/lol/matches/use-lp-delta";
import { ConclusionCard } from "@/lol/trends/_shared/conclusion-card";
import type { MatchSummary } from "@vyoh/shared";
import { useMemo } from "react";

const MIN_SAMPLE = 4; // min wins+losses with computable LP delta

function LpBars({
  avgGain,
  avgLoss,
  winCount,
  lossCount,
}: {
  avgGain: number;
  avgLoss: number;
  winCount: number;
  lossCount: number;
}) {
  const max = Math.max(avgGain, Math.abs(avgLoss), 1);
  return (
    <div className="flex flex-col gap-2 text-xs">
      <div className="flex items-center gap-2">
        <span className="w-16 shrink-0 text-muted-foreground">Avg gain</span>
        <div className="flex flex-1 items-center gap-2">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted/30">
            <div
              className="h-full rounded-full bg-emerald-500/70 transition-[width] duration-500"
              style={{ width: `${(avgGain / max) * 100}%` }}
            />
          </div>
          <span className="w-10 tabular-nums text-right text-muted-foreground">
            +{Math.round(avgGain)}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="w-16 shrink-0 text-muted-foreground">Avg loss</span>
        <div className="flex flex-1 items-center gap-2">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted/30">
            <div
              className="h-full rounded-full bg-rose-500/70 transition-[width] duration-500"
              style={{ width: `${(Math.abs(avgLoss) / max) * 100}%` }}
            />
          </div>
          <span className="w-10 tabular-nums text-right text-muted-foreground">
            {Math.round(avgLoss)}
          </span>
        </div>
      </div>
      <div className="flex gap-4 text-[10px] text-muted-foreground/60">
        <span>{winCount} wins</span>
        <span>{lossCount} losses</span>
      </div>
    </div>
  );
}

export function TrendLpEconomy({
  current,
  previous: _previous,
}: {
  current: MatchSummary[];
  previous: MatchSummary[];
}) {
  const rankedCount = useMemo(
    () => current.filter((m) => !m.remake && m.snapshotTier !== undefined).length,
    [current]
  );

  const stats = useMemo(() => {
    const ranked = current.filter((m) => !m.remake && m.snapshotTier !== undefined);
    if (ranked.length < MIN_SAMPLE) return null;

    const deltaMap = computeLpDeltaMap(ranked);
    const gains: number[] = [];
    const losses: number[] = [];

    for (const m of ranked) {
      const delta = deltaMap.get(m.matchId);
      if (delta === undefined) continue;
      // Correlate with outcome to avoid promotion/demotion noise
      if (m.win && delta > 0) gains.push(delta);
      else if (!m.win && delta < 0) losses.push(delta);
    }

    if (gains.length < 2 || losses.length < 2) return null;

    const avgGain = gains.reduce((s, v) => s + v, 0) / gains.length;
    const avgLoss = losses.reduce((s, v) => s + v, 0) / losses.length;
    return { avgGain, avgLoss, winCount: gains.length, lossCount: losses.length };
  }, [current]);

  if (!stats) {
    return (
      <ConclusionCard
        title="LP economy"
        sampleSize={rankedCount}
        verdict="Not enough ranked games with LP data yet."
        empty
      />
    );
  }

  const { avgGain, avgLoss, winCount, lossCount } = stats;
  const sampleSize = winCount + lossCount;
  const net = avgGain + avgLoss; // avgLoss is negative

  const verdict =
    net > 0
      ? `+${Math.round(avgGain)} / ${Math.round(avgLoss)} LP — wins are bigger than losses, you're climbing efficiently.`
      : `+${Math.round(avgGain)} / ${Math.round(avgLoss)} LP — losses cost more than wins earn.`;

  const prescription =
    net <= 0
      ? "Your MMR may be below your rank — expect harder games until it equalises."
      : undefined;

  return (
    <ConclusionCard
      title="LP economy"
      sampleSize={sampleSize}
      verdict={verdict}
      verdictMarkdown={verdict}
      prescription={prescription}
      prescriptionMarkdown={prescription}
      evidence={
        <LpBars
          avgGain={avgGain}
          avgLoss={avgLoss}
          winCount={winCount}
          lossCount={lossCount}
        />
      }
    />
  );
}
