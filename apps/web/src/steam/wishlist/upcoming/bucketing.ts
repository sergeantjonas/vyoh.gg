import {
  type ReleasePrecision,
  type SteamWishlistItem,
  classifyReleasePrecision,
} from "@vyoh/shared";
import { OWNER_TIME_ZONE } from "@vyoh/shared";

// Date-bucketing for the `/steam/wishlist` Upcoming view. Pure functions of
// `(items, now)` — no network, no DB — so they're cheap to recompute on every
// render and trivial to test. See docs/working-notes/steam/wishlist-upcoming.md
// § Upcoming view composition.
//
// Two timezone frames coexist here on purpose, and conflating them is the
// most visible possible bug on this page (§ Imminent hero):
//
//   - "Today" uses **Europe/Brussels** civil boundaries — the owner-local day
//     flips at Brussels midnight, not UTC midnight. A release "in 1 day" must
//     read as 1 for the owner, not 0 because it's still yesterday in UTC.
//   - A release placeholder is read as its **UTC** civil date, matching
//     classifyReleasePrecision / formatWishlistReleaseLabel: a Steam "Aug 3"
//     timestamp is Aug 3 for everyone, never shifted a day under a tz offset.
//
// Both reduce to a civil (year, month, day) triple; days-until is then a plain
// calendar diff between the two triples, DST-immune because each triple is
// re-anchored to UTC midnight before subtracting.

export interface CivilDate {
  year: number;
  // 0 = January, matching Date.getUTCMonth().
  month: number;
  day: number;
}

const BRUSSELS_PARTS = new Intl.DateTimeFormat("en-US", {
  timeZone: OWNER_TIME_ZONE,
  year: "numeric",
  month: "numeric",
  day: "numeric",
});

/**
 * The owner-local (Europe/Brussels) civil date of an instant. Used for "today"
 * so the day boundary flips at Brussels midnight.
 */
export function brusselsCivilDate(now: Date): CivilDate {
  const parts = BRUSSELS_PARTS.formatToParts(now);
  const get = (type: string) =>
    Number.parseInt(parts.find((p) => p.type === type)?.value ?? "", 10);
  return { year: get("year"), month: get("month") - 1, day: get("day") };
}

/**
 * The UTC civil date of a release placeholder timestamp (Unix seconds). Matches
 * how the precision classifier and label formatter read the placeholder.
 */
export function utcCivilDate(epochSeconds: number): CivilDate {
  const date = new Date(epochSeconds * 1_000);
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth(),
    day: date.getUTCDate(),
  };
}

/** Whole-day signed difference `a - b`, DST-immune (both re-anchored to UTC midnight). */
export function civilDayDiff(a: CivilDate, b: CivilDate): number {
  const MS_PER_DAY = 86_400_000;
  const aMs = Date.UTC(a.year, a.month, a.day);
  const bMs = Date.UTC(b.year, b.month, b.day);
  return Math.round((aMs - bMs) / MS_PER_DAY);
}

/**
 * Signed days until a release: positive = future, 0 = today, negative = already
 * passed (a ghosted-past wishlist item). Brussels boundary for today, UTC civil
 * for the release.
 */
export function daysUntilRelease(releaseDate: number, now: Date): number {
  return civilDayDiff(utcCivilDate(releaseDate), brusselsCivilDate(now));
}

// Absolute month ordinal — lets month comparisons cross year boundaries with
// plain integer math (June 2026 = 24318, Jan 2027 = 24324).
function monthOrdinal(year: number, month: number): number {
  return year * 12 + month;
}

/** Quarter (1..4) containing a 0-based month. */
function quarterOfMonth(month: number): number {
  return Math.floor(month / 3) + 1;
}

export interface DayRelease {
  item: SteamWishlistItem;
  // UTC civil date the title is slated to launch on (calendar-cell key).
  date: CivilDate;
  // Brussels-today days-until; negative once the date has passed.
  daysUntil: number;
  // daysUntil < 0 — still wishlisted but the date slipped past, rendered as a
  // desaturated "released N days ago" ghost per the open-question decision.
  isPast: boolean;
}

export interface QuarterBand {
  year: number;
  // 1..4
  quarter: number;
  // month- and quarter-precision items, chronological within the band.
  items: SteamWishlistItem[];
}

export interface YearBand {
  year: number;
  items: SteamWishlistItem[];
}

export interface UpcomingBuckets {
  // Every day-precise still-wishlisted title, including past ghosts, sorted by
  // release date ascending. The calendar renders whichever fall in its window;
  // the imminent hero (chunk 4) picks the nearest future one.
  dayReleases: DayRelease[];
  // Month/quarter precision, one band per (year, quarter), chronological.
  quarterBands: QuarterBand[];
  // Year precision, one band per year, ascending.
  yearBands: YearBand[];
  // No committed date — the watching pile. Recency order (newest add first).
  tba: SteamWishlistItem[];
}

