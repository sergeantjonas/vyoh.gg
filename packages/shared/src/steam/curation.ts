// The owner's per-game overlay on Steam data. Two axes, deliberately kept
// independent:
//
// - **hidden** — a privacy decision. The game is never named to a visitor on
//   any surface: not in the library, the wishlist, achievements, a recap
//   chapter, or the now-playing strip. Its hours still land in aggregate
//   totals, anonymously, so hiding a game doesn't quietly deflate lifetime
//   playtime or punch a hole in the chronotype.
// - **unfeatured** — an editorial decision. The game is listed normally; it
//   just never gets promoted to a subject chapter on `/`.
//
// Hiding implies unfeaturing — a chapter names its subject, so a hidden game
// can't be one. Unfeaturing implies nothing about privacy. Collapsing the two
// into a single flag would lose "fine in my library, just don't make it a hero
// chapter" — a real and common state, and the one every game curated away from
// `/` for being stale rather than private is in. It would also mean that
// un-hiding a game silently re-promotes it to chapter material.
//
// Repo-conventions § "Centralise domain invariants that must apply to every
// aggregation in a feature" governs the filters below: every itemized Steam
// read path must route through `excludeHiddenGames()` rather than re-deriving
// the membership test inline, and `apps/api/src/conventions.spec.ts` lints for
// it. Iterate the helper (`for (const g of excludeHiddenGames(games, c))`) —
// don't guard inside the loop with a `continue`, which hides from the lint.

/**
 * Appid sets the read paths filter against. Sets rather than arrays because
 * every consumer is a membership test inside a filter, run per row.
 */
export type SteamCurationSets = {
  hidden: ReadonlySet<number>;
  unfeatured: ReadonlySet<number>;
};

const EMPTY: ReadonlySet<number> = new Set();

/** No overlay at all. For tests, and for read paths that have not been wired. */
export const NO_CURATION: SteamCurationSets = { hidden: EMPTY, unfeatured: EMPTY };

/**
 * The owner's own view of their data: privacy filtering off, editorial curation
 * still on. An unfeatured game is a layout decision about `/`, not a secret —
 * the owner doesn't want a stale chapter either.
 */
export function curationForOwner(curation: SteamCurationSets): SteamCurationSets {
  return { hidden: EMPTY, unfeatured: curation.unfeatured };
}

export function isHiddenGame(appid: number, curation: SteamCurationSets): boolean {
  return curation.hidden.has(appid);
}

/** Drops privacy-hidden games. The filter for every itemized read path. */
export function excludeHiddenGames<T extends { appid: number }>(
  games: readonly T[],
  curation: SteamCurationSets
): T[] {
  return games.filter((g) => !curation.hidden.has(g.appid));
}

/**
 * Drops everything ineligible for a subject chapter on `/` — a superset of
 * `excludeHiddenGames`, because hiding implies unfeaturing.
 */
export function excludeUnfeaturedGames<T extends { appid: number }>(
  games: readonly T[],
  curation: SteamCurationSets
): T[] {
  return games.filter(
    (g) => !curation.hidden.has(g.appid) && !curation.unfeatured.has(g.appid)
  );
}
