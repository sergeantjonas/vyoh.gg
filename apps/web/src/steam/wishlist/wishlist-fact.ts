import type { SteamUpcomingItem } from "@vyoh/shared";

import { type CivilDate, groupUpcoming } from "@/steam/wishlist/upcoming/bucketing";

// The Steam profile's Wishlist chip leads with a forward-looking *fact*, not a
// count (§ Profile tile reframe). `pickWishlistFact` resolves the single most
// salient thing coming up — over the merged upcoming set, not the wishlist, for
// the same reason the calendar does: a pre-ordered game is deleted from the
// wishlist, and it is exactly the release most likely to be nearest. Naming the
// second-nearest title "next up" is the reported bug in miniature.
//
// Certainty-priority order:
//
//   1. imminent — nearest day-precise release within 30 days ("Next up …").
//   2. dated    — nearest day-precise release within 90 days ("Coming {Month D}").
//   4. waiting  — longest-waiting TBA item by dateAdded ("Still waiting on …").
//
// Tier 3 from the spec ("N launches in {Month}" when ≥5 day-precise items land
// in one near month) is intentionally omitted. A personal-scale wishlist never
// clusters 5 day-precise releases into a single near month: a 2026-06-12 gate
// over the live wishlist measured a max near-month density of 4 against the ≥5
// threshold, and the upper bound (counting every dated item as day-precise) was
// also 4. The branch is structurally unreachable, so it would be dead code
// guarded by a test that never exercises the real path. Re-add it only if a real
// dataset ever crosses the threshold.
//
// Returns null when nothing forward-looking qualifies — no day-precise release
// within 90 days and no TBA item — so the caller can keep its backlog-age
// framing on the oldest entry.

export type WishlistFact =
  | { kind: "imminent"; item: SteamUpcomingItem; daysUntil: number }
  | { kind: "dated"; item: SteamUpcomingItem; date: CivilDate }
  | { kind: "waiting"; item: SteamUpcomingItem };

const IMMINENT_HORIZON_DAYS = 30;
const DATED_HORIZON_DAYS = 90;

export function pickWishlistFact(
  items: SteamUpcomingItem[],
  now: Date
): WishlistFact | null {
  const { dayReleases, tba } = groupUpcoming(items, now);

  // dayReleases is sorted ascending by releaseDate, so the first non-past entry
  // is the nearest future day-precise release.
  const nearest = dayReleases.find((release) => !release.isPast) ?? null;
  if (nearest) {
    if (nearest.daysUntil <= IMMINENT_HORIZON_DAYS) {
      return { kind: "imminent", item: nearest.item, daysUntil: nearest.daysUntil };
    }
    if (nearest.daysUntil <= DATED_HORIZON_DAYS) {
      return { kind: "dated", item: nearest.item, date: nearest.date };
    }
  }

  // Tier 4 fallback: the longest-waiting TBA item (smallest dateAdded). "Still
  // waiting on …" is a real piece of identity — it beats a bare count even when
  // nothing is dated within the horizon.
  if (tba.length > 0) {
    const oldest = tba.reduce((a, b) => (b.dateAdded < a.dateAdded ? b : a));
    return { kind: "waiting", item: oldest };
  }

  return null;
}
