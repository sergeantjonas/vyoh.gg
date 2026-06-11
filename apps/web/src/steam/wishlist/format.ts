import { type SteamWishlistItem, classifyReleasePrecision } from "@vyoh/shared";

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
