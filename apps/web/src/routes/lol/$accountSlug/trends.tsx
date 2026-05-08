import { MatchCountSelector } from "@/lol/matches/match-count-selector";
import { useMatchWindow } from "@/lol/matches/match-window-context";
import { TrendActivity } from "@/lol/trends/trend-activity";
import { TrendKda } from "@/lol/trends/trend-kda";
import { TrendQueue } from "@/lol/trends/trend-queue";
import { TrendRecord } from "@/lol/trends/trend-record";
import {
  computeKdaSeries,
  computeQueueCounts,
  computeStreak,
  computeTrendSummary,
} from "@/lol/trends/trend-stats";
import { TrendStreak } from "@/lol/trends/trend-streak";
import { TrendSummaryCards } from "@/lol/trends/trend-summary";
import { TrendsSkeleton } from "@/lol/trends/trends-skeleton";
import { createFileRoute } from "@tanstack/react-router";
import { m, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

export const Route = createFileRoute("/lol/$accountSlug/trends")({
  component: TrendsPage,
});

function Reveal({ children }: { children: ReactNode }) {
  const reduced = useReducedMotion();
  return (
    <m.div
      initial={reduced ? {} : { opacity: 0, y: 20 }}
      whileInView={reduced ? {} : { opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.1 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
    >
      {children}
    </m.div>
  );
}

function TrendsPage() {
  const { matches, isPending, total, count, setCount } = useMatchWindow();
  const effectiveCount = matches?.length ?? count;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-medium text-muted-foreground">
            Trends over your last {effectiveCount} games
          </h2>
          {matches && <TrendStreak streak={computeStreak(matches)} />}
        </div>
        <MatchCountSelector
          value={count}
          total={total}
          onChange={setCount}
          layoutId="trends-count-indicator"
        />
      </div>

      {isPending && !matches ? (
        <TrendsSkeleton />
      ) : !matches || matches.length === 0 ? (
        <m.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4 }}
          className="text-sm text-muted-foreground"
        >
          No matches yet to chart.
        </m.p>
      ) : (
        <div className="flex flex-col gap-8">
          <Reveal>
            <TrendSummaryCards summary={computeTrendSummary(matches)} />
          </Reveal>
          <Reveal>
            <TrendRecord matches={matches} />
          </Reveal>
          <Reveal>
            <TrendActivity matches={matches} />
          </Reveal>
          <Reveal>
            <TrendKda points={computeKdaSeries(matches)} />
          </Reveal>
          <Reveal>
            <TrendQueue counts={computeQueueCounts(matches)} />
          </Reveal>
        </div>
      )}
    </div>
  );
}
