import { applyLibraryFilters } from "@/steam/library/apply-filters";
import { LibraryControls } from "@/steam/library/library-controls";
import { LibraryRow } from "@/steam/library/library-row";
import { LibraryTile } from "@/steam/library/library-tile";
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

      {isPending && <p className="text-sm text-muted-foreground">Loading library…</p>}

      {isError && (
        <p className="text-sm text-destructive">Library is unavailable right now.</p>
      )}

      {data && data.games.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Library hasn't synced yet — first poll lands at 04:00 Brussels time.
        </p>
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
            <p className="text-sm text-muted-foreground">
              No games match the current filters.
            </p>
          ) : layout === "tiles" ? (
            <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {visible.map((game) => (
                <LibraryTile key={game.appid} game={game} />
              ))}
            </ul>
          ) : (
            <ul className="flex flex-col divide-y divide-border/40 rounded-lg border bg-card/50">
              {visible.map((game) => (
                <LibraryRow key={game.appid} game={game} />
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
