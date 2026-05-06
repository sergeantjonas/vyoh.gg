import { useMe } from "@/identity/use-me";
import { aggregateChampionStats } from "@/lol/champion-stats";
import { ChampionTable } from "@/lol/champion-table";
import { useMatches } from "@/lol/use-matches";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/lol/champions")({
  component: ChampionsPage,
});

function ChampionsPage() {
  const me = useMe();
  const account = me.data?.lol[0];
  const matches = useMatches(account);

  if (matches.isPending && account) {
    return <p className="text-sm text-muted-foreground">Loading champion stats…</p>;
  }

  if (!matches.data || matches.data.length === 0) {
    return <p className="text-sm text-muted-foreground">No matches yet to aggregate.</p>;
  }

  const stats = aggregateChampionStats(matches.data);

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        Aggregated over your last {matches.data.length} games.
      </p>
      <ChampionTable stats={stats} />
    </div>
  );
}
