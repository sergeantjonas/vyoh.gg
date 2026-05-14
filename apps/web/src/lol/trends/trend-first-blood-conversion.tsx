// Baseline: personal — your first-blood-game WR vs your overall WR (NOT a role-population baseline).
import { ConclusionCard } from "@/lol/trends/_shared/conclusion-card";
import type { MatchSummary } from "@vyoh/shared";
import { useMemo } from "react";

const MIN_SAMPLE = 5;

function ConversionBars({
  fbCount,
  fbWins,
  totalGames,
  totalWins,
}: {
  fbCount: number;
  fbWins: number;
  totalGames: number;
  totalWins: number;
}) {
  const fbWr = fbCount === 0 ? 0 : fbWins / fbCount;
  const overallWr = totalGames === 0 ? 0 : totalWins / totalGames;
  const fbPct = Math.round(fbWr * 100);
  const overallPct = Math.round(overallWr * 100);

  return (
    <div className="flex flex-col gap-2 text-xs">
      <div className="flex items-center gap-2">
        <span className="w-24 shrink-0 text-muted-foreground">FB games</span>
        <div className="flex flex-1 items-center gap-2">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted/30">
            <div
              className="h-full rounded-full bg-amber-500/70 transition-[width] duration-500"
              style={{ width: `${fbPct}%` }}
            />
          </div>
          <span className="w-8 tabular-nums text-right text-muted-foreground">
            {fbPct}%
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="w-24 shrink-0 text-muted-foreground">Overall</span>
        <div className="flex flex-1 items-center gap-2">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted/30">
            <div
              className="h-full rounded-full bg-foreground/30 transition-[width] duration-500"
              style={{ width: `${overallPct}%` }}
            />
          </div>
          <span className="w-8 tabular-nums text-right text-muted-foreground">
            {overallPct}%
          </span>
        </div>
      </div>
      <div className="flex gap-4 text-[10px] text-muted-foreground/60">
        <span>
          {fbWins}W of {fbCount} FB games
        </span>
        <span>
          {totalWins}W of {totalGames} games
        </span>
      </div>
    </div>
  );
}

export function TrendFirstBloodConversion({
  current,
  previous: _previous,
}: {
  current: MatchSummary[];
  previous: MatchSummary[];
}) {
  const stats = useMemo(() => {
    const played = current.filter((m) => !m.remake);
    const fb = played.filter((m) => m.firstBloodKill);
    return {
      fbCount: fb.length,
      fbWins: fb.filter((m) => m.win).length,
      totalGames: played.length,
      totalWins: played.filter((m) => m.win).length,
    };
  }, [current]);

  if (stats.totalGames < MIN_SAMPLE) {
    return (
      <ConclusionCard
        title="First-blood conversion"
        sampleSize={stats.totalGames}
        verdict="Need 5+ games to gauge first-blood impact."
        empty
      />
    );
  }

  if (stats.fbCount === 0) {
    return (
      <ConclusionCard
        title="First-blood conversion"
        sampleSize={stats.totalGames}
        verdict={`No first bloods this window across ${stats.totalGames} games.`}
        empty
      />
    );
  }

  const fbWr = stats.fbWins / stats.fbCount;
  const overallWr = stats.totalWins / stats.totalGames;
  const deltaPp = Math.round((fbWr - overallWr) * 100);
  const fbPct = Math.round(fbWr * 100);

  let verdict: string;
  if (Math.abs(deltaPp) < 4) {
    verdict = `${stats.fbWins}/${stats.fbCount} first bloods — wins close to your overall rate.`;
  } else if (deltaPp > 0) {
    verdict = `${stats.fbWins}/${stats.fbCount} first bloods — ${fbPct}% WR, ${deltaPp}% above overall.`;
  } else {
    verdict = `${stats.fbWins}/${stats.fbCount} first bloods — ${fbPct}% WR, ${Math.abs(deltaPp)}% below overall.`;
  }

  // Negative-delta prescription only — first-blood matches *should* lift WR.
  // When they don't (e.g. greedy follow-up dives), the actionable note fires.
  const prescription =
    deltaPp <= -8 && stats.fbCount >= MIN_SAMPLE
      ? "Back off after the kill — don't trade the lead chasing for more."
      : undefined;

  return (
    <ConclusionCard
      title="First-blood conversion"
      sampleSize={stats.totalGames}
      verdict={verdict}
      verdictMarkdown={verdict}
      prescription={prescription}
      prescriptionMarkdown={prescription}
      evidence={
        <ConversionBars
          fbCount={stats.fbCount}
          fbWins={stats.fbWins}
          totalGames={stats.totalGames}
          totalWins={stats.totalWins}
        />
      }
    />
  );
}
