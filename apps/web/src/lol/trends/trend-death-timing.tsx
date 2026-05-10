import { ConclusionCard } from "@/lol/trends/_shared/conclusion-card";
import type { MatchSummary } from "@vyoh/shared";
import { useMemo } from "react";

const MIN_SAMPLE = 5;
// Bucket deaths into 3-minute bands. Game ends rarely happen past 35 min so
// 0-3, 3-6, ..., 30-33, 33+ covers everything.
const BUCKET_MS_SECONDS = 180;
const BUCKETS = 12;

interface DeathStats {
  bins: number[];
  total: number;
  matchesWithProjection: number;
  peakIndex: number;
}

function computeStats(matches: readonly MatchSummary[]): DeathStats | null {
  // Match must have a projected timeline (any csAt10 > 0 is a fine sentinel
  // for "this match has been processed"; matches that ended before 10 min
  // can't have lane phase data anyway).
  const projected = matches.filter((m) => !m.remake && m.csAt10 > 0);
  if (projected.length === 0) return null;

  const bins = new Array<number>(BUCKETS).fill(0);
  let total = 0;
  for (const m of projected) {
    for (const ts of m.deathTimings) {
      const idx = Math.min(BUCKETS - 1, Math.floor(ts / BUCKET_MS_SECONDS));
      bins[idx] = (bins[idx] ?? 0) + 1;
      total++;
    }
  }

  let peakIndex = 0;
  let peakValue = bins[0] ?? 0;
  for (let i = 1; i < bins.length; i++) {
    const value = bins[i] ?? 0;
    if (value > peakValue) {
      peakValue = value;
      peakIndex = i;
    }
  }

  return { bins, total, matchesWithProjection: projected.length, peakIndex };
}

function bucketLabel(index: number): string {
  if (index === BUCKETS - 1) return `${(BUCKETS - 1) * 3}+`;
  return `${index * 3}–${(index + 1) * 3}`;
}

function Histogram({ bins }: { bins: number[] }) {
  const max = Math.max(1, ...bins);
  return (
    <div className="flex h-16 items-end gap-1">
      {bins.map((value, i) => {
        const heightPct = (value / max) * 100;
        const minutes = i === BUCKETS - 1 ? `${(BUCKETS - 1) * 3}+` : `${i * 3}`;
        return (
          <div
            key={minutes}
            className="flex flex-1 flex-col items-center gap-0.5"
            title={`${bucketLabel(i)} min: ${value}`}
          >
            <div
              className="w-full rounded-sm bg-rose-500/70 transition-[height] duration-500"
              style={{ height: `${heightPct}%` }}
            />
            {i % 3 === 0 && (
              <span className="text-[9px] text-muted-foreground/50">{minutes}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function TrendDeathTiming({
  current,
  previous: _previous,
}: {
  current: MatchSummary[];
  previous: MatchSummary[];
}) {
  const stats = useMemo(() => computeStats(current), [current]);

  if (!stats || stats.matchesWithProjection < MIN_SAMPLE) {
    return (
      <ConclusionCard
        title="Death timing"
        sampleSize={stats?.matchesWithProjection ?? 0}
        verdict="Need 5+ matches with a projected timeline to detect death-timing patterns."
        empty
      />
    );
  }

  if (stats.total === 0) {
    return (
      <ConclusionCard
        title="Death timing"
        sampleSize={stats.matchesWithProjection}
        verdict={`No deaths recorded across ${stats.matchesWithProjection} games — exceptional.`}
        empty
      />
    );
  }

  const peakValue = stats.bins[stats.peakIndex] ?? 0;
  const peakShare = peakValue / stats.total;
  const peakLabel = bucketLabel(stats.peakIndex);

  let verdict: string;
  let prescription: string | undefined;
  if (peakShare >= 0.25) {
    // A meaningful cluster — peak bin holds at least 25% of all deaths.
    verdict = `Deaths cluster at minutes ${peakLabel} — ${peakValue} of ${stats.total} (${Math.round(peakShare * 100)}%).`;
    if (stats.peakIndex >= 4 && stats.peakIndex <= 5) {
      prescription = "Be cautious during transition — prefer farm over fight.";
    } else if (stats.peakIndex >= 0 && stats.peakIndex <= 1) {
      prescription = "Early-game safety: ward early and respect lane swap-ins.";
    }
  } else {
    verdict = `Deaths spread evenly across the game — no single transition phase stands out (${stats.total} deaths in ${stats.matchesWithProjection} games).`;
  }

  return (
    <ConclusionCard
      title="Death timing"
      sampleSize={stats.matchesWithProjection}
      verdict={verdict}
      verdictMarkdown={verdict}
      prescription={prescription}
      prescriptionMarkdown={prescription}
      evidence={<Histogram bins={stats.bins} />}
    />
  );
}
