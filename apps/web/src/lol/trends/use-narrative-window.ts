import { HttpError } from "@/lib/http-error";
import { useQuery } from "@tanstack/react-query";
import type { LolAccount, MatchNarrativeWindow } from "@vyoh/shared";

const API_URL = "http://localhost:2010";

// Cap the request body — the server enforces the same limit; the client cap
// avoids round-tripping IDs that would be rejected anyway.
const MAX_MATCH_IDS = 1000;

async function fetchNarrativeWindow(
  account: LolAccount,
  matchIds: string[]
): Promise<MatchNarrativeWindow> {
  const res = await fetch(
    `${API_URL}/lol/summoners/${encodeURIComponent(account.region)}/${encodeURIComponent(account.gameName)}/${encodeURIComponent(account.tagLine)}/narrative`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ matchIds }),
    }
  );
  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      if (typeof body?.message === "string") message = body.message;
    } catch {
      // not JSON
    }
    throw new HttpError(res.status, message);
  }
  return res.json();
}

/**
 * Aggregates owner-only challenge counts (solo kills, outnumbered takedowns,
 * clutch survivals) across a caller-provided list of match IDs. Used by the
 * Trends highlight reel — the trends window is computed client-side, so the
 * window of IDs is the natural cache key.
 */
export function useNarrativeWindow(
  account: LolAccount | undefined,
  matchIds: readonly string[]
) {
  const capped = matchIds.slice(0, MAX_MATCH_IDS);
  // Sort the IDs into the key so two windows containing the same set hit the
  // same cache entry regardless of order. Trends slices are already sorted
  // by playedAt desc but defensive sort costs nothing.
  const cacheKey = [...capped].sort();

  return useQuery({
    queryKey: [
      "lol",
      "narrative",
      account?.region,
      account?.gameName,
      account?.tagLine,
      cacheKey,
    ],
    queryFn: () => {
      if (!account) throw new Error("No account");
      return fetchNarrativeWindow(account, capped);
    },
    enabled: account !== undefined && capped.length > 0,
    staleTime: 5 * 60 * 1000,
  });
}
