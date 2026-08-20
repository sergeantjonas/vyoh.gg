/**
 * One row of the owner's Steam curation overlay. The two axes and their
 * semantics live in `../steam/curation.ts`; this is the admin projection of a
 * `SteamGameCuration` row.
 *
 * Timestamps rather than booleans, matching `AdminLolAccount` — the surface
 * wants to say "hidden since June", and a boolean throws that away for nothing.
 */
export interface AdminSteamGame {
  appid: number;
  /** Null when the row was created for an appid whose name was not yet known. */
  name: string | null;
  hiddenAt: string | null;
  unfeaturedAt: string | null;
  /** Null while this appid is still quarantined awaiting the owner's ruling. */
  reviewedAt: string | null;
  note: string | null;
  createdAt: string;
}

export interface AdminSteamGameList {
  entries: AdminSteamGame[];
  /**
   * Rows with no `reviewedAt` — newly-discovered titles still private by
   * default. Carried alongside the list so the surface doesn't recount it, and
   * available on its own from the review-count endpoint for the nav badge.
   */
  pendingReview: number;
}

export interface AdminSteamReviewCount {
  pendingReview: number;
}
