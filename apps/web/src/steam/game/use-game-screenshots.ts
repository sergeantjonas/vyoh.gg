import { HttpError } from "@/lib/http-error";
import { useQuery } from "@tanstack/react-query";
import type { SteamGameScreenshots } from "@vyoh/shared";

const API_URL = "http://localhost:2010";

async function fetchGameScreenshots(appid: number): Promise<SteamGameScreenshots> {
  const res = await fetch(`${API_URL}/steam/game/${appid}/screenshots`);
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
// enrichment cron's `assetTimestamp`, so a long stale-time is safe.
export function useGameScreenshots(appid: number) {
  return useQuery({
    queryKey: ["steam", "game", appid, "screenshots"],
    queryFn: () => fetchGameScreenshots(appid),
    staleTime: 60 * 60 * 1_000,
  });
}
