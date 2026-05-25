import { EmptyLibraryIllustration, EmptyState } from "@/components/empty-state";
import { mainScrollRef } from "@/lib/scroll-container";
import { withReorderViewTransition } from "@/lib/view-transition-nav";
import { useActiveGame } from "@/steam/library/active-game-context";
import { applyLibraryFilters } from "@/steam/library/apply-filters";
import { LibraryControls } from "@/steam/library/library-controls";
import { LibraryGridVirtual } from "@/steam/library/library-grid-virtual";
import { LibraryListVirtual } from "@/steam/library/library-list-virtual";
import { LibrarySkeleton } from "@/steam/library/library-skeleton";
import { useLibraryPrefs } from "@/steam/library/use-library-prefs";
import { useSteamOwnedGames } from "@/steam/use-owned-games";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

// While the back-nav scroll-restore + hero/logo→row morph play out, dim
// non-active rows so the morph travels through an emptier strip. Mirrors
// match-list's pattern (~32ms epoch + ~600ms spring settle, plus buffer).
// Row-layout only: the tile layout intentionally skips the morph so
// nothing dims there.
const SETTLE_HOLD_MS = 800;

export const Route = createFileRoute("/steam/library")({
  component: LibraryPage,
});

function LibraryPage() {
  const { data, isPending, isError } = useSteamOwnedGames();
  const [{ layout, sort, playedFilter, appTypeFilter, selectedTagIds }, updatePref] =
    useLibraryPrefs();
  const [query, setQuery] = useState("");
  const { readListScroll } = useActiveGame();
  // Snapshot the saved scrollTop once on mount. If we landed here via a
  // back-nav from /steam/game/$appid, this is > 0 and drives both the
  // synchronous scrollTo below and the settle dim. Otherwise we render
  // settled at opacity 1 from the first paint.
  const [restoredScrollY] = useState(() => readListScroll());
  const [settled, setSettled] = useState(() => restoredScrollY <= 0);
  const didInitialScrollRef = useRef(false);
  // See match-list.tsx for the StrictMode rationale on this guard pattern:
  // marks complete only after a RAF tick actually ran so the remount can
  // restart the loop if it was torn down before the first frame fired.
  const pinCompletedRef = useRef(false);

  // Sync scrollTo before the next paint. The main scroll container is
  // shared across routes, so its scrollTop still reflects the detail
  // page's value (typically 0) until we override it here. The pin loop
  // below re-asserts the target across the next ~600ms while the
  // virtualizer's totalSize fills in.
  if (!didInitialScrollRef.current && restoredScrollY > 0) {
    didInitialScrollRef.current = true;
    mainScrollRef.current?.scrollTo(0, restoredScrollY);
  }

  useLayoutEffect(() => {
    if (pinCompletedRef.current) return;
    const container = mainScrollRef.current;
    if (restoredScrollY <= 0 || !container) return;
    const target = restoredScrollY;
    container.scrollTo(0, target);
    let cancelled = false;
    let pinTicks = 0;
    let maxDrift = 0;
    const pinUntil = performance.now() + 600;
    const pin = () => {
      if (cancelled) return;
      if (performance.now() > pinUntil) {
        console.log("[back-morph] pin done", {
          ticks: pinTicks,
          finalScrollTop: container.scrollTop,
          target,
          maxDrift,
        });
        pinCompletedRef.current = true;
        return;
      }
      pinTicks++;
      const drift = container.scrollTop - target;
      if (Math.abs(drift) > Math.abs(maxDrift)) maxDrift = drift;
      if (Math.abs(drift) > 1) container.scrollTo(0, target);
      requestAnimationFrame(pin);
    };
    requestAnimationFrame(pin);
    return () => {
      cancelled = true;
      if (pinTicks > 0) pinCompletedRef.current = true;
    };
  }, [restoredScrollY]);

  useEffect(() => {
    if (settled) return;
    const id = window.setTimeout(() => setSettled(true), SETTLE_HOLD_MS);
    return () => window.clearTimeout(id);
  }, [settled]);

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
            onSortChange={(v) => withReorderViewTransition(() => updatePref("sort", v))}
            playedFilter={playedFilter}
            onPlayedFilterChange={(v) =>
              withReorderViewTransition(() => updatePref("playedFilter", v))
            }
            appTypeFilter={appTypeFilter}
            onAppTypeFilterChange={(v) =>
              withReorderViewTransition(() => updatePref("appTypeFilter", v))
            }
            selectedTagIds={selectedTagIds}
            onSelectedTagIdsChange={(v) =>
              withReorderViewTransition(() => updatePref("selectedTagIds", v))
            }
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
            <LibraryListVirtual games={visible} settled={settled} />
          )}
        </>
      )}
    </div>
  );
}
