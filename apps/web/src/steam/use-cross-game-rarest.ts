import { useIsOwner } from "@/auth/use-viewer";
import { viewerScope, viewerScopedQuery } from "@/auth/viewer-scope";
import { HttpError } from "@/lib/http-error";
import { useQuery } from "@tanstack/react-query";
import type { SteamRecentUnlocks } from "@vyoh/shared";

import { API_URL } from "@/lib/api-url";

async function fetchCrossGameRarest(limit: number): Promise<SteamRecentUnlocks> {
  const res = await fetch(`${API_URL}/steam/achievements/rarest?limit=${limit}`, {
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
  return res.json() as Promise<SteamRecentUnlocks>;
}

// Reuses the SteamRecentUnlocks shape — the rarest leaderboard carries the
// same fields, just ordered by ascending rarity. 30min stale-time matches
// the recent feed; rarity-percent updates land weekly via the global-rarity
// poller, so anything tighter would be overkill.
export function useCrossGameRarest(limit: number) {
  const scope = viewerScope(useIsOwner());
  return useQuery({
    queryKey: ["steam", "achievements", "rarest", limit, scope],
    queryFn: () => fetchCrossGameRarest(limit),
    staleTime: 30 * 60 * 1_000,
    ...viewerScopedQuery,
  });
}
