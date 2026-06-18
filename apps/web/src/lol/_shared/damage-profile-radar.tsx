import { CHART_AXIS, CHART_GRID, CHART_SERIES } from "@/lib/chart-palette";
import { useAccountFromSlug } from "@/lol/_shared/account/use-account-from-slug";
import { ConclusionCard } from "@/lol/_shared/ui/conclusion-card";
import { useDamageProfile } from "@/lol/_shared/use-damage-profile";
import type { DamageProfile } from "@vyoh/shared";
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
} from "recharts";

// Enough games for the share averages to settle. Matches the champion-detail
// sibling tiles (lane-phase, rune-diversity); the profile-wide scope clears it
// trivially.
const MIN_GAMES = 5;

// The three radar spokes. `get` reads the mean team-share (0..1); `noun` feeds
// the verdict sentence. Order is the draw order around the radar (clockwise from
// top). No damage-taken spoke: the lean MatchDetailCache projection strips
// teammates' totalDamageTaken, so its team-share isn't recoverable — see the
// DamageProfile type doc.
const AXES = [
  {
    label: "Damage",
    noun: "damage to champions",
    get: (d: DamageProfile) => d.damageShare,
  },
  { label: "Vision", noun: "vision score", get: (d: DamageProfile) => d.visionShare },
  { label: "CS", noun: "CS", get: (d: DamageProfile) => d.csShare },
] as const;

const pct = (share: number) => Math.round(share * 100);

/**
 * Damage-profile radar (D.3). Plots the owner's mean share of their team's
 * totals across three axes (damage, vision, CS), scaled so the dashed reference
 * polygon at radius 1 is an even five-way split (share 0.2). Reusable at both
 * scopes: pass a `championKey` for the champion-detail tile, omit it for the
 * profile-wide one.
 */
export function DamageProfileRadar({
  accountSlug,
  championKey,
  frosted = true,
}: {
  accountSlug: string;
  championKey?: string;
  /** Frosted recipe (`bg-card/60 + backdrop-blur-sm`). Defaults to true — both
   *  mount points sit over a splash backdrop. See "one level of glass". */
  frosted?: boolean;
}) {
  const account = useAccountFromSlug(accountSlug);
  const { data, isPending } = useDamageProfile(account, championKey);

  if (isPending || !data) return null;

  if (data.sampleSize < MIN_GAMES) {
    return (
      <ConclusionCard
        title="Damage profile"
        sampleSize={data.sampleSize}
        verdict={`Need ${MIN_GAMES}+ games to map your share of the team's damage, vision, and CS.`}
        empty
        frosted={frosted}
      />
    );
  }

  // Headline the axis the owner over-indexes on most. `× 5` rescales share so
  // the even-split reference sits at radius 1 and a hard carry reaches outward.
  const top = AXES.reduce((best, a) => (a.get(data) > best.get(data) ? a : best));
  const verdict = `Across ${data.sampleSize} games you account for ${pct(top.get(data))}% of your team's ${top.noun} — an even split would be 20%.`;

  const radarData = AXES.map((a) => ({
    axis: a.label,
    you: a.get(data) * 5,
    even: 1,
  }));

  return (
    <ConclusionCard
      title="Damage profile"
      sampleSize={data.sampleSize}
      verdict={verdict}
      verdictMarkdown={verdict}
      frosted={frosted}
      evidence={
        <div className="flex flex-col gap-2">
          <ResponsiveContainer width="100%" height={220}>
            <RadarChart
              data={radarData}
              aria-label="Your share of your team's damage, vision, and CS"
            >
              <PolarGrid stroke={CHART_GRID} />
              <PolarAngleAxis dataKey="axis" tick={{ fontSize: 11, fill: CHART_AXIS }} />
              <PolarRadiusAxis domain={[0, 2.5]} tick={false} axisLine={false} />
              {/* Dashed reference polygon = an even five-way split. */}
              <Radar
                dataKey="even"
                stroke={CHART_GRID}
                strokeDasharray="3 3"
                fill="none"
              />
              <Radar
                dataKey="you"
                stroke={CHART_SERIES}
                strokeWidth={1.5}
                fill={CHART_SERIES}
                fillOpacity={0.25}
              />
            </RadarChart>
          </ResponsiveContainer>
          {/* Absolute shares — the radar shows shape, this reads the numbers. */}
          <div className="grid grid-cols-3 gap-1.5 text-center">
            {AXES.map((a) => (
              <div key={a.label} className="flex flex-col">
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground/70">
                  {a.label}
                </span>
                <span className="text-sm font-semibold tabular-nums">
                  {pct(a.get(data))}%
                </span>
              </div>
            ))}
          </div>
        </div>
      }
    />
  );
}
