import { useAccountFromSlug } from "@/identity/use-account-from-slug";
import {
  CHAMPION_SORT_OPTIONS,
  type ChampionSortOption,
  ChampionSortSelector,
} from "@/lol/champion-sort-selector";
import { aggregateChampionStats } from "@/lol/champion-stats";
import { ChampionTable } from "@/lol/champion-table";
import { useHoverChampion } from "@/lol/hover-champion-context";
import { type MatchCountOption, MatchCountSelector } from "@/lol/match-count-selector";
import { useMatchesWindow } from "@/lol/use-matches";
import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useState } from "react";

export const Route = createFileRoute("/lol/$accountSlug/champions")({
  component: ChampionsPage,
});

function ChampionsPage() {
  const { accountSlug } = Route.useParams();
  const { queue } = useSearch({ from: "/lol/$accountSlug" });
  const account = useAccountFromSlug(accountSlug);
  const [count, setCount] = useState<MatchCountOption>(20);
  const [sort, setSort] = useState<ChampionSortOption>(CHAMPION_SORT_OPTIONS[0].value);
  const matches = useMatchesWindow(account, count, queue);
  const setHoveredChampion = useHoverChampion();

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-medium text-muted-foreground">
          Aggregated over your last {count} games
        </h2>
        <div className="flex items-center gap-2">
          <ChampionSortSelector
            value={sort}
            onChange={setSort}
            layoutId="champions-sort-indicator"
          />
          <MatchCountSelector
            value={count}
            onChange={setCount}
            layoutId="champions-count-indicator"
          />
        </div>
      </div>

      {matches.isPending && account ? (
        <p className="text-sm text-muted-foreground">Loading champion stats…</p>
      ) : !matches.data || matches.data.length === 0 ? (
        <p className="text-sm text-muted-foreground">No matches yet to aggregate.</p>
      ) : (
        <ChampionTable
          stats={aggregateChampionStats(matches.data)}
          sort={sort}
          onCardHover={setHoveredChampion ?? undefined}
        />
      )}
    </div>
  );
}
