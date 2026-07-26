import { HttpError } from "@/lib/http-error";
import { queryOptions, useQuery } from "@tanstack/react-query";
import type { SteamRecentUnlocks } from "@vyoh/shared";

import { API_URL } from "@/lib/api-url";

async function fetchRecentUnlocks(limit: number): Promise<SteamRecentUnlocks> {
  const res = await fetch(`${API_URL}/steam/achievements/recent?limit=${limit}`);
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
  return res.json() as Promise<SteamRecentUnlocks>;
}

// Backed by the event-driven session-close unlock refresh (S6.D) + hourly
// recently-played backstop + 4-hourly global sweep. 30min stale-time matches
// the surrounding owned-games hooks and keeps in-session navigation silent;
// a new unlock surfaces within a session-end + one render tick.
export function recentUnlocksQueryOptions(limit: number) {
  return queryOptions({
    queryKey: ["steam", "achievements", "recent", limit],
    queryFn: () => fetchRecentUnlocks(limit),
    staleTime: 30 * 60 * 1_000,
  });
}

export function useRecentUnlocks(limit: number) {
  return useQuery(recentUnlocksQueryOptions(limit));
}
