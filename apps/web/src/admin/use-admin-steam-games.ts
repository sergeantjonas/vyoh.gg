import { ownerRequest } from "@/lib/owner-request";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  AdminSteamGame,
  AdminSteamGameList,
  AdminSteamReviewCount,
} from "@vyoh/shared";

export const adminSteamGamesQueryKey = ["admin", "steam-games"] as const;
export const adminSteamReviewCountQueryKey = ["admin", "steam-games", "review"] as const;

/**
 * The curation overlay, owner-only on reads as well as writes — an enumeration
 * of the hidden games is the secret the hiding exists to keep. `enabled` keeps a
 * signed-out visitor from firing a request that is known to 401 before it is
 * sent.
 */
export function useAdminSteamGames(enabled: boolean) {
  return useQuery({
    queryKey: adminSteamGamesQueryKey,
    queryFn: () => ownerRequest<AdminSteamGameList>("GET", "/admin/steam-games"),
    enabled,
    staleTime: 30_000,
  });
}

/** Just the count, for the nav's needs-review indicator. */
export function useSteamReviewCount(enabled: boolean) {
  return useQuery({
    queryKey: adminSteamReviewCountQueryKey,
    queryFn: () =>
      ownerRequest<AdminSteamReviewCount>("GET", "/admin/steam-games/review-count"),
    enabled,
    staleTime: 60_000,
  });
}

/**
 * Every Steam read, plus the overlay itself.
 *
 * Hiding a game changes what fifteen endpoints return, and the affected set is
 * not knowable from the appid — the same game can be in the library list, an
 * achievement feed, the completion table, the portrait's naming cards and the
 * wishlist at once. Invalidating the whole `["steam"]` prefix is the honest
 * move; a curated list of keys to refresh would go stale the next time a Steam
 * surface is added.
 */
function useInvalidateCuration() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["steam"] }),
      queryClient.invalidateQueries({ queryKey: adminSteamGamesQueryKey }),
    ]);
}

/** The three flags a curation row exposes; send only what changes. */
export interface UpdateSteamCurationInput {
  appid: number;
  patch: {
    hidden?: boolean;
    unfeatured?: boolean;
    reviewed?: boolean;
    note?: string;
    name?: string;
  };
}

export function useUpdateSteamCuration() {
  const invalidate = useInvalidateCuration();
  return useMutation<AdminSteamGame, Error, UpdateSteamCurationInput>({
    mutationFn: ({ appid, patch }) =>
      ownerRequest<AdminSteamGame>("PATCH", `/admin/steam-games/${appid}`, patch),
    onSuccess: invalidate,
  });
}

/**
 * Drops the overlay row, returning the game to plain visible and featurable.
 * Distinct from `{ hidden: false }`, which keeps the row — and with it the note
 * and the record that a decision was made here.
 */
export function useClearSteamCuration() {
  const invalidate = useInvalidateCuration();
  return useMutation<void, Error, number>({
    mutationFn: (appid) => ownerRequest<void>("DELETE", `/admin/steam-games/${appid}`),
    onSuccess: invalidate,
  });
}
