import { useIsOwner } from "@/auth/use-viewer";
import { viewerScope, viewerScopedQuery } from "@/auth/viewer-scope";
import { queryOptions, useQuery } from "@tanstack/react-query";
import type { SteamGameRecap } from "@vyoh/shared";

import { HttpError } from "@/lib/http-error";

import { API_URL } from "@/lib/api-url";

async function fetchSteamGameRecap(appid: number): Promise<SteamGameRecap> {
  const res = await fetch(`${API_URL}/steam/game/${appid}/recap`, {
    credentials: "include",
  });
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
  return res.json() as Promise<SteamGameRecap>;
}

// Backed by the daily owned-games poll + event-driven unlocks refresh, so
// the shape is stable enough that a 30-min stale-time matches the
// surrounding owned-games / recent-unlocks hooks — the chapter doesn't need
// per-interaction freshness.
export function steamGameRecapQueryOptions(appid: number, isOwner = false) {
  return queryOptions({
    queryKey: ["steam", "game", appid, "recap", viewerScope(isOwner)],
    queryFn: () => fetchSteamGameRecap(appid),
    staleTime: 30 * 60 * 1_000,
    ...viewerScopedQuery,
  });
}

export function useSteamGameRecap(appid: number) {
  return useQuery(steamGameRecapQueryOptions(appid, useIsOwner()));
}
