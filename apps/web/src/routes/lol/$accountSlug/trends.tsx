import { useAccountFromSlug } from "@/identity/use-account-from-slug";
import { type MatchCountOption, MatchCountSelector } from "@/lol/match-count-selector";
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
import { useMatchesWindow } from "@/lol/use-matches";
import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useState } from "react";

export const Route = createFileRoute("/lol/$accountSlug/trends")({
  component: TrendsPage,
});

function TrendsPage() {
  const { accountSlug } = Route.useParams();
  const { queue } = useSearch({ from: "/lol/$accountSlug" });
  const account = useAccountFromSlug(accountSlug);
  const [count, setCount] = useState<MatchCountOption>(20);
  const matches = useMatchesWindow(account, count, queue);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-medium text-muted-foreground">
            Trends over your last {count} games
          </h2>
          {matches.data && <TrendStreak streak={computeStreak(matches.data)} />}
        </div>
        <MatchCountSelector
          value={count}
          onChange={setCount}
          layoutId="trends-count-indicator"
        />
      </div>

      {matches.isPending && account ? (
        <TrendsSkeleton />
      ) : !matches.data || matches.data.length === 0 ? (
        <p className="text-sm text-muted-foreground">No matches yet to chart.</p>
      ) : (
        <div className="flex flex-col gap-8">
          <TrendSummaryCards summary={computeTrendSummary(matches.data)} />
          <TrendRecord matches={matches.data} />
          <TrendActivity matches={matches.data} />
          <TrendKda points={computeKdaSeries(matches.data)} />
          <TrendQueue counts={computeQueueCounts(matches.data)} />
        </div>
      )}
    </div>
  );
}
