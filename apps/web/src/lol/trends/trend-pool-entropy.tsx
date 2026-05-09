import { ChampionSquareIcon } from "@/lol/_shared/champion-square-icon";
import { ConclusionCard } from "@/lol/trends/_shared/conclusion-card";
import type { MatchSummary } from "@vyoh/shared";
import { useMemo } from "react";

function computeChampionFrequency(
  matches: MatchSummary[]
): { champion: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const m of matches.filter((m) => !m.remake)) {
    counts.set(m.champion, (counts.get(m.champion) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([champion, count]) => ({ champion, count }))
    .sort((a, b) => b.count - a.count);
}

function poolLabel(unique: number, total: number): string {
  if (total === 0) return "no data";
  const ratio = unique / total;
  if (unique <= 3) return "tight pool";
  if (ratio < 0.25) return "focused pool";
  if (ratio < 0.5) return "balanced pool";
  return "versatile pool";
}

function ChampionFrequencyStrip({
  freq,
  total,
}: {
  freq: { champion: string; count: number }[];
  total: number;
}) {
  const maxCount = freq[0]?.count ?? 1;
  return (
    <div className="flex flex-col gap-1.5">
      {freq.map(({ champion, count }) => (
        <div key={champion} className="flex items-center gap-2 text-xs">
          <ChampionSquareIcon
            championName={champion}
            className="size-4 shrink-0 rounded-sm"
          />
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted/30">
            <div
              className="h-full rounded-full bg-violet-500/60 transition-[width] duration-500"
              style={{ width: `${(count / maxCount) * 100}%` }}
            />
          </div>
          <span className="w-5 tabular-nums text-right text-muted-foreground/80">
            {count}
          </span>
        </div>
      ))}
      {total > freq.length && (
        <p className="text-[10px] text-muted-foreground/60">
          +{total - freq.length} other{total - freq.length !== 1 ? "s" : ""}
        </p>
      )}
    </div>
  );
}

export function TrendPoolEntropy({
  current,
  previous: _previous,
}: {
  current: MatchSummary[];
  previous: MatchSummary[];
}) {
  const freq = useMemo(() => computeChampionFrequency(current), [current]);
  const nonRemakeCount = useMemo(
    () => current.filter((m) => !m.remake).length,
    [current]
  );

  if (nonRemakeCount === 0) return null;

  const uniqueChampions = freq.length;
  const label = poolLabel(uniqueChampions, nonRemakeCount);
  const top3Count = freq.slice(0, 3).reduce((s, c) => s + c.count, 0);
  const top3Share = nonRemakeCount > 0 ? top3Count / nonRemakeCount : 0;

  const verdict = `You play ${uniqueChampions} unique champion${uniqueChampions !== 1 ? "s" : ""} — ${label}.`;
  const prescription =
    uniqueChampions >= 10 && top3Share < 0.5
      ? "Wide pool — consider focusing on 3 to climb faster."
      : undefined;

  return (
    <ConclusionCard
      title="Champion pool"
      sampleSize={nonRemakeCount}
      verdict={verdict}
      verdictMarkdown={verdict}
      prescription={prescription}
      prescriptionMarkdown={prescription}
      evidence={
        <ChampionFrequencyStrip freq={freq.slice(0, 5)} total={uniqueChampions} />
      }
    />
  );
}
