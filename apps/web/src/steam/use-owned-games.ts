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

// Backed by the daily 04:00 Europe/Brussels poller — values change at most
// once per 24h. Same stale-time as the other owned-games-derived hooks.
export function steamOwnedGamesQueryOptions(isOwner = false) {
  return queryOptions({
    queryKey: ["steam", "owned-games", viewerScope(isOwner)],
    queryFn: fetchOwnedGames,
    staleTime: 30 * 60 * 1_000,
    ...viewerScopedQuery,
  });
}

export function useSteamOwnedGames() {
  return useQuery(steamOwnedGamesQueryOptions(useIsOwner()));
}
