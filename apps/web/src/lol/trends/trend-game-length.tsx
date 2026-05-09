import { cn } from "@/lib/utils";
import { computeHabitsStats } from "@/lol/profile/use-habits-stats";
import type { GameLengthBucket } from "@/lol/profile/use-habits-stats";
import { ConclusionCard } from "@/lol/trends/_shared/conclusion-card";
import type { MatchSummary } from "@vyoh/shared";
import { useMemo } from "react";

function barColor(wr: number): string {
  if (wr >= 0.55) return "bg-emerald-500/70";
  if (wr < 0.45) return "bg-rose-500/70";
  return "bg-zinc-500/60";
}

function GameLengthBars({ buckets }: { buckets: GameLengthBucket[] }) {
  const maxGames = Math.max(...buckets.map((b) => b.games), 1);
  return (
    <div className="flex flex-col gap-2 text-xs">
      {buckets.map((b) => {
        const wr = b.games > 0 ? b.wins / b.games : 0;
        const pct = Math.round(wr * 100);
        return (
          <div key={b.label} className="flex items-center gap-2">
            <span className="w-20 shrink-0 text-muted-foreground">{b.label}</span>
            <div className="flex flex-1 items-center gap-2">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted/30">
                {b.games > 0 && (
                  <div
                    className={cn(
                      "h-full rounded-full transition-[width] duration-500",
                      barColor(wr)
                    )}
                    style={{ width: `${(b.games / maxGames) * 100}%` }}
                  />
                )}
              </div>
              <span className="w-8 tabular-nums text-right text-muted-foreground">
                {b.games > 0 ? `${pct}%` : "—"}
              </span>
            </div>
          </div>
        );
      })}
      <div className="text-[10px] text-muted-foreground/60">Bar width = game count</div>
    </div>
  );
}

export function TrendGameLength({
  current,
  previous: _previous,
}: {
  current: MatchSummary[];
  previous: MatchSummary[];
}) {
  const stats = useMemo(() => {
    if (current.length < 5) return null;
    return computeHabitsStats(current);
  }, [current]);

  if (!stats) return null;

  const buckets = stats.gameLength.filter((b) => b.games > 0);
  if (buckets.length < 2) return null;

  const sorted = [...buckets].sort((a, b) => b.wins / b.games - a.wins / a.games);
  const best = sorted[0];
  if (!best) return null;

  const sampleSize = buckets.reduce((s, b) => s + b.games, 0);
  const verdict = `You're strongest in ${best.label} games — ${Math.round((best.wins / best.games) * 100)}% WR over ${best.games} games.`;

  const longBucket = buckets.find((b) => b.label === "Over 35m");
  const prescription =
    longBucket &&
    longBucket.games >= 3 &&
    best.wins / best.games - longBucket.wins / longBucket.games >= 0.12
      ? "Consider surrendering earlier in long losing games."
      : undefined;

  return (
    <ConclusionCard
      title="By game length"
      sampleSize={sampleSize}
      verdict={verdict}
      verdictMarkdown={verdict}
      prescription={prescription}
      prescriptionMarkdown={prescription}
      evidence={<GameLengthBars buckets={buckets} />}
    />
  );
}
