import { HttpError } from "@/lib/http-error";
import { queryOptions, useQuery } from "@tanstack/react-query";
import type { SteamPlatformMix } from "@vyoh/shared";

import { API_URL } from "@/lib/api-url";

async function fetchPlatformMix(): Promise<SteamPlatformMix> {
  const res = await fetch(`${API_URL}/steam/platform-mix`);
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
  return res.json() as Promise<SteamPlatformMix>;
}

// Primed in the /steam loader alongside the portrait, since the Portrait's
// platform card is a claim rather than a count: 166 B answered in ~2 ms.
//
// Same backing poller as library-summary (daily 04:00 Brussels). Mix changes
// are slower than library count changes, but keeping the stale-time aligned
// keeps cache invalidation simple.
export function platformMixQueryOptions() {
  return queryOptions({
    queryKey: ["steam", "platform-mix"],
    queryFn: fetchPlatformMix,
    staleTime: 30 * 60 * 1_000,
  });
}

export function useSteamPlatformMix() {
  return useQuery(platformMixQueryOptions());
}
