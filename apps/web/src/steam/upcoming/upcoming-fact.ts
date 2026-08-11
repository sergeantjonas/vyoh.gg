import type { SteamUpcomingItem } from "@vyoh/shared";

import { type CivilDate, groupUpcoming, isPreOrdered } from "@/steam/upcoming/bucketing";

// The Steam profile's "On the radar" chip leads with a forward-looking *fact*,
// not a count (§ Profile tile reframe). `pickUpcomingFact` resolves the single
// most salient thing coming up, over the merged upcoming set: a pre-ordered game
// is deleted from the wishlist, and it is exactly the release most likely to be
// nearest. Naming the second-nearest title "next up" is the reported bug in
// miniature.
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

export type UpcomingFact =
  | { kind: "imminent"; item: SteamUpcomingItem; daysUntil: number }
  | { kind: "dated"; item: SteamUpcomingItem; date: CivilDate }
  | { kind: "waiting"; item: SteamUpcomingItem };

const IMMINENT_HORIZON_DAYS = 30;
const DATED_HORIZON_DAYS = 90;

export function pickUpcomingFact(
  items: SteamUpcomingItem[],
  now: Date
): UpcomingFact | null {
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

// Month + day only (no year), UTC-framed to match the release-date classifier —
// a near-term release reads "Coming Aug 3", the year implied by proximity.
const RELEASE_MONTH_DAY_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

/**
 * The chip's verdict sentence. Mirrors the certainty ladder above — the nearer
 * the release, the more precise the framing — and splits the dated tiers by
 * provenance, because "next up" and "already bought" are different states and
 * the chip is the one surface that knows which it is looking at.
 */
export function formatUpcomingFact(fact: UpcomingFact): string {
  const name = fact.item.name ?? "an untitled game";
  const owned = isPreOrdered(fact.item);
  switch (fact.kind) {
    case "imminent": {
      const lead = owned ? `Already yours: ${name}` : `Next up: ${name}`;
      if (fact.daysUntil <= 0) return `${lead}, out today.`;
      if (fact.daysUntil === 1) return `${lead}, out tomorrow.`;
      return `${lead}, in ${fact.daysUntil} days.`;
    }
    case "dated": {
      const when = RELEASE_MONTH_DAY_FORMATTER.format(
        new Date(Date.UTC(fact.date.year, fact.date.month, fact.date.day))
      );
      return owned ? `Bought, lands ${when}: ${name}.` : `Coming ${when}: ${name}.`;
    }
    // No provenance split: Steam has never yet reported a pre-order with no
    // date at all, so there is no phrasing here to test against a real shape.
    case "waiting":
      return `Still waiting on ${name}.`;
  }
}
