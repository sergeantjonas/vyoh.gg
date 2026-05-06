import { useMe } from "@/identity/use-me";
import { TrendKda } from "@/lol/trend-kda";
import { TrendQueue } from "@/lol/trend-queue";
import { TrendRecord } from "@/lol/trend-record";
import {
  computeKdaSeries,
  computeQueueCounts,
  computeTrendSummary,
} from "@/lol/trend-stats";
import { TrendSummaryCards } from "@/lol/trend-summary";
import { useMatches } from "@/lol/use-matches";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/lol/trends")({
  component: TrendsPage,
});

function TrendsPage() {
  const me = useMe();
  const account = me.data?.lol[0];
  const matches = useMatches(account);

  if (matches.isPending && account) {
    return <p className="text-sm text-muted-foreground">Loading trends…</p>;
  }

  if (!matches.data || matches.data.length === 0) {
    return <p className="text-sm text-muted-foreground">No matches yet to chart.</p>;
  }

  const summary = computeTrendSummary(matches.data);
  const kdaSeries = computeKdaSeries(matches.data);
  const queueCounts = computeQueueCounts(matches.data);

  return (
    <div className="flex flex-col gap-8">
      <TrendSummaryCards summary={summary} />
      <TrendRecord matches={matches.data} />
      <TrendKda points={kdaSeries} />
      <TrendQueue counts={queueCounts} />
    </div>
  );
}
