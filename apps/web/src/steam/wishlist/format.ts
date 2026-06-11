import { type SteamWishlistItem, classifyReleasePrecision } from "@vyoh/shared";

import type { WishlistFact } from "@/steam/wishlist/wishlist-fact";

const DATE_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Europe/Brussels",
});

// Release-date labels format the placeholder timestamp in UTC, matching the
// precision classifier — a Steam "Aug 3" placeholder must read as Aug 3, never
// shift a day under a tz offset (see classifyReleasePrecision).
const RELEASE_DAY_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

export function formatWishlistDateAdded(epochSeconds: number): string {
  return DATE_FORMATTER.format(new Date(epochSeconds * 1_000));
}

export function formatWishlistReleaseLabel(item: SteamWishlistItem): string | null {
  const precision = classifyReleasePrecision(item);

  // null precision === already released. Released titles keep year-only framing.
  if (precision === null) {
    return item.releaseDate !== null
      ? `Released ${new Date(item.releaseDate * 1_000).getUTCFullYear()}`
      : null;
  }
  if (precision === "tba" || item.releaseDate === null) return "Coming soon";

  const date = new Date(item.releaseDate * 1_000);
  switch (precision) {
    case "year":
      return `Coming ${date.getUTCFullYear()}`;
    case "quarter":
      return `Coming Q${Math.floor(date.getUTCMonth() / 3) + 1} ${date.getUTCFullYear()}`;
    default:
      // `day` (and `month` until a placeholder shape surfaces) renders the
      // concrete date — the diagnosed fix for day-precise titles that used to
      // collapse to "Coming <year>".
      return `Coming ${RELEASE_DAY_FORMATTER.format(date)}`;
  }
}

// Month + day only (no year), UTC-framed to match RELEASE_DAY_FORMATTER — a
// near-term release reads "Coming Aug 3", the year is implied by proximity.
const RELEASE_MONTH_DAY_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

// The verdict sentence for the profile Wishlist chip's forward-looking fact
// (§ Profile tile reframe). Mirrors the certainty ladder in pickWishlistFact:
// the nearer the release, the more precise the framing.
export function formatWishlistFact(fact: WishlistFact): string {
  const name = fact.item.name ?? "an untitled game";
  switch (fact.kind) {
    case "imminent":
      if (fact.daysUntil <= 0) return `Next up: ${name}, out today.`;
      if (fact.daysUntil === 1) return `Next up: ${name}, out tomorrow.`;
      return `Next up: ${name}, in ${fact.daysUntil} days.`;
    case "dated": {
      const when = RELEASE_MONTH_DAY_FORMATTER.format(
        new Date(Date.UTC(fact.date.year, fact.date.month, fact.date.day))
      );
      return `Coming ${when}: ${name}.`;
    }
    case "waiting":
      return `Still waiting on ${name}.`;
  }
}
