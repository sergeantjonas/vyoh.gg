import { HttpError } from "@/lib/http-error";
import { useQuery } from "@tanstack/react-query";
import type { SteamLibrarySummary } from "@vyoh/shared";

import { API_URL } from "@/lib/api-url";

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
    // Backed by the 15-min owned-games poller, which rewrites the current
    // day's snapshot rather than appending one. Keep stale-time generous
    // anyway: a library count moves far slower than the rows behind it.
    staleTime: 30 * 60 * 1_000,
  });
}
