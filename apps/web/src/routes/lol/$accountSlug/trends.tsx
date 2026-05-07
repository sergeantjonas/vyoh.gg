import { useAccountFromSlug } from "@/identity/use-account-from-slug";
import { type MatchCountOption, MatchCountSelector } from "@/lol/match-count-selector";
import { TrendKda } from "@/lol/trend-kda";
import { TrendQueue } from "@/lol/trend-queue";
import { TrendRecord } from "@/lol/trend-record";
import {
  computeKdaSeries,
  computeQueueCounts,
  computeTrendSummary,
} from "@/lol/trend-stats";
import { TrendSummaryCards } from "@/lol/trend-summary";
import { useMatchesWindow } from "@/lol/use-matches";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

export const Route = createFileRoute("/lol/$accountSlug/trends")({
  component: TrendsPage,
});

function TrendsPage() {
  const { accountSlug } = Route.useParams();
  const account = useAccountFromSlug(accountSlug);
  const [count, setCount] = useState<MatchCountOption>(20);
  const matches = useMatchesWindow(account, count);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-muted-foreground">
          Trends over your last {count} games
        </h2>
        <MatchCountSelector
          value={count}
          onChange={setCount}
          layoutId="trends-count-indicator"
        />
      </div>

      {matches.isPending && account ? (
        <p className="text-sm text-muted-foreground">Loading trends…</p>
      ) : !matches.data || matches.data.length === 0 ? (
        <p className="text-sm text-muted-foreground">No matches yet to chart.</p>
      ) : (
        <div className="flex flex-col gap-8">
          <TrendSummaryCards summary={computeTrendSummary(matches.data)} />
          <TrendRecord matches={matches.data} />
          <TrendKda points={computeKdaSeries(matches.data)} />
          <TrendQueue counts={computeQueueCounts(matches.data)} />
        </div>
      )}
    </div>
  );
}
