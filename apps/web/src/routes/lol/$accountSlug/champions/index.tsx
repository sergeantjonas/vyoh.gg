import { useHoverChampion } from "@/lol/_shared/hover-champion-context";
import { useSeriousMatches } from "@/lol/_shared/serious-queues";
import { StickyControlsBar } from "@/lol/_shared/sticky-controls-bar";
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

export const Route = createFileRoute("/lol/$accountSlug/champions/")({
  component: ChampionsPage,
});

function ChampionsPage() {
  const { accountSlug } = Route.useParams();
  // Champion stats only count serious play — KDA in ARAM is meaningless and
  // would inflate the table.
  const { matches } = useSeriousMatches();
  const { isPending, total, count, setCount } = useMatchWindow();
  const [sort, setSort] = useState<ChampionSortOption>(CHAMPION_SORT_OPTIONS[0].value);
  const setHoveredChampion = useHoverChampion();
  const effectiveCount = matches?.length ?? count;

  return (
    <div className="flex flex-col gap-3">
      <StickyControlsBar className="justify-between">
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
      </StickyControlsBar>

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
          accountSlug={accountSlug}
          onCardHover={setHoveredChampion ?? undefined}
        />
      )}
    </div>
  );
}
