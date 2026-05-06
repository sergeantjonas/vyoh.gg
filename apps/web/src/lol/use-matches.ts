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
    throw new HttpError(res.status, `Failed to load matches (HTTP ${res.status})`);
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
