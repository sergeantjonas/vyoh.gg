import { useIsOwner } from "@/auth/use-viewer";
import { viewerScope, viewerScopedQuery } from "@/auth/viewer-scope";
import { HttpError } from "@/lib/http-error";
import { queryOptions, useQuery } from "@tanstack/react-query";
import type { SteamOwnedGames } from "@vyoh/shared";

import { API_URL } from "@/lib/api-url";

async function fetchOwnedGames(): Promise<SteamOwnedGames> {
  const res = await fetch(`${API_URL}/steam/owned-games`, { credentials: "include" });
  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const body = (await res.json()) as { message?: string };
      if (typeof body?.message === "string") message = body.message;
    } catch {
      // not JSON — keep fallback
    }
    throw new HttpError(res.status, message);
  }
  return res.json() as Promise<SteamOwnedGames>;
}

// Backed by the 15-min owned-games poller, which upserts into the owner's
// current local day — `snapshotDate` is a day, but the row behind it is
// rewritten four times an hour, so playtime and last-launched move all day.
// Same stale-time as the other owned-games-derived hooks.
export function steamOwnedGamesQueryOptions(isOwner = false) {
  return queryOptions({
    queryKey: ["steam", "owned-games", viewerScope(isOwner)],
    queryFn: fetchOwnedGames,
    // Deliberately longer than the poller's 15 min: the response runs to
    // hundreds of kilobytes, so tracking the poller would spend that on every
    // tab return to move a handful of playtime figures.
    staleTime: 30 * 60 * 1_000,
    ...viewerScopedQuery,
    // Overrides the router's global `false`, which is what left a long-open tab
    // with no route back to fresh data: no interval and no passive
    // invalidation, so nothing asked. Focus is the right trigger rather than a
    // poll — nobody is reading a tab they are not looking at, and the handler
    // is a Prisma read of the latest snapshot.
    refetchOnWindowFocus: true,
  });
}

export function useSteamOwnedGames() {
  return useQuery(steamOwnedGamesQueryOptions(useIsOwner()));
}
