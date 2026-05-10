import { useHoverChampion } from "@/lol/_shared/hover-champion-context";
import { filterToSerious, useSeriousQueues } from "@/lol/_shared/serious-queues";
import { useAccountFromSlug } from "@/lol/_shared/use-account-from-slug";
import {
  CHAMPION_SORT_OPTIONS,
  type ChampionSortOption,
  ChampionSortSelector,
} from "@/lol/champions/champion-sort-selector";
import { aggregateChampionStats } from "@/lol/champions/champion-stats";
import { ChampionTable } from "@/lol/champions/champion-table";
import { ChampionsSkeleton } from "@/lol/champions/champions-skeleton";
import { useCachedMatchesWindow } from "@/lol/matches/use-matches";
import { createFileRoute } from "@tanstack/react-router";
import { m } from "motion/react";
import { useMemo, useState } from "react";

export const Route = createFileRoute("/lol/$accountSlug/champions/")({
  component: ChampionsPage,
});

// Match the Champion detail page's window so navigating list → detail doesn't
// switch dataset under the user (the count selector used to live here, but
// detail pages can't share that scope and the totals drifted as a result).
const CHAMPIONS_FETCH_COUNT = 2000;

function ChampionsPage() {
  const { accountSlug } = Route.useParams();
  // Champion stats only count serious play — KDA in ARAM is meaningless and
  // would inflate the table.
  const account = useAccountFromSlug(accountSlug);
  const { ids } = useSeriousQueues();
  const { data, isPending } = useCachedMatchesWindow(account, CHAMPIONS_FETCH_COUNT);
  const matches = useMemo(
    () => (data ? filterToSerious(data.matches, ids) : undefined),
    [data, ids]
  );
  const [sort, setSort] = useState<ChampionSortOption>(CHAMPION_SORT_OPTIONS[0].value);
  const setHoveredChampion = useHoverChampion();

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-medium text-muted-foreground">
          {matches
            ? `Aggregated over your last ${matches.length} games`
            : "Loading champion stats…"}
        </h2>
        <ChampionSortSelector
          value={sort}
          onChange={setSort}
          layoutId="champions-sort-indicator"
        />
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
          accountSlug={accountSlug}
          onCardHover={setHoveredChampion ?? undefined}
        />
      )}
    </div>
  );
}
