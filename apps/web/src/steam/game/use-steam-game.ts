import { useIsOwner } from "@/auth/use-viewer";
import { viewerScope, viewerScopedQuery } from "@/auth/viewer-scope";
import { HttpError } from "@/lib/http-error";
import { queryOptions, useQuery } from "@tanstack/react-query";
import type { SteamOwnedGame } from "@vyoh/shared";

import { API_URL } from "@/lib/api-url";

async function fetchSteamGame(appid: number): Promise<SteamOwnedGame> {
  const res = await fetch(`${API_URL}/steam/game/${appid}`, { credentials: "include" });
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
  return res.json() as Promise<SteamOwnedGame>;
}

// The library row on its own — what `/steam/library/$appid` server-renders
// from, since the ~660 kB list stays client-side. Same daily cadence as the
// list, so the same stale-time.
export function steamGameQueryOptions(appid: number, isOwner = false) {
  return queryOptions({
    queryKey: ["steam", "game", appid, "row", viewerScope(isOwner)],
    queryFn: () => fetchSteamGame(appid),
    staleTime: 30 * 60 * 1_000,
    ...viewerScopedQuery,
  });
}

export function useSteamGame(
  appid: number,
  { enabled = true }: { enabled?: boolean } = {}
) {
  return useQuery({ ...steamGameQueryOptions(appid, useIsOwner()), enabled });
}
