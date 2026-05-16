// Baseline: personal — top-3 share of your own games; focus prescription vs your pool composition.
import { ChampionSquareIcon } from "@/lol/_shared/assets/champion-square-icon";
import { ConclusionCard } from "@/lol/trends/_shared/conclusion-card";
import { Link } from "@tanstack/react-router";
import type { MatchSummary } from "@vyoh/shared";
import { useMemo } from "react";

const DISPLAY_COUNT = 6;

function poolLabel(unique: number, total: number): string {
  if (total === 0) return "no data";
  const ratio = unique / total;
  if (unique <= 3) return "tight pool";
  if (ratio < 0.25) return "focused pool";
  if (ratio < 0.5) return "balanced pool";
  return "versatile pool";
}

export function TrendChampionFocus({
  current,
  previous: _previous,
  accountSlug,
}: {
  current: MatchSummary[];
  previous: MatchSummary[];
  accountSlug: string;
}) {
  const { freq, total } = useMemo(() => {
    const played = current.filter((m) => !m.remake);
    const counts = new Map<string, number>();
    for (const m of played) {
      counts.set(m.champion, (counts.get(m.champion) ?? 0) + 1);
    }
    const freq = [...counts.entries()]
      .map(([champion, count]) => ({ champion, count }))
      .sort((a, b) => b.count - a.count);
    return { freq, total: played.length };
  }, [current]);

  if (total === 0) return null;

  const uniqueCount = freq.length;
  const label = poolLabel(uniqueCount, total);
  const top3 = freq.slice(0, 3);
  const top3Count = top3.reduce((s, c) => s + c.count, 0);
  const top3Share = top3Count / total;
  const top3Names = top3.map((c) => c.champion).join(", ");

  const verdict = `${uniqueCount} unique champion${uniqueCount !== 1 ? "s" : ""} — ${label}. Top 3: ${top3Names} (${top3Count} of ${total} games).`;

  const prescription =
    uniqueCount >= 10 && top3Share < 0.5
      ? "Wide pool — consider focusing on 3 to climb faster."
      : undefined;

  const display = freq.slice(0, DISPLAY_COUNT);
  const othersCount = freq.length - display.length;
  const maxCount = display[0]?.count ?? 1;

  return (
    <ConclusionCard
      title="Champion pool"
      sampleSize={total}
      verdict={verdict}
      verdictMarkdown={verdict}
      prescription={prescription}
      prescriptionMarkdown={prescription}
      evidence={
        <div className="flex flex-col gap-1.5">
          {display.map(({ champion, count }) => (
            <div key={champion} className="flex items-center gap-2 text-xs">
              <Link
                to="/lol/$accountSlug/champions/$championKey"
                params={{ accountSlug, championKey: champion.toLowerCase() }}
                className="shrink-0"
              >
                <ChampionSquareIcon
                  championName={champion}
                  className="size-4 shrink-0 rounded-sm"
                />
              </Link>
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
          {othersCount > 0 && (
            <p className="text-[10px] text-muted-foreground/60">
              +{othersCount} other{othersCount !== 1 ? "s" : ""}
            </p>
          )}
        </div>
      }
    />
  );
}
