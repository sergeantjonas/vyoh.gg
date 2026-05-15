import { HttpError } from "@/lib/http-error";
import { useQuery } from "@tanstack/react-query";
import type { SteamOwnedGames } from "@vyoh/shared";

const API_URL = "http://localhost:2010";

async function fetchOwnedGames(): Promise<SteamOwnedGames> {
  const res = await fetch(`${API_URL}/steam/owned-games`);
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
  return res.json() as Promise<SteamOwnedGames>;
}

export function useSteamOwnedGames() {
  return useQuery({
    queryKey: ["steam", "owned-games"],
    queryFn: fetchOwnedGames,
    // Backed by the daily 04:00 Europe/Brussels poller — values change at most
    // once per 24h. Same stale-time as the other owned-games-derived hooks.
    staleTime: 30 * 60 * 1_000,
  });
}
