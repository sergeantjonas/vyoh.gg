import { useIsOwner } from "@/auth/use-viewer";
import { viewerScope, viewerScopedQuery } from "@/auth/viewer-scope";
import { HttpError } from "@/lib/http-error";
import { useQuery } from "@tanstack/react-query";
import type { SteamPlayerState } from "@vyoh/shared";

import { API_URL } from "@/lib/api-url";

async function fetchPlayerState(): Promise<SteamPlayerState> {
  const res = await fetch(`${API_URL}/steam/player-state`, { credentials: "include" });
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
  return res.json() as Promise<SteamPlayerState>;
}

// Backed by a 2-min poller server-side, so a 30s client stale-time keeps the
// "Now playing" chip feeling live without amplifying upstream Steam load.
// refetchInterval is matched so the chip notices state transitions even when
// the route is left open in the background.
//
// 404 is a fresh-DB edge case (poller hasn't run yet). We don't retry it —
// the row will appear within 2 min and the next refetch picks it up.
export function useSteamPlayerState() {
  const scope = viewerScope(useIsOwner());
  return useQuery({
    queryKey: ["steam", "player-state", scope],
    queryFn: fetchPlayerState,
    ...viewerScopedQuery,
    staleTime: 30 * 1_000,
    refetchInterval: 30 * 1_000,
    retry: (failureCount, error) =>
      error instanceof HttpError && error.status === 404 ? false : failureCount < 2,
  });
}
