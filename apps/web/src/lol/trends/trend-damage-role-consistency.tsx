// Baseline: role-population — your avg damage share on your primary role vs ROLE_DAMAGE_SHARE in role-baselines.ts.
import {
  ROLE_DAMAGE_SHARE,
  ROLE_LABEL,
  aggregateByRole,
  primaryRole,
} from "@/lol/_shared/role-baselines";
import { ConclusionCard } from "@/lol/trends/_shared/conclusion-card";
import type { MatchSummary } from "@vyoh/shared";
import { useMemo } from "react";

const MIN_SAMPLE = 5;

function ShareBar({
  user,
  expected,
  label,
}: {
  user: number;
  expected: number;
  label: string;
}) {
  const userPct = Math.round(user * 100);
  const expectedPct = Math.round(expected * 100);
  // Both bars are normalized to the same axis (0-50%) so they're visually
  // comparable. 50% is a generous upper bound that fits any role's typical
  // share without looking compressed.
  const axisMax = 0.5;
  const userWidth = `${(user / axisMax) * 100}%`;
  const expectedX = `${(expected / axisMax) * 100}%`;

  return (
    <div className="flex flex-col gap-2 text-xs">
      <div className="flex items-center gap-2">
        <span className="w-20 shrink-0 text-muted-foreground">{label}</span>
        <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-muted/30">
          <div
            className="h-full rounded-full bg-violet-500/70 transition-[width] duration-500"
            style={{ width: userWidth }}
          />
          <div
            className="absolute top-1/2 h-3 -translate-y-1/2 -translate-x-1/2 border-l border-dashed border-foreground/40"
            style={{ left: expectedX }}
          />
        </div>
        <span className="w-10 shrink-0 tabular-nums text-right text-muted-foreground">
          {userPct}%
        </span>
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground/60">
        <span>You: {userPct}%</span>
        <span>
          Typical for {label}: {expectedPct}%
        </span>
      </div>
    </div>
  );
}

export function TrendDamageRoleConsistency({
  current,
  previous: _previous,
}: {
  current: MatchSummary[];
  previous: MatchSummary[];
}) {
  const { role, avgShare, games, totalRiftGames } = useMemo(() => {
    const role = primaryRole(current);
    if (!role) return { role: null, avgShare: 0, games: 0, totalRiftGames: 0 };
    const buckets = aggregateByRole(current, (m) => m.damageShare);
    const shares = buckets.get(role) ?? [];
    const total = [...buckets.values()].reduce((s, arr) => s + arr.length, 0);
    if (shares.length === 0) {
      return { role, avgShare: 0, games: 0, totalRiftGames: total };
    }
    const avg = shares.reduce((s, v) => s + v, 0) / shares.length;
    return { role, avgShare: avg, games: shares.length, totalRiftGames: total };
  }, [current]);

  if (!role || games < MIN_SAMPLE) {
    return (
      <ConclusionCard
        title="Damage role consistency"
        sampleSize={totalRiftGames}
        verdict="Need 5+ Rift games on a role to gauge damage consistency."
        empty
      />
    );
  }

  const expected = ROLE_DAMAGE_SHARE[role];
  const deltaPp = Math.round((avgShare - expected) * 100);
  const label = ROLE_LABEL[role];
  const userPct = Math.round(avgShare * 100);

  let verdict: string;
  if (Math.abs(deltaPp) < 3) {
    verdict = `Damage share on ${label} averages ${userPct}% — right at the role's typical floor.`;
  } else if (deltaPp > 0) {
    verdict = `Damage share on ${label} averages ${userPct}% — ${deltaPp}% above the typical role floor.`;
  } else {
    verdict = `Damage share on ${label} averages ${userPct}% — ${Math.abs(deltaPp)}% below the typical role floor.`;
  }

  const prescription =
    deltaPp <= -5 ? "Work on positioning to deal more damage in fights." : undefined;

  return (
    <ConclusionCard
      title="Damage role consistency"
      sampleSize={games}
      verdict={verdict}
      verdictMarkdown={verdict}
      prescription={prescription}
      prescriptionMarkdown={prescription}
      evidence={<ShareBar user={avgShare} expected={expected} label={label} />}
    />
  );
}
