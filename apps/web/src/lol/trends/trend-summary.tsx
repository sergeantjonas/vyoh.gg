import { CountUp } from "@/components/count-up";
import { type Variants, m } from "motion/react";
import type { ReactNode } from "react";
import type { TrendSummary } from "./trend-stats";

const container: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const card: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 380, damping: 30 },
  },
};

function Stat({
  label,
  value,
  sub,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
}) {
  return (
    <m.div variants={card} className="rounded-lg border p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
      {sub && <div className="text-sm text-muted-foreground tabular-nums">{sub}</div>}
    </m.div>
  );
}

export function TrendSummaryCards({ summary }: { summary: TrendSummary }) {
  const playtimeHours = summary.totalDurationSec / 3600;
  const showHours = playtimeHours >= 1;
  const winRatePct = Math.round(summary.winRate * 100);

  return (
    <m.div
      initial="hidden"
      animate="show"
      variants={container}
      className="grid grid-cols-3 gap-4"
    >
      <Stat
        label="Record"
        value={
          <>
            <CountUp to={summary.wins} />W <CountUp to={summary.losses} />L
          </>
        }
        sub={
          <>
            <CountUp to={winRatePct} />% win rate
          </>
        }
      />
      <Stat
        label="KDA"
        value={<CountUp to={summary.avgKda} decimals={2} />}
        sub={
          <>
            <CountUp to={summary.totalKills} /> / <CountUp to={summary.totalDeaths} /> /{" "}
            <CountUp to={summary.totalAssists} />
          </>
        }
      />
      <Stat
        label="Played"
        value={
          showHours ? (
            <>
              <CountUp to={playtimeHours} decimals={1} />h
            </>
          ) : (
            <>
              <CountUp to={Math.round(summary.totalDurationSec / 60)} />m
            </>
          )
        }
        sub={
          <>
            <CountUp to={summary.games} /> {summary.games === 1 ? "game" : "games"}
          </>
        }
      />
    </m.div>
  );
}
