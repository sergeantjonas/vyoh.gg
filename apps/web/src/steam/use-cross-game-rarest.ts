import { HttpError } from "@/lib/http-error";
import { useQuery } from "@tanstack/react-query";
import type { SteamRecentUnlocks } from "@vyoh/shared";

const API_URL = "http://localhost:2010";

async function fetchCrossGameRarest(limit: number): Promise<SteamRecentUnlocks> {
  const res = await fetch(`${API_URL}/steam/achievements/rarest?limit=${limit}`);
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
  return useQuery({
    queryKey: ["steam", "achievements", "rarest", limit],
    queryFn: () => fetchCrossGameRarest(limit),
    staleTime: 30 * 60 * 1_000,
  });
}
