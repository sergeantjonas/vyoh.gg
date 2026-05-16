import { HttpError } from "@/lib/http-error";
import { useQuery } from "@tanstack/react-query";
import type { SteamLibraryCompletion } from "@vyoh/shared";

const API_URL = "http://localhost:2010";

async function fetchLibraryCompletion(): Promise<SteamLibraryCompletion> {
  const res = await fetch(`${API_URL}/steam/achievements/library-completion`);
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
  return res.json() as Promise<SteamLibraryCompletion>;
}

// One row per game with a schema; both the completionist axis card and the
// 100%'d hall consume the same payload. 30min stale-time tracks the daily
// unlocks poller's cadence — anything finer just amplifies traffic without
// changing what's on screen.
export function useLibraryCompletion() {
  return useQuery({
    queryKey: ["steam", "achievements", "library-completion"],
    queryFn: fetchLibraryCompletion,
    staleTime: 30 * 60 * 1_000,
  });
}
