import { HttpError } from "@/lib/http-error";
import { useQuery } from "@tanstack/react-query";
import type { SteamGameDescription } from "@vyoh/shared";

const API_URL = "http://localhost:2010";

async function fetchGameDescription(appid: number): Promise<SteamGameDescription> {
  const res = await fetch(`${API_URL}/steam/game/${appid}/description`);
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
  return res.json() as Promise<SteamGameDescription>;
}

// Per-app BBCode body. Description changes only with content patches / DLC
// releases, so the monthly enrichment cadence is plenty — within a session
// the description is effectively immutable. 1h stale-time matches the other
// per-game hooks (useGameScreenshots, useGameAchievements) for cache cohesion.
export function useGameDescription(appid: number) {
  return useQuery({
    queryKey: ["steam", "game", appid, "description"],
    queryFn: () => fetchGameDescription(appid),
    staleTime: 60 * 60 * 1_000,
  });
}
