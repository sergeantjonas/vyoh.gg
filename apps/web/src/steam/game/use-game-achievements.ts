import { HttpError } from "@/lib/http-error";
import { useQuery } from "@tanstack/react-query";
import type { SteamGameAchievements } from "@vyoh/shared";

const API_URL = "http://localhost:2010";

async function fetchGameAchievements(appid: number): Promise<SteamGameAchievements> {
  const res = await fetch(`${API_URL}/steam/game/${appid}/achievements`);
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
  return res.json() as Promise<SteamGameAchievements>;
}

// Backed by the daily unlocks poller + weekly rarity poller + monthly schema
// poller. Unlock state changes at most once per 24h, so 30min stale-time
// matches the other owned-games-derived hooks — keeps in-session navigation
// (library → game → library → game) silent.
export function useGameAchievements(appid: number) {
  return useQuery({
    queryKey: ["steam", "game", appid, "achievements"],
    queryFn: () => fetchGameAchievements(appid),
    staleTime: 30 * 60 * 1_000,
  });
}
