// Baseline: personal — your WR by day-of-week; weakest day is flagged against your other days.
import { cn } from "@/lib/utils";
import { ConclusionCard } from "@/lol/trends/_shared/conclusion-card";
import type { MatchSummary } from "@vyoh/shared";
import { useMemo } from "react";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const MIN_GAMES_PER_DAY = 3;
const MIN_TOTAL = 7;

interface DayBucket {
  label: string;
  wr: number;
  games: number;
}

function DowBars({
  days,
  weakestIdx,
}: {
  days: DayBucket[];
  weakestIdx: number;
}) {
  return (
    <div className="flex flex-col gap-1.5 text-xs">
      {days.map((d, i) => {
        const pct = Math.round(d.wr * 100);
        const isWeakest = i === weakestIdx && d.games >= MIN_GAMES_PER_DAY;
        return (
          <div key={d.label} className="flex items-center gap-2">
            <span
              className={cn(
                "w-8 shrink-0",
                isWeakest ? "font-medium text-foreground/80" : "text-muted-foreground"
              )}
            >
              {d.label}
            </span>
            <div className="flex flex-1 items-center gap-2">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted/30">
                {d.games > 0 && (
                  <div
                    className={cn(
                      "h-full rounded-full transition-[width] duration-500",
                      isWeakest ? "bg-rose-500/70" : "bg-zinc-500/50"
                    )}
                    style={{ width: `${pct}%` }}
                  />
                )}
              </div>
              <span
                className={cn(
                  "w-8 tabular-nums text-right",
                  isWeakest ? "text-foreground/80" : "text-muted-foreground",
                  d.games === 0 && "opacity-30"
                )}
              >
                {d.games > 0 ? `${pct}%` : "—"}
              </span>
              <span className="w-6 tabular-nums text-right text-[10px] text-muted-foreground/60">
                {d.games > 0 ? `${d.games}g` : ""}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function TrendDowWr({
  current,
  previous: _previous,
}: {
  current: MatchSummary[];
  previous: MatchSummary[];
}) {
  const playedCount = useMemo(() => current.filter((m) => !m.remake).length, [current]);
  const stats = useMemo(() => {
    const played = current.filter((m) => !m.remake);
    if (played.length < MIN_TOTAL) return null;

    const buckets = Array.from({ length: 7 }, () => ({ wins: 0, games: 0 }));
    for (const m of played) {
      const dow = new Date(m.playedAt).getDay(); // 0 = Sunday
      const b = buckets[dow];
      if (!b) continue;
      b.games++;
      if (m.win) b.wins++;
    }

    const days: DayBucket[] = DAY_NAMES.map((label, i) => {
      const b = buckets[i] ?? { wins: 0, games: 0 };
      return { label, wr: b.games > 0 ? b.wins / b.games : 0, games: b.games };
    });

    const eligible = days.filter((d) => d.games >= MIN_GAMES_PER_DAY);
    if (eligible.length < 2) return null;

    const weakest = eligible.reduce((a, b) => (a.wr < b.wr ? a : b));
    const strongest = eligible.reduce((a, b) => (a.wr > b.wr ? a : b));
    const weakestIdx = days.findIndex((d) => d.label === weakest.label);
    const deltaPp = Math.round((strongest.wr - weakest.wr) * 100);

    return { days, weakest, strongest, weakestIdx, deltaPp, sampleSize: played.length };
  }, [current]);

  if (!stats) {
    return (
      <ConclusionCard
        title="Day of week"
        sampleSize={playedCount}
        verdict="Need games on 2+ days to compare day-of-week performance."
        empty
      />
    );
  }

  const { days, weakest, strongest, weakestIdx, deltaPp, sampleSize } = stats;

  const verdict = `${weakest.label} is your weakest day — ${Math.round(weakest.wr * 100)}% WR over ${weakest.games} games.`;

  const prescription =
    deltaPp >= 12
      ? `Consider lighter ranked load on ${weakest.label}. ${strongest.label} is your best at ${Math.round(strongest.wr * 100)}%.`
      : undefined;

  return (
    <ConclusionCard
      title="Day of week"
      sampleSize={sampleSize}
      verdict={verdict}
      verdictMarkdown={verdict}
      prescription={prescription}
      prescriptionMarkdown={prescription}
      evidence={<DowBars days={days} weakestIdx={weakestIdx} />}
    />
  );
}
