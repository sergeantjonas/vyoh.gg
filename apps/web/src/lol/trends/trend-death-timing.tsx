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
// Phase boundaries in seconds — coaching-canonical "lane phase" (early),
// "mid game / objective skirmishing" (mid), and "late game" (late). Death
// timings come in as seconds since match start, so we compare raw values
// rather than re-bucketing the existing 3-min bins (which straddle the
// 15- and 25-min boundaries — 12-15 vs 15-18, 24-27 spans the late line).
const PHASE_EARLY_END_SEC = 15 * 60;
const PHASE_MID_END_SEC = 25 * 60;
// A phase is "dominant" — and worth leading the verdict with — when it
// holds at least 40% of deaths. Below that we fall back to the existing
// peak-bucket framing.
const DOMINANT_PHASE_SHARE = 0.4;

interface PhaseStats {
  early: number;
  mid: number;
  late: number;
}

interface DeathStats {
  bins: number[];
  total: number;
  matchesWithProjection: number;
  peakIndex: number;
  phases: PhaseStats;
}

function computeStats(matches: readonly MatchSummary[]): DeathStats | null {
  // Match must have a projected timeline. Use the explicit `hasTimeline` flag
  // — csAt10 > 0 used to be the sentinel, but PN3 seeds csAt10 from owner
  // challenges for matches that never had a timeline fetched, so the value
  // alone no longer implies the death-timing arrays are populated.
  const projected = excludeRemakes(matches).filter((m) => m.hasTimeline);
  if (projected.length === 0) return null;

  const bins = new Array<number>(BUCKETS).fill(0);
  const phases: PhaseStats = { early: 0, mid: 0, late: 0 };
  let total = 0;
  for (const m of projected) {
    for (const ts of m.deathTimings) {
      const idx = Math.min(BUCKETS - 1, Math.floor(ts / BUCKET_MS_SECONDS));
      bins[idx] = (bins[idx] ?? 0) + 1;
      if (ts < PHASE_EARLY_END_SEC) phases.early++;
      else if (ts < PHASE_MID_END_SEC) phases.mid++;
      else phases.late++;
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

  return { bins, total, matchesWithProjection: projected.length, peakIndex, phases };
}

function bucketLabel(index: number): string {
  if (index === BUCKETS - 1) return `${(BUCKETS - 1) * 3}+`;
  return `${index * 3}–${(index + 1) * 3}`;
}

function PhaseStrip({
  phases,
  total,
}: {
  phases: PhaseStats;
  total: number;
}) {
  // Segmented bar showing the early/mid/late split — same visual rhythm as
  // the histogram below it, but rolled up to phases. Tooltip exposes the
  // raw counts for each segment.
  const cells: Array<{ label: string; share: number; count: number; cls: string }> = [
    {
      label: "Early (0–15)",
      share: total === 0 ? 0 : phases.early / total,
      count: phases.early,
      cls: "bg-rose-500/70",
    },
    {
      label: "Mid (15–25)",
      share: total === 0 ? 0 : phases.mid / total,
      count: phases.mid,
      cls: "bg-amber-500/70",
    },
    {
      label: "Late (25+)",
      share: total === 0 ? 0 : phases.late / total,
      count: phases.late,
      cls: "bg-sky-500/70",
    },
  ];
  return (
    <div className="flex flex-col gap-1">
      <div className="flex h-2 overflow-hidden rounded-full bg-muted/30">
        {cells.map((c) => (
          <TooltipPrimitive.Root key={c.label}>
            <TooltipPrimitive.Trigger asChild>
              <div
                className={`${c.cls} transition-[flex-basis] duration-500`}
                style={{ flexBasis: `${c.share * 100}%` }}
              />
            </TooltipPrimitive.Trigger>
            <TooltipPrimitive.Portal>
              <TooltipPrimitive.Content
                side="top"
                sideOffset={6}
                className="pointer-events-none z-50 rounded-md border bg-popover/85 px-2 py-1 text-xs text-popover-foreground shadow-xl backdrop-blur-md"
              >
                {`${c.label} min: ${c.count} (${Math.round(c.share * 100)}%)`}
              </TooltipPrimitive.Content>
            </TooltipPrimitive.Portal>
          </TooltipPrimitive.Root>
        ))}
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground/70 tabular-nums">
        <span>{`${Math.round((cells[0]?.share ?? 0) * 100)}% early`}</span>
        <span>{`${Math.round((cells[1]?.share ?? 0) * 100)}% mid`}</span>
        <span>{`${Math.round((cells[2]?.share ?? 0) * 100)}% late`}</span>
      </div>
    </div>
  );
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

  const earlyShare = stats.phases.early / stats.total;
  const midShare = stats.phases.mid / stats.total;
  const lateShare = stats.phases.late / stats.total;

  // Lead the verdict with the dominant phase when one holds ≥40% — it's the
  // most human-readable framing ("X% of your deaths happen in the first 15
  // minutes"). Fall back to the existing peak-bucket framing when no phase
  // dominates but a single 3-min bin still clusters meaningfully.
  let verdict: string;
  let prescription: string | undefined;
  if (earlyShare >= DOMINANT_PHASE_SHARE) {
    verdict = `${Math.round(earlyShare * 100)}% of your deaths happen in the first 15 minutes — ${stats.phases.early} of ${stats.total} across ${stats.matchesWithProjection} games.`;
    prescription = "Early-game safety: ward early and respect lane swap-ins.";
  } else if (lateShare >= DOMINANT_PHASE_SHARE) {
    verdict = `${Math.round(lateShare * 100)}% of your deaths happen after 25 minutes — ${stats.phases.late} of ${stats.total} across ${stats.matchesWithProjection} games.`;
    prescription =
      "Late-game positioning: hold tempo, group for objectives, avoid solo picks.";
  } else if (midShare >= DOMINANT_PHASE_SHARE) {
    verdict = `${Math.round(midShare * 100)}% of your deaths fall in the 15–25 minute window — ${stats.phases.mid} of ${stats.total} across ${stats.matchesWithProjection} games.`;
    prescription = "Be cautious during transition — prefer farm over fight.";
  } else if (peakShare >= 0.25) {
    // No single phase dominates but the peak 3-min bin still clusters
    // meaningfully (≥25%) — use the fine-grained bucket framing.
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
      evidence={
        <div className="flex flex-col gap-3">
          <PhaseStrip phases={stats.phases} total={stats.total} />
          <Histogram bins={stats.bins} />
        </div>
      }
    />
  );
}
