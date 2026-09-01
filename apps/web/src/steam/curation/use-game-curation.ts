import { useAdminSteamGames } from "@/admin/use-admin-steam-games";
import { useIsOwner } from "@/auth/use-viewer";

export interface GameCurationState {
  /** Only the owner has curation state to read; everyone else gets `false`s. */
  isOwner: boolean;
  hidden: boolean;
  /** Quarantined by the poller and still awaiting a ruling. */
  needsReview: boolean;
  /** The overlay hasn't arrived yet, so `hidden` is not yet trustworthy. */
  isPending: boolean;
}

/**
 * One game's curation state, read from the owner's overlay.
 *
 * Derived from the admin list rather than carried on the game payload: the
 * public `SteamOwnedGames` response must not say which titles are hidden, and
 * an owner-only field on a shared shape is one forgotten projection away from
 * announcing exactly what the feature exists to conceal. The list is one cached
 * request for the whole page, so a library of rows costs no more than one.
 */
export function useGameCuration(appid: number): GameCurationState {
  const isOwner = useIsOwner();
  const { data, isPending } = useAdminSteamGames(isOwner);
  const row = data?.entries.find((entry) => entry.appid === appid);
  // Gated on `isOwner` rather than on the query being disabled. The overlay can
  // sit in the cache without the viewer being the owner — signed in, then the
  // session expired — and every consumer treats these as "safe to render", so
  // reading them straight off the cache would mark a game as hidden on a page
  // the owner is no longer behind.
  if (!isOwner) {
    return { isOwner: false, hidden: false, needsReview: false, isPending: false };
  }
  return {
    isOwner,
    hidden: row?.hiddenAt != null,
    needsReview: row != null && row.reviewedAt === null,
    isPending,
  };
}
