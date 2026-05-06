import { HttpError } from "@/lib/http-error";
import { useQuery } from "@tanstack/react-query";
import type { MatchSummary } from "@vyoh/shared";

const API_URL = "http://localhost:2010";

async function fetchMatches(
  region: string,
  gameName: string,
  tagLine: string
): Promise<MatchSummary[]> {
  const res = await fetch(
    `${API_URL}/lol/summoners/${encodeURIComponent(region)}/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}/matches`
  );
  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      if (typeof body?.message === "string") {
        message = body.message;
      }
    } catch {
      // body wasn't JSON — keep the HTTP status fallback
    }
    throw new HttpError(res.status, message);
  }
  return res.json();
}

export function useMatches(region: string, gameName: string, tagLine: string) {
  return useQuery({
    queryKey: ["lol", "matches", region, gameName, tagLine],
    queryFn: () => fetchMatches(region, gameName, tagLine),
    enabled: gameName.length > 0 && tagLine.length > 0,
  });
}