const RELEASE_SORT = (a: SteamWishlistItem, b: SteamWishlistItem) =>
  (a.releaseDate ?? 0) - (b.releaseDate ?? 0);

/**
 * Partition a wishlist into the Upcoming view's tiers. Already-released titles
 * (`comingSoon === false`, precision `null`) are dropped — they belong to the
 * `All` tab, not the upcoming pipeline.
 */
export function groupUpcoming(items: SteamWishlistItem[], now: Date): UpcomingBuckets {
  const dayReleases: DayRelease[] = [];
  const quarterMap = new Map<number, QuarterBand>();
  const yearMap = new Map<number, YearBand>();
  const tba: SteamWishlistItem[] = [];

  for (const item of items) {
    const precision: ReleasePrecision | null = classifyReleasePrecision(item);
    if (precision === null) continue; // already released — out of scope

    if (precision === "tba" || item.releaseDate === null) {
      tba.push(item);
      continue;
    }

    if (precision === "day") {
      const daysUntil = daysUntilRelease(item.releaseDate, now);
      dayReleases.push({
        item,
        date: utcCivilDate(item.releaseDate),
        daysUntil,
        isPast: daysUntil < 0,
      });
      continue;
    }

    if (precision === "month" || precision === "quarter") {
      const civil = utcCivilDate(item.releaseDate);
      const quarter = quarterOfMonth(civil.month);
      const key = monthOrdinal(civil.year, (quarter - 1) * 3);
      const band = quarterMap.get(key);
      if (band) band.items.push(item);
      else quarterMap.set(key, { year: civil.year, quarter, items: [item] });
      continue;
    }

    // precision === "year"
    const year = utcCivilDate(item.releaseDate).year;
    const band = yearMap.get(year);
    if (band) band.items.push(item);
    else yearMap.set(year, { year, items: [item] });
  }

  dayReleases.sort((a, b) => (a.item.releaseDate ?? 0) - (b.item.releaseDate ?? 0));

  const quarterBands = [...quarterMap.values()].sort(
    (a, b) => monthOrdinal(a.year, a.quarter) - monthOrdinal(b.year, b.quarter)
  );
  for (const band of quarterBands) band.items.sort(RELEASE_SORT);

  const yearBands = [...yearMap.values()].sort((a, b) => a.year - b.year);
  for (const band of yearBands) band.items.sort(RELEASE_SORT);

  // Newest-added first — the watching pile reads as "what caught my eye lately".
  tba.sort((a, b) => b.dateAdded - a.dateAdded);

  return { dayReleases, quarterBands, yearBands, tba };
}

/**
 * First day of the month the calendar should open on. Defaults to the current
 * Brussels month; if the default `monthsVisible`-month window holds fewer than
 * `minItems` future day-releases (§ sparse-state rule — no empty grids), shift
 * the anchor to the nearest future month that actually holds one. Falls back to
 * the current month when there are no future day-releases at all.
 */
export function pickCalendarAnchor(
  dayReleases: DayRelease[],
  today: CivilDate,
  monthsVisible = 2,
  minItems = 2
): CivilDate {
  const todayOrdinal = monthOrdinal(today.year, today.month);
  const windowEnd = todayOrdinal + monthsVisible - 1;

  const futureMonthOrdinals = dayReleases
    .filter((r) => !r.isPast)
    .map((r) => monthOrdinal(r.date.year, r.date.month));

  const inDefaultWindow = futureMonthOrdinals.filter(
    (ord) => ord >= todayOrdinal && ord <= windowEnd
  ).length;

  if (inDefaultWindow >= minItems) {
    return { year: today.year, month: today.month, day: 1 };
  }

  const nearestFuture = futureMonthOrdinals
    .filter((ord) => ord >= todayOrdinal)
    .sort((a, b) => a - b)[0];

  if (nearestFuture === undefined) {
    return { year: today.year, month: today.month, day: 1 };
  }
  return { year: Math.floor(nearestFuture / 12), month: nearestFuture % 12, day: 1 };
}

// The imminent hero's candidate (chunk 4): the nearest *future* day-precise
// release, but only when it's close enough to earn the cover-story treatment.
// Past-but-still-wishlisted titles (the desaturated calendar ghosts) never
// qualify — the hero is forward-looking. Returns null when nothing day-precise
// lands inside the horizon, which is the documented hero-skip case (the page
// then leads with the calendar). `daysUntil` is Brussels-today framed, so the
// horizon comparison stays in the owner's civil frame.
export const IMMINENT_HORIZON_DAYS = 60;

export function pickImminentRelease(
  dayReleases: DayRelease[],
  horizonDays = IMMINENT_HORIZON_DAYS
): DayRelease | null {
  let best: DayRelease | null = null;
  for (const release of dayReleases) {
    if (release.isPast || release.daysUntil > horizonDays) continue;
    if (best === null || release.daysUntil < best.daysUntil) best = release;
  }
  return best;
}
