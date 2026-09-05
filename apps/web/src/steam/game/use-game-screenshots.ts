import { useIsOwner } from "@/auth/use-viewer";
import { viewerScope, viewerScopedQuery } from "@/auth/viewer-scope";
import { HttpError } from "@/lib/http-error";
import { queryOptions, useQuery } from "@tanstack/react-query";
import type { SteamGameScreenshots } from "@vyoh/shared";

import { API_URL } from "@/lib/api-url";

async function fetchGameScreenshots(appid: number): Promise<SteamGameScreenshots> {
  const res = await fetch(`${API_URL}/steam/game/${appid}/screenshots`, {
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
  return res.json() as Promise<SteamGameScreenshots>;
}

// Per-app screenshot buckets. Stale-time mirrors the other per-game hooks —
// screenshots change only with publisher refreshes that already bump the
// enrichment cron's `assetTimestamp`, so a long stale-time is safe. The
// `enabled` option lets the hovercard skip the fetch when the game already
// has a microtrailer that takes over the same slot — the slot would never
// render the screenshots, so the network round-trip is pure waste.
export function gameScreenshotsQueryOptions(appid: number, isOwner = false) {
  return queryOptions({
    queryKey: ["steam", "game", appid, "screenshots", viewerScope(isOwner)],
    queryFn: () => fetchGameScreenshots(appid),
    staleTime: 60 * 60 * 1_000,
    ...viewerScopedQuery,
  });
}

export function useGameScreenshots(
  appid: number,
  { enabled = true }: { enabled?: boolean } = {}
) {
  return useQuery({ ...gameScreenshotsQueryOptions(appid, useIsOwner()), enabled });
}
