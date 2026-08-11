// The upcoming-releases surface. Returned by GET /api/steam/upcoming.
//
// Merges two provenances, because neither one holds the full set. The wishlist
// carries titles the owner is watching; the library carries pre-purchases —
// Steam deletes the wishlist entry the moment you buy the game, so a pre-ordered
// title exists *only* in the library while it is still unreleased. Surviving
// that deletion is the reason this route is separate from /steam/wishlist.

export type SteamUpcomingSource = "wishlist" | "owned";

// Field names deliberately mirror SteamWishlistItem so this stays a structural
// superset of it: `classifyReleasePrecision` and the bucketing/tile renderers
// accept either item without a widened signature. `priority` is the one wishlist
// field left out — it orders the full list, and has no owned-side equivalent.
export interface SteamUpcomingItem {
  appid: number;
  name: string | null;
  storeUrl: string;
  // Unix seconds (UTC); null when Steam publishes no date at all (TBA or
  // pre-announcement). Analysed in UTC — see classifyReleasePrecision.
  releaseDate: number | null;
  // Always true in this payload, since the route filters on it. Carried rather
  // than implied because Steam holds the flag up past `releaseDate` until its
  // launch sweep runs, so a client rendering a cached payload still needs it to
  // tell "releases Thursday" from "released, Steam hasn't swept yet".
  comingSoon: boolean;
  // When the title entered the owner's orbit: the wishlist add date for
  // `wishlist`, the first library sighting for `owned` — which, for something
  // still unreleased, is effectively when it was pre-ordered. Both are
  // additions. Orders the TBA pile, where there is no release date to sort on.
  dateAdded: number;
  source: SteamUpcomingSource;
}

export interface SteamUpcoming {
  steamId: string;
  items: SteamUpcomingItem[];
  // Unix millis of the wishlist upstream pull — the only live Steam call behind
  // this payload. The owned side is a DB read, so its own freshness is bounded
  // by the enrichment poller's daily refresh of coming-soon rows instead.
  fetchedAt: number;
}
