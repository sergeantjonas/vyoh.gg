import { useAccountFromSlug } from "@/identity/use-account-from-slug";
import { aggregateChampionStats } from "@/lol/champion-stats";
import { ChampionTable } from "@/lol/champion-table";
import { useHoverChampion } from "@/lol/hover-champion-context";
import { type MatchCountOption, MatchCountSelector } from "@/lol/match-count-selector";
import { useMatchesWindow } from "@/lol/use-matches";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

export const Route = createFileRoute("/lol/$accountSlug/champions")({
  component: ChampionsPage,
});

function ChampionsPage() {
  const { accountSlug } = Route.useParams();
  const account = useAccountFromSlug(accountSlug);
  const [count, setCount] = useState<MatchCountOption>(20);
  const matches = useMatchesWindow(account, count);
  const setHoveredChampion = useHoverChampion();

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-muted-foreground">
          Aggregated over your last {count} games
        </h2>
        <MatchCountSelector
          value={count}
          onChange={setCount}
          layoutId="champions-count-indicator"
        />
      </div>

      {matches.isPending && account ? (
        <p className="text-sm text-muted-foreground">Loading champion stats…</p>
      ) : !matches.data || matches.data.length === 0 ? (
        <p className="text-sm text-muted-foreground">No matches yet to aggregate.</p>
      ) : (
        <ChampionTable
          stats={aggregateChampionStats(matches.data)}
          onCardHover={setHoveredChampion ?? undefined}
        />
      )}
    </div>
  );
}
