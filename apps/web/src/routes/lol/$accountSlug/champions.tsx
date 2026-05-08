import { useHoverChampion } from "@/lol/_shared/hover-champion-context";
import {
  CHAMPION_SORT_OPTIONS,
  type ChampionSortOption,
  ChampionSortSelector,
} from "@/lol/champions/champion-sort-selector";
import { aggregateChampionStats } from "@/lol/champions/champion-stats";
import { ChampionTable } from "@/lol/champions/champion-table";
import { ChampionsSkeleton } from "@/lol/champions/champions-skeleton";
import { MatchCountSelector } from "@/lol/matches/match-count-selector";
import { useMatchWindow } from "@/lol/matches/match-window-context";
import { createFileRoute } from "@tanstack/react-router";
import { m } from "motion/react";
import { useState } from "react";

export const Route = createFileRoute("/lol/$accountSlug/champions")({
  component: ChampionsPage,
});

function ChampionsPage() {
  const { matches, isPending, total, count, setCount } = useMatchWindow();
  const [sort, setSort] = useState<ChampionSortOption>(CHAMPION_SORT_OPTIONS[0].value);
  const setHoveredChampion = useHoverChampion();
  const effectiveCount = matches?.length ?? count;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-medium text-muted-foreground">
          Aggregated over your last {effectiveCount} games
        </h2>
        <div className="flex items-center gap-2">
          <ChampionSortSelector
            value={sort}
            onChange={setSort}
            layoutId="champions-sort-indicator"
          />
          <MatchCountSelector
            value={count}
            total={total}
            onChange={setCount}
            layoutId="champions-count-indicator"
          />
        </div>
      </div>

      {isPending && !matches ? (
        <ChampionsSkeleton />
      ) : !matches || matches.length === 0 ? (
        <m.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4 }}
          className="text-sm text-muted-foreground"
        >
          No matches yet to aggregate.
        </m.p>
      ) : (
        <ChampionTable
          stats={aggregateChampionStats(matches)}
          sort={sort}
          onCardHover={setHoveredChampion ?? undefined}
        />
      )}
    </div>
  );
}
