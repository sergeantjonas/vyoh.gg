import { HttpError } from "@/lib/http-error";
import { useQuery } from "@tanstack/react-query";
import type { MatchTimelineProjection } from "@vyoh/shared";

const API_URL = "http://localhost:2010";

async function fetchMatchTimeline(matchId: string): Promise<MatchTimelineProjection> {
  const res = await fetch(
    `${API_URL}/lol/matches/${encodeURIComponent(matchId)}/timeline`
  );
  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      if (typeof body?.message === "string") message = body.message;
    } catch {
      // not JSON — keep fallback
    }
    throw new HttpError(res.status, message);
  }
  return res.json();
}

export function useMatchTimeline(matchId: string) {
  return useQuery({
    queryKey: ["lol", "match", matchId, "timeline"],
    queryFn: () => fetchMatchTimeline(matchId),
    enabled: matchId.length > 0,
    staleTime: Number.POSITIVE_INFINITY,
  });
}
