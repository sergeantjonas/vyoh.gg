import { HttpError } from "@/lib/http-error";
import { queryOptions, useQuery } from "@tanstack/react-query";
import type { SteamUpcoming } from "@vyoh/shared";

import { API_URL } from "@/lib/api-url";

// Unreleased titles from both provenances — wishlisted and pre-ordered. Distinct
// from useSteamWishlist: buying a game before launch deletes its wishlist row, so
// the wishlist query alone cannot see the releases the owner is most committed to.
async function fetchUpcoming(): Promise<SteamUpcoming> {
  const res = await fetch(`${API_URL}/steam/upcoming`);
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
  return res.json() as Promise<SteamUpcoming>;
}

export function steamUpcomingQueryOptions() {
  return queryOptions({
    queryKey: ["steam", "upcoming"],
    queryFn: fetchUpcoming,
    // Rides the backend's caching like the wishlist query does: the wishlist half
    // sits behind a 1h TTL and the owned half behind the enrichment poller's daily
    // refresh, so there is nothing for an aggressive refetch to discover.
    staleTime: 5 * 60 * 1_000,
  });
}

export function useSteamUpcoming() {
  return useQuery(steamUpcomingQueryOptions());
}
