// Baseline: role-population — your avg vision score on your primary role vs ROLE_VISION_SCORE in role-baselines.ts.
import {
  ROLE_LABEL,
  ROLE_VISION_SCORE,
  aggregateByRole,
  primaryRole,
} from "@/lol/_shared/analytics/role-baselines";
import { ConclusionCard } from "@/lol/trends/_shared/conclusion-card";
import type { MatchSummary } from "@vyoh/shared";
import { useMemo } from "react";

const MIN_SAMPLE = 5;

function VisionBar({
  user,
  expected,
  label,
}: {
  user: number;
  expected: number;
  label: string;
}) {
  // Axis spans 0 → 1.5× expected so a slightly-above value still has visible
  // headroom. Clamp at 100% so extreme support games don't blow the layout.
  const axisMax = expected * 1.5;
  const userWidth = `${Math.min(100, (user / axisMax) * 100)}%`;
  const expectedX = `${Math.min(100, (expected / axisMax) * 100)}%`;
  const userRounded = Math.round(user);
  const expectedRounded = Math.round(expected);

  return (
    <div className="flex flex-col gap-2 text-xs">
      <div className="flex items-center gap-2">
        <span className="w-20 shrink-0 text-muted-foreground">{label}</span>
        <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-muted/30">
          <div
            className="h-full rounded-full bg-cyan-500/70 transition-[width] duration-500"
            style={{ width: userWidth }}
          />
          <div
            className="absolute top-1/2 h-3 -translate-y-1/2 -translate-x-1/2 border-l border-dashed border-foreground/40"
            style={{ left: expectedX }}
          />
        </div>
        <span className="w-10 shrink-0 tabular-nums text-right text-muted-foreground">
          {userRounded}
        </span>
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground/60">
        <span>You: {userRounded}</span>
        <span>
          Typical for {label}: {expectedRounded}
        </span>
      </div>
    </div>
  );
}

export function TrendVisionInvestment({
  current,
  previous: _previous,
}: {
  current: MatchSummary[];
  previous: MatchSummary[];
}) {
  const { role, avgVision, games, totalRiftGames } = useMemo(() => {
    const role = primaryRole(current);
    if (!role) return { role: null, avgVision: 0, games: 0, totalRiftGames: 0 };
    const buckets = aggregateByRole(current, (m) => m.visionScore);
    const scores = buckets.get(role) ?? [];
    const total = [...buckets.values()].reduce((s, arr) => s + arr.length, 0);
    if (scores.length === 0) {
      return { role, avgVision: 0, games: 0, totalRiftGames: total };
    }
    const avg = scores.reduce((s, v) => s + v, 0) / scores.length;
    return { role, avgVision: avg, games: scores.length, totalRiftGames: total };
  }, [current]);

  if (!role || games < MIN_SAMPLE) {
    return (
      <ConclusionCard
        title="Vision investment"
        sampleSize={totalRiftGames}
        verdict="Need 5+ Rift games on a role to gauge vision investment."
        empty
      />
    );
  }

  const expected = ROLE_VISION_SCORE[role];
  const ratio = avgVision / expected;
  const label = ROLE_LABEL[role];

  let verdict: string;
  if (ratio >= 1.15) {
    verdict = `Vision score on ${label} averages ${Math.round(avgVision)} — well above the role's typical floor.`;
  } else if (ratio >= 0.85) {
    verdict = `Vision score on ${label} averages ${Math.round(avgVision)} — in line with the role's typical floor.`;
  } else if (ratio >= 0.6) {
    verdict = `Vision score on ${label} averages ${Math.round(avgVision)} — below the role's typical floor.`;
  } else {
    verdict = `Vision score on ${label} averages ${Math.round(avgVision)} — well below the typical floor.`;
  }

  const prescription =
    ratio < 0.7
      ? "Buy a control ward on every back, sweep before objectives."
      : undefined;

  return (
    <ConclusionCard
      title="Vision investment"
      sampleSize={games}
      verdict={verdict}
      verdictMarkdown={verdict}
      prescription={prescription}
      prescriptionMarkdown={prescription}
      evidence={<VisionBar user={avgVision} expected={expected} label={label} />}
    />
  );
}
