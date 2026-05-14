import { HttpError } from "@/lib/http-error";
import { useQuery } from "@tanstack/react-query";
import type { SteamPlatformMix } from "@vyoh/shared";

const API_URL = "http://localhost:2010";

async function fetchPlatformMix(): Promise<SteamPlatformMix> {
  const res = await fetch(`${API_URL}/steam/platform-mix`);
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
  return res.json() as Promise<SteamPlatformMix>;
}

export function useSteamPlatformMix() {
  return useQuery({
    queryKey: ["steam", "platform-mix"],
    queryFn: fetchPlatformMix,
    // Same backing poller as library-summary (daily 04:00 Brussels). Mix
    // changes are slower than library count changes, but keeping the
    // stale-time aligned keeps cache invalidation simple.
    staleTime: 30 * 60 * 1_000,
  });
}
