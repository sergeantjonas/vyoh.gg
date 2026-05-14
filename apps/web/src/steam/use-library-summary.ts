import { HttpError } from "@/lib/http-error";
import { useQuery } from "@tanstack/react-query";
import type { SteamLibrarySummary } from "@vyoh/shared";

const API_URL = "http://localhost:2010";

async function fetchLibrarySummary(): Promise<SteamLibrarySummary> {
  const res = await fetch(`${API_URL}/steam/library-summary`);
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
  return res.json() as Promise<SteamLibrarySummary>;
}

export function useSteamLibrarySummary() {
  return useQuery({
    queryKey: ["steam", "library-summary"],
    queryFn: fetchLibrarySummary,
    // Backed by the daily 04:00 Europe/Brussels poller — values change at most
    // once per 24h. Keep stale-time generous; refetches between polls are noise.
    staleTime: 30 * 60 * 1_000,
  });
}
