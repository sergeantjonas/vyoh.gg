import { CountUp } from "@/components/count-up";
import { useMatchWindow } from "@/lol/matches/match-window-context";
import { computeTrendSummary } from "@/lol/trends/trend-stats";
import { type Variants, m } from "motion/react";
import type { ReactNode } from "react";

const container: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const item: Variants = {
  hidden: { opacity: 0, y: 6 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 420, damping: 32 } },
};

function StatItem({ label, children }: { label: string; children: ReactNode }) {
  return (
    <m.div
      variants={item}
      className="flex flex-1 flex-col items-center gap-0.5 px-4 py-3"
    >
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold tabular-nums">{children}</div>
    </m.div>
  );
}

export function ProfileStatsBar() {
  const { matches, isPending } = useMatchWindow();

  if (isPending || !matches || matches.length === 0) return null;

  const s = computeTrendSummary(matches);
  const playtimeHours = s.totalDurationSec / 3600;
  const nonRemakes = matches.filter((m) => !m.remake);
  const uniqueChamps = new Set(nonRemakes.map((m) => m.champion)).size;

  return (
    <m.div
      initial="hidden"
      animate="show"
      variants={container}
      className="flex divide-x divide-border rounded-lg border bg-card/50"
    >
      <StatItem label="Games">
        <CountUp to={s.games} />
      </StatItem>
      <StatItem label="Win Rate">
        <CountUp to={Math.round(s.winRate * 100)} />%
      </StatItem>
      <StatItem label="KDA">
        <CountUp to={s.avgKda} decimals={2} />
      </StatItem>
      <StatItem label="Champs">
        <CountUp to={uniqueChamps} />
      </StatItem>
      <StatItem label="Time Played">
        {playtimeHours >= 1 ? (
          <>
            <CountUp to={playtimeHours} decimals={1} />h
          </>
        ) : (
          <>
            <CountUp to={Math.round(s.totalDurationSec / 60)} />m
          </>
        )}
      </StatItem>
    </m.div>
  );
}
