// Public-profile wishlist surface. Returned by GET /api/steam/wishlist.
//
// Backed by two Steam Web API calls: IWishlistService/GetWishlist (appid + date_added
// + priority) and IStoreBrowseService/GetItems (appid -> name). Names can be null when
// GetItems returns success=0 for an item (region-restricted, delisted, or hidden); the
// frontend renders these honestly rather than dropping the row.

export interface SteamWishlistItem {
  appid: number;
  name: string | null;
  // Unix seconds (UTC). Frontend formats in Europe/Brussels (owner timezone).
  dateAdded: number;
  // 0 means unprioritized; 1..N is explicit ordering set by the owner on Steam.
  priority: number;
  storeUrl: string;
  // Unix seconds (UTC) when Steam has committed a release date; null for titles
  // without a published date (TBA or pre-announcement). Frontend formats this
  // in Europe/Brussels. Independent of `comingSoon` — Steam can flag a title as
  // coming-soon *and* have a target date, or have a date without the flag (the
  // common case for already-released titles).
  releaseDate: number | null;
  // True when Steam still classifies the title as unreleased (the store
  // "Coming soon" badge). Stays true past `releaseDate` until Steam flips it on
  // the actual launch sweep.
  comingSoon: boolean;
}

export interface SteamWishlist {
  steamId: string;
  items: SteamWishlistItem[];
  fetchedAt: number;
}

// Release-date precision tier for the `/steam/wishlist` Upcoming view. The tier
// a still-unreleased title falls into drives which surface renders it: `day` →
// calendar cell + imminent-hero candidate; `month`/`quarter` → quarter band;
// `year` → year band; `tba` → the watching pile. See
// docs/working-notes/steam/wishlist-upcoming.md § Precision tier model.
export type ReleasePrecision = "day" | "month" | "quarter" | "year" | "tba";

/**
 * Classify a wishlist item's release-date precision for the Upcoming view.
 *
 * Returns `null` for already-released titles (`comingSoon === false`) — they sit
 * outside the upcoming pipeline and carry no tier. This is computed on read (no
 * DB persistence): the tier is a pure function of `(releaseDate, comingSoon)`,
 * so a date firming up or slipping — or Steam clearing it back to TBA — re-derives
 * on the next fetch with no explicit invalidation.
 *
 * The date is analysed in **UTC**, matching how Steam stores the placeholder
 * timestamps it uses for imprecise dates:
 * - Dec 31 → "later this year" placeholder → `year` (also where a bare "Q4 YYYY"
 *   lands; the year band is the safer default when a year and Q4 are upstream-
 *   indistinguishable).
 * - Mar 31 / Jun 30 / Sep 30 → quarter-end placeholder → `quarter`.
 * - any other concrete date → `day`.
 *
 * No `month`-tier rule yet: the current wishlist holds no first-/last-of-month
 * placeholder; add a detection branch when a concrete example surfaces. The enum
 * retains `month` for that future case.
 */
export function classifyReleasePrecision(
  item: Pick<SteamWishlistItem, "releaseDate" | "comingSoon">
): ReleasePrecision | null {
  if (!item.comingSoon) return null;
  if (item.releaseDate === null) return "tba";

  const date = new Date(item.releaseDate * 1_000);
  const month = date.getUTCMonth(); // 0 = January
  const day = date.getUTCDate();

  if (month === 11 && day === 31) return "year";
  if (
    (month === 2 && day === 31) ||
    (month === 5 && day === 30) ||
    (month === 8 && day === 30)
  ) {
    return "quarter";
  }
  return "day";
}
