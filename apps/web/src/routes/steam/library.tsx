import { EmptyLibraryIllustration, EmptyState } from "@/components/empty-state";
import { applyLibraryFilters } from "@/steam/library/apply-filters";
import { LibraryControls } from "@/steam/library/library-controls";
import { LibraryGridVirtual } from "@/steam/library/library-grid-virtual";
import { LibraryListVirtual } from "@/steam/library/library-list-virtual";
import { LibrarySkeleton } from "@/steam/library/library-skeleton";
import { useLibraryPrefs } from "@/steam/library/use-library-prefs";
import { useSteamOwnedGames } from "@/steam/use-owned-games";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";

export const Route = createFileRoute("/steam/library")({
  component: LibraryPage,
});

function LibraryPage() {
  const { data, isPending, isError } = useSteamOwnedGames();
  const [{ layout, sort, playedFilter, appTypeFilter, selectedTagIds }, updatePref] =
    useLibraryPrefs();
  const [query, setQuery] = useState("");

  const games = data?.games ?? [];
  // The denominator on "X of Y items" should reflect the active type filter
  // ("Games"/"Tools") — otherwise it includes the other type and reads as a
  // bug ("167 of 175 games" when 8 of those 175 are tools).
  const typedTotal = useMemo(() => {
    if (appTypeFilter === "all") return games.length;
    if (appTypeFilter === "game")
      return games.filter((g) => g.appType === null || g.appType === 0).length;
    return games.filter((g) => g.appType === 6).length;
  }, [games, appTypeFilter]);
  const visible = useMemo(
    () =>
      applyLibraryFilters(games, {
        query,
        sort,
        playedFilter,
        appTypeFilter,
        selectedTagIds,
      }),
    [games, query, sort, playedFilter, appTypeFilter, selectedTagIds]
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">Owned games</h1>
        <p className="text-sm text-muted-foreground">
          Currently-owned Steam library. Search, sort, and filter to find a specific title
          or slice.
        </p>
      </div>

      {isPending && <LibrarySkeleton layout={layout} />}

      {isError && (
        <p className="text-sm text-destructive">Library is unavailable right now.</p>
      )}

      {data && data.games.length === 0 && (
        <EmptyState
          illustration={<EmptyLibraryIllustration />}
          title="Library hasn't synced yet"
          hint="First poll lands at 04:00 Brussels time."
        />
      )}

      {data && data.games.length > 0 && (
        <>
          <LibraryControls
            games={data.games}
            query={query}
            onQueryChange={setQuery}
            sort={sort}
            onSortChange={(v) => updatePref("sort", v)}
            playedFilter={playedFilter}
            onPlayedFilterChange={(v) => updatePref("playedFilter", v)}
            appTypeFilter={appTypeFilter}
            onAppTypeFilterChange={(v) => updatePref("appTypeFilter", v)}
            selectedTagIds={selectedTagIds}
            onSelectedTagIdsChange={(v) => updatePref("selectedTagIds", v)}
            layout={layout}
            onLayoutChange={(v) => updatePref("layout", v)}
            totalCount={typedTotal}
            visibleCount={visible.length}
          />

          {visible.length === 0 ? (
            <EmptyState
              illustration={<EmptyLibraryIllustration />}
              title="No games match the current filters"
              hint="Try clearing a tag or switching the played filter."
            />
          ) : layout === "tiles" ? (
            <LibraryGridVirtual games={visible} />
          ) : (
            <LibraryListVirtual games={visible} />
          )}
        </>
      )}
    </div>
  );
}
