// Baseline: personal — your own clutch-moment counts over the current trends
// window. No external floor; the verdict frames the raw counts as a narrative.
import { ConclusionCard } from "@/lol/trends/_shared/conclusion-card";
import { useNarrativeWindow } from "@/lol/trends/use-narrative-window";
import { type LolAccount, type MatchSummary, excludeRemakes } from "@vyoh/shared";
import { useMemo } from "react";

const MIN_SAMPLE = 5;

interface HighlightCounts {
  soloKills: number;
  outnumberedKills: number;
  survivedSingleDigitHpCount: number;
}

function HighlightStrip({ counts }: { counts: HighlightCounts }) {
  // The three numbers are the evidence — no chart needed; the framing is in
  // the verdict string. Layout mirrors profile-stats-bar (label below, big
  // tabular number above) so the visual rhythm matches the rest of the surface.
  const cells: Array<{ label: string; value: number }> = [
    { label: "Solo kills", value: counts.soloKills },
    { label: "Outnumbered takedowns", value: counts.outnumberedKills },
    { label: "Clutch survivals", value: counts.survivedSingleDigitHpCount },
  ];
  return (
    <div className="grid grid-cols-3 gap-3 text-xs">
      {cells.map((cell) => (
        <div key={cell.label} className="flex flex-col gap-0.5">
          <span className="font-semibold text-xl tabular-nums text-foreground">
            {cell.value}
          </span>
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground/70">
            {cell.label}
          </span>
        </div>
      ))}
    </div>
  );
}

export function TrendHighlightReel({
  account,
  current,
}: {
  account: LolAccount | undefined;
  current: MatchSummary[];
}) {
  const matchIds = useMemo(
    () => excludeRemakes(current).map((m) => m.matchId),
    [current]
  );

  const { data, isPending } = useNarrativeWindow(account, matchIds);

  if (matchIds.length < MIN_SAMPLE) {
    return (
      <ConclusionCard
        title="Highlight reel"
        sampleSize={matchIds.length}
        verdict="Need 5+ non-remake games to assemble a highlight reel."
        empty
      />
    );
  }

  if (isPending || !data) {
    return (
      <ConclusionCard
        title="Highlight reel"
        sampleSize={matchIds.length}
        verdict="Counting moments…"
        empty
      />
    );
  }

  const counts = data.highlightReel;
  const total =
    counts.soloKills + counts.outnumberedKills + counts.survivedSingleDigitHpCount;

  if (total === 0) {
    return (
      <ConclusionCard
        title="Highlight reel"
        sampleSize={data.matchCount}
        verdict={`No clutch moments this window — ${data.matchCount} games of textbook play.`}
        empty
      />
    );
  }

  const verdict = `${counts.soloKills} solo ${plural("kill", counts.soloKills)}, ${counts.outnumberedKills} outnumbered ${plural("takedown", counts.outnumberedKills)}, ${counts.survivedSingleDigitHpCount} clutch ${plural("survival", counts.survivedSingleDigitHpCount)} across ${data.matchCount} games.`;

  return (
    <ConclusionCard
      title="Highlight reel"
      sampleSize={data.matchCount}
      verdict={verdict}
      verdictMarkdown={verdict}
      evidence={<HighlightStrip counts={counts} />}
    />
  );
}

function plural(word: string, count: number): string {
  return count === 1 ? word : `${word}s`;
}
