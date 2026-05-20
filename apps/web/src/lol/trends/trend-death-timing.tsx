// Baseline: personal — your death-timing histogram; peak window is internal to your data, no external floor.
import { ConclusionCard } from "@/lol/trends/_shared/conclusion-card";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { type MatchSummary, excludeRemakes } from "@vyoh/shared";
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
  const projected = excludeRemakes(matches).filter((m) => m.csAt10 > 0);
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
  // Bars must be direct children of a flex container with a defined height
  // (h-16 = 64px). Wrapping each bar in a column with auto height makes the
  // bar's percent-height resolve against `auto` (=> 0), collapsing bars
  // visually. Labels live in a parallel row below with matching flex-1
  // widths so they line up under the bars.
  return (
    <div className="flex flex-col gap-1">
      <div className="flex h-16 items-end gap-1">
        {bins.map((value, i) => {
          const heightPct = (value / max) * 100;
          const label = bucketLabel(i);
          return (
            <TooltipPrimitive.Root key={label}>
              <TooltipPrimitive.Trigger asChild>
                <div
                  className="flex-1 rounded-sm bg-rose-500/70 transition-[height] duration-500"
                  style={{ height: `${heightPct}%`, minHeight: value > 0 ? 1 : 0 }}
                />
              </TooltipPrimitive.Trigger>
              <TooltipPrimitive.Portal>
                <TooltipPrimitive.Content
                  side="top"
                  sideOffset={6}
                  className="pointer-events-none z-50 rounded-md border bg-popover/85 px-2 py-1 text-xs text-popover-foreground shadow-xl backdrop-blur-md"
                >
                  {`${label} min: ${value}`}
                </TooltipPrimitive.Content>
              </TooltipPrimitive.Portal>
            </TooltipPrimitive.Root>
          );
        })}
      </div>
      <div className="flex gap-1 text-[9px] text-muted-foreground/50 tabular-nums">
        {bins.map((_, i) => {
          const label = bucketLabel(i);
          return (
            <span key={label} className="flex-1 text-center">
              {i % 3 === 0
                ? i === BUCKETS - 1
                  ? `${(BUCKETS - 1) * 3}+`
                  : `${i * 3}`
                : ""}
            </span>
          );
        })}
      </div>
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
