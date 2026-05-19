import type { SteamOwnedGame } from "@vyoh/shared";

export function applyLibraryFilters(
  games: SteamOwnedGame[],
  opts: {
    query: string;
    sort: "lifetime" | "name" | "twoWeeks";
    playedFilter: "all" | "played" | "never";
    appTypeFilter: "all" | "game" | "app";
    selectedTagIds: number[];
  }
): SteamOwnedGame[] {
  const q = opts.query.trim().toLowerCase();
  // OR-match within the selected set — a game qualifies if it carries any one
  // of the selected tags. Mirrors how Steam's own library filter behaves and
  // keeps narrow selections useful (AND-matching would empty the list fast).
  const tagSet = opts.selectedTagIds.length === 0 ? null : new Set(opts.selectedTagIds);
  const filtered = games.filter((g) => {
    if (opts.playedFilter === "played" && g.playtimeForeverMinutes === 0) return false;
    if (opts.playedFilter === "never" && g.playtimeForeverMinutes > 0) return false;
    // Unenriched titles (appType === null) fall under "game" — the assumption
    // is correct for ~99% of newly-added apps and avoids them disappearing
    // from the default view in the window between owned-sync and enrichment.
    if (opts.appTypeFilter === "game" && g.appType !== null && g.appType !== 0)
      return false;
    if (opts.appTypeFilter === "app" && g.appType !== 6) return false;
    if (tagSet !== null && !g.tagIds.some((t) => tagSet.has(t))) return false;
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
