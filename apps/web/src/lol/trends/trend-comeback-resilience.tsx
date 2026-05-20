// Baseline: fixed-reference — your behind-5k WR vs a fixed POPULATION_BEHIND_WR (~30%).
import { ConclusionCard } from "@/lol/trends/_shared/conclusion-card";
import { type MatchSummary, excludeRemakes } from "@vyoh/shared";
import { useMemo } from "react";

// "Behind early" threshold: the user's team is down at least 5k gold by the
// 15-minute frame. That's a substantial deficit — equivalent to several
// kills + objective gold — and is the canonical "are you good at playing
// from behind?" definition in coaching content.
const BEHIND_THRESHOLD = -5000;
const MIN_BEHIND_SAMPLE = 5;

// Reference baseline: roughly the population-level WR for behind-early
// games. Climbing-from-behind is hard so the typical figure hovers
// around 25-30% — we anchor at 30% as the "you're average" line.
const POPULATION_BEHIND_WR = 0.3;

function ResilienceBars({
  behindWR,
  population,
}: {
  behindWR: number;
  population: number;
}) {
  const userPct = Math.round(behindWR * 100);
  const popPct = Math.round(population * 100);
  return (
    <div className="flex flex-col gap-2 text-xs">
      <div className="flex items-center gap-2">
        <span className="w-24 shrink-0 text-muted-foreground">Behind 5k</span>
        <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-muted/30">
          <div
            className={`h-full rounded-full transition-[width] duration-500 ${
              behindWR >= population ? "bg-emerald-500/70" : "bg-rose-500/70"
            }`}
            style={{ width: `${userPct}%` }}
          />
          <div
            className="absolute top-1/2 h-3 -translate-y-1/2 -translate-x-1/2 border-l border-dashed border-foreground/40"
            style={{ left: `${popPct}%` }}
          />
        </div>
        <span className="w-8 shrink-0 tabular-nums text-right text-muted-foreground">
          {userPct}%
        </span>
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground/60">
        <span>You: {userPct}%</span>
        <span>Typical: ~{popPct}%</span>
      </div>
    </div>
  );
}

export function TrendComebackResilience({
  current,
  previous: _previous,
}: {
  current: MatchSummary[];
  previous: MatchSummary[];
}) {
  const stats = useMemo(() => {
    // teamGoldDiffAt15 = 0 is our sentinel for "no projection yet" — drop
    // those out of the sample. The case where the match was actually exactly
    // even at 15 min is statistically rare and not worth a dedicated flag.
    const projected = excludeRemakes(current).filter((m) => m.teamGoldDiffAt15 !== 0);
    const behind = projected.filter((m) => m.teamGoldDiffAt15 <= BEHIND_THRESHOLD);
    const behindWins = behind.filter((m) => m.win).length;
    return {
      projected: projected.length,
      behindCount: behind.length,
      behindWins,
      behindWR: behind.length === 0 ? 0 : behindWins / behind.length,
    };
  }, [current]);

  if (stats.projected < MIN_BEHIND_SAMPLE) {
    return (
      <ConclusionCard
        title="Comeback resilience"
        sampleSize={stats.projected}
        verdict="Need 5+ matches with a projected timeline to gauge comeback ability."
        empty
      />
    );
  }

  if (stats.behindCount < MIN_BEHIND_SAMPLE) {
    return (
      <ConclusionCard
        title="Comeback resilience"
        sampleSize={stats.projected}
        verdict={`Only ${stats.behindCount} games down 5k+ at 15 min — usually you're not behind that early.`}
        empty
      />
    );
  }

  const userPct = Math.round(stats.behindWR * 100);
  const popPct = Math.round(POPULATION_BEHIND_WR * 100);
  const deltaPp = Math.round((stats.behindWR - POPULATION_BEHIND_WR) * 100);

  let verdict: string;
  if (Math.abs(deltaPp) < 5) {
    verdict = `Down 5k+ at 15 min, you win ${userPct}% (${stats.behindWins}/${stats.behindCount}) — close to typical (~${popPct}%).`;
  } else if (deltaPp > 0) {
    verdict = `Down 5k+ at 15 min, you win ${userPct}% (${stats.behindWins}/${stats.behindCount}) — ${deltaPp}% above typical.`;
  } else {
    verdict = `Down 5k+ at 15 min, you win ${userPct}% (${stats.behindWins}/${stats.behindCount}) — ${Math.abs(deltaPp)}% below typical.`;
  }

  const prescription =
    stats.behindWR < 0.2
      ? "Practice playing from behind — focus on safety, scaling, single picks."
      : undefined;

  return (
    <ConclusionCard
      title="Comeback resilience"
      sampleSize={stats.behindCount}
      verdict={verdict}
      verdictMarkdown={verdict}
      prescription={prescription}
      prescriptionMarkdown={prescription}
      evidence={
        <ResilienceBars behindWR={stats.behindWR} population={POPULATION_BEHIND_WR} />
      }
    />
  );
}
