import { LibraryControls } from "@/steam/library/library-controls";
import { LibraryRow } from "@/steam/library/library-row";
import { LibraryTile } from "@/steam/library/library-tile";
import { useLibraryPrefs } from "@/steam/library/use-library-prefs";
import { useSteamOwnedGames } from "@/steam/use-owned-games";
import { createFileRoute } from "@tanstack/react-router";
import type { SteamOwnedGame } from "@vyoh/shared";
import { useMemo, useState } from "react";

export const Route = createFileRoute("/steam/library")({
  component: LibraryPage,
});

function LibraryPage() {
  const { data, isPending, isError } = useSteamOwnedGames();
  const [{ layout, sort, playedFilter }, updatePref] = useLibraryPrefs();
  const [query, setQuery] = useState("");

  const games = data?.games ?? [];
  const visible = useMemo(
    () => applyFilters(games, { query, sort, playedFilter }),
    [games, query, sort, playedFilter]
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
            query={query}
            onQueryChange={setQuery}
            sort={sort}
            onSortChange={(v) => updatePref("sort", v)}
            playedFilter={playedFilter}
            onPlayedFilterChange={(v) => updatePref("playedFilter", v)}
            layout={layout}
            onLayoutChange={(v) => updatePref("layout", v)}
            totalCount={data.games.length}
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

function applyFilters(
  games: SteamOwnedGame[],
  opts: {
    query: string;
    sort: "lifetime" | "name" | "twoWeeks";
    playedFilter: "all" | "played" | "never";
  }
): SteamOwnedGame[] {
  const q = opts.query.trim().toLowerCase();
  const filtered = games.filter((g) => {
    if (opts.playedFilter === "played" && g.playtimeForeverMinutes === 0) return false;
    if (opts.playedFilter === "never" && g.playtimeForeverMinutes > 0) return false;
    if (q !== "" && !g.name.toLowerCase().includes(q)) return false;
    return true;
  });

  if (opts.sort === "name") {
    return [...filtered].sort((a, b) =>
      a.name.localeCompare(b.name, "en", { sensitivity: "base" })
    );
  }
  if (opts.sort === "twoWeeks") {
    return [...filtered].sort(
      (a, b) => (b.playtime2WeeksMinutes ?? 0) - (a.playtime2WeeksMinutes ?? 0)
    );
  }
  // lifetime — endpoint already returns lifetime-desc but we re-sort defensively
  // after filtering so the order is stable regardless of upstream contract.
  return [...filtered].sort(
    (a, b) => b.playtimeForeverMinutes - a.playtimeForeverMinutes
  );
}
