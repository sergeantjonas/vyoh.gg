import {
  ROLE_CS_AT_10,
  ROLE_LABEL,
  aggregateByRole,
  primaryRole,
} from "@/lol/_shared/role-baselines";
import { ConclusionCard } from "@/lol/trends/_shared/conclusion-card";
import type { MatchSummary } from "@vyoh/shared";
import { useMemo } from "react";

const MIN_SAMPLE = 5;

function CsBar({
  user,
  expected,
  label,
}: {
  user: number;
  expected: number;
  label: string;
}) {
  const axisMax = Math.max(expected * 1.4, 100);
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
            className="h-full rounded-full bg-orange-500/70 transition-[width] duration-500"
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

export function TrendLanePhasePrognosis({
  current,
  previous: _previous,
}: {
  current: MatchSummary[];
  previous: MatchSummary[];
}) {
  const { role, avgCs, games, totalRiftGames } = useMemo(() => {
    const role = primaryRole(current);
    if (!role) return { role: null, avgCs: 0, games: 0, totalRiftGames: 0 };
    // Filter to matches with a non-zero csAt10 — that's our sentinel for
    // "timeline projected" so historical rows missing the projection don't
    // pull the average down to zero. Also drops sub-10-min remakes naturally.
    const buckets = aggregateByRole(current, (m) => m.csAt10);
    const cs = (buckets.get(role) ?? []).filter((v) => v > 0);
    const total = [...buckets.values()].reduce(
      (s, arr) => s + arr.filter((v) => v > 0).length,
      0
    );
    if (cs.length === 0) {
      return { role, avgCs: 0, games: 0, totalRiftGames: total };
    }
    const avg = cs.reduce((s, v) => s + v, 0) / cs.length;
    return { role, avgCs: avg, games: cs.length, totalRiftGames: total };
  }, [current]);

  // Support's CS@10 is meaningless as a comparison metric — the role isn't
  // farm-driven. Surface a different empty-state instead of a misleading
  // verdict.
  if (role === "UTILITY") {
    return (
      <ConclusionCard
        title="Lane phase prognosis"
        sampleSize={games}
        verdict="Support play isn't farm-driven — see vision investment for the relevant signal."
        empty
      />
    );
  }

  if (!role || games < MIN_SAMPLE) {
    return (
      <ConclusionCard
        title="Lane phase prognosis"
        sampleSize={totalRiftGames}
        verdict="Need 5+ Rift games with a projected timeline to gauge lane phase."
        empty
      />
    );
  }

  const expected = ROLE_CS_AT_10[role];
  const delta = avgCs - expected;
  const deltaInt = Math.round(delta);
  const label = ROLE_LABEL[role];

  let verdict: string;
  if (Math.abs(deltaInt) < 5) {
    verdict = `CS@10 on ${label} averages ${Math.round(avgCs)} — right at the role's typical floor.`;
  } else if (deltaInt > 0) {
    verdict = `CS@10 on ${label} averages ${Math.round(avgCs)} — ${deltaInt} ahead of typical.`;
  } else {
    verdict = `CS@10 on ${label} averages ${Math.round(avgCs)} — ${Math.abs(deltaInt)} behind typical, early lane needs work.`;
  }

  const prescription =
    deltaInt <= -10 ? "Practice last-hitting in the practice tool." : undefined;

  return (
    <ConclusionCard
      title="Lane phase prognosis"
      sampleSize={games}
      verdict={verdict}
      verdictMarkdown={verdict}
      prescription={prescription}
      prescriptionMarkdown={prescription}
      evidence={<CsBar user={avgCs} expected={expected} label={label} />}
    />
  );
}
