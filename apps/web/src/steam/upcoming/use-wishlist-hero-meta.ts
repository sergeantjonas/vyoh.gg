import { useIsOwner } from "@/auth/use-viewer";
import { viewerScope, viewerScopedQuery } from "@/auth/viewer-scope";
import { queryOptions, useQuery } from "@tanstack/react-query";
import type { SteamWishlistHeroMeta } from "@vyoh/shared";

import { HttpError } from "@/lib/http-error";

import { API_URL } from "@/lib/api-url";

async function fetchWishlistHeroMeta(appid: number): Promise<SteamWishlistHeroMeta> {
  const res = await fetch(`${API_URL}/steam/wishlist/${appid}/hero-meta`, {
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
  return res.json() as Promise<SteamWishlistHeroMeta>;
}

// On-read enrichment for the Upcoming view's imminent hero. The server projects
// it per request from a fresh GetItems(full) call + a Vibrant accent pass and
// TTL-caches it for a day, so a 30-min client stale-time is plenty — it matches
// the surrounding steam hooks. A 404 (store page unresolvable) surfaces as an
// `isError` the hero treats as "render without the enriched chrome", never a
// thrown boundary.
export function wishlistHeroMetaQueryOptions(appid: number, isOwner = false) {
  return queryOptions({
    queryKey: ["steam", "wishlist", appid, "hero-meta", viewerScope(isOwner)],
    queryFn: () => fetchWishlistHeroMeta(appid),
    staleTime: 30 * 60 * 1_000,
    retry: false,
    ...viewerScopedQuery,
  });
}

export function useWishlistHeroMeta(appid: number) {
  return useQuery(wishlistHeroMetaQueryOptions(appid, useIsOwner()));
}
