import type { HttpError } from "@/lib/http-error";
import { ownerRequest } from "@/lib/owner-request";
import { completionCandidatesQueryOptions } from "@/steam/use-completion-candidates";
import { libraryCompletionQueryOptions } from "@/steam/use-library-completion";
import { steamOwnedGamesQueryOptions } from "@/steam/use-owned-games";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { SteamGameRefreshResult } from "@vyoh/shared";
import { gameAchievementsQueryOptions } from "./use-game-achievements";
import { gameDescriptionQueryOptions } from "./use-game-description";
import { gameScreenshotsQueryOptions } from "./use-game-screenshots";
import { gameUnlockTimelineQueryOptions } from "./use-game-unlock-timeline";
import { steamGameQueryOptions } from "./use-steam-game";

/**
 * The owner's per-game "fetch now". The route is behind `OwnerGuard`, so the
 * request goes through `ownerRequest` for its `credentials`, and every key it
 * invalidates is the owner-scoped one — the visitor's projection never holds
 * data this click can change.
 *
 * Exact keys rather than the `["steam", "game", appid]` prefix: the prefix
 * would also drop the public entries the loader primed, which the owner's
 * client never reads again. The list is built from each hook's own options so
 * a key change there is a key change here.
 */
export function useRefreshSteamGame(appid: number) {
  const queryClient = useQueryClient();
  return useMutation<SteamGameRefreshResult, HttpError>({
    mutationFn: () =>
      ownerRequest<SteamGameRefreshResult>("POST", `/steam/game/${appid}/refresh`),
    onSuccess: (result) => {
      if (!result.ran) return;
      for (const queryKey of refreshedQueryKeys(appid)) {
        void queryClient.invalidateQueries({ queryKey });
      }
    },
  });
}

// Every owner-scoped read a refresh can change: the library and single-row
// playtime, the three achievement reads, and the two enrichment reads — the
// store leg rewrites the description body and the screenshot buckets too.
export function refreshedQueryKeys(appid: number): readonly (readonly unknown[])[] {
  return [
    steamOwnedGamesQueryOptions(true).queryKey,
    steamGameQueryOptions(appid, true).queryKey,
    libraryCompletionQueryOptions(true).queryKey,
    completionCandidatesQueryOptions(true).queryKey,
    gameAchievementsQueryOptions(appid, true).queryKey,
    gameUnlockTimelineQueryOptions(appid, true).queryKey,
    gameDescriptionQueryOptions(appid, true).queryKey,
    gameScreenshotsQueryOptions(appid, true).queryKey,
  ];
}
