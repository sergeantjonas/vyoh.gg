import { HttpError } from "@/lib/http-error";
import { useQuery } from "@tanstack/react-query";
import type { SteamGameMedia } from "@vyoh/shared";

const API_URL = "http://localhost:2010";

async function fetchGameMedia(appid: number): Promise<SteamGameMedia> {
  const res = await fetch(`${API_URL}/steam/game/${appid}/media`);
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
  return res.json() as Promise<SteamGameMedia>;
}

// Lazy hovercard data. First hover blocks on appdetails (the server's SWR
// layer returns inside the 30-day TTL once primed), so 1h stale-time in the
// client is safe — within a session, re-hovering the same tile is free.
// `enabled` is gated on the hovercard open state so we only fetch what the
// user actually points at; the full library never prefetches.
export function useGameMedia(appid: number, enabled: boolean) {
  return useQuery({
    queryKey: ["steam", "game", appid, "media"],
    queryFn: () => fetchGameMedia(appid),
    enabled,
    staleTime: 60 * 60 * 1_000,
  });
}
