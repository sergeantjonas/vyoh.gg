import { HttpError } from "@/lib/http-error";
import { useQuery } from "@tanstack/react-query";
import type { MatchDetail } from "@vyoh/shared";

const API_URL = "http://localhost:2010";

async function fetchMatchDetail(matchId: string): Promise<MatchDetail> {
  const res = await fetch(`${API_URL}/lol/matches/${encodeURIComponent(matchId)}`);
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

export function useMatchDetail(matchId: string) {
  return useQuery({
    queryKey: ["lol", "match", matchId],
    queryFn: () => fetchMatchDetail(matchId),
    enabled: matchId.length > 0,
    staleTime: Number.POSITIVE_INFINITY,
  });
}
