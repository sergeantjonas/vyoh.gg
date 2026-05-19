import type { SteamWishlistItem } from "@vyoh/shared";

const DATE_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Europe/Brussels",
});

export function formatWishlistDateAdded(epochSeconds: number): string {
  return DATE_FORMATTER.format(new Date(epochSeconds * 1_000));
}

export function formatWishlistReleaseLabel(item: SteamWishlistItem): string | null {
  // For coming-soon titles Steam's `steam_release_date` is usually a placeholder
  // (Dec 31 of the target year for "later this year", quarter-end dates for
  // "Q3 2026", etc.) — claiming month precision would lie about a value Steam
  // itself doesn't commit to. Surface year only when comingSoon is true.
  if (item.comingSoon) {
    return item.releaseDate !== null
      ? `Coming ${new Date(item.releaseDate * 1_000).getUTCFullYear()}`
      : "Coming soon";
  }
  if (item.releaseDate !== null) {
    return `Released ${new Date(item.releaseDate * 1_000).getUTCFullYear()}`;
  }
  return null;
}
