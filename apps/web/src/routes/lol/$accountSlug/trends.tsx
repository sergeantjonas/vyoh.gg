import { MatchCountSelector } from "@/lol/match-count-selector";
import { useMatchWindow } from "@/lol/match-window-context";
import { TrendActivity } from "@/lol/trend-activity";
import { TrendKda } from "@/lol/trend-kda";
import { TrendQueue } from "@/lol/trend-queue";
import { TrendRecord } from "@/lol/trend-record";
import {
  computeKdaSeries,
  computeQueueCounts,
  computeStreak,
  computeTrendSummary,
} from "@/lol/trend-stats";
import { TrendStreak } from "@/lol/trend-streak";
import { TrendSummaryCards } from "@/lol/trend-summary";
import { TrendsSkeleton } from "@/lol/trends-skeleton";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/lol/$accountSlug/trends")({
  component: TrendsPage,
});

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
        <p className="text-sm text-muted-foreground">No matches yet to chart.</p>
      ) : (
        <div className="flex flex-col gap-8">
          <TrendSummaryCards summary={computeTrendSummary(matches)} />
          <TrendRecord matches={matches} />
          <TrendActivity matches={matches} />
          <TrendKda points={computeKdaSeries(matches)} />
          <TrendQueue counts={computeQueueCounts(matches)} />
        </div>
      )}
    </div>
  );
}
