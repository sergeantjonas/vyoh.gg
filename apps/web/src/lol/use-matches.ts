import { useQuery } from "@tanstack/react-query";
import type { MatchSummary } from "@vyoh/shared";

const API_URL = "http://localhost:2010";

async function fetchMatches(region: string, name: string): Promise<MatchSummary[]> {
  const res = await fetch(
    `${API_URL}/lol/summoners/${encodeURIComponent(region)}/${encodeURIComponent(name)}/matches`
  );
  if (!res.ok) throw new Error(`Failed to load matches (HTTP ${res.status})`);
  return res.json();
}

export function useMatches(region: string, name: string) {
  return useQuery({
    queryKey: ["lol", "matches", region, name],
    queryFn: () => fetchMatches(region, name),
    enabled: name.length > 0,
  });
}
