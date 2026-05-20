import { useQuery } from "@tanstack/react-query";

const API_URL = "http://localhost:2010";

// Riot hasn't redesigned ranked emblems since 2023, so this matches the
// current canonical art if the API request hasn't resolved yet (or fails).
const FALLBACK_YEAR = 2023;

async function fetchRankedEmblemYear(): Promise<number> {
  const res = await fetch(`${API_URL}/lol/patches/ranked-emblem-year`);
  if (!res.ok) return FALLBACK_YEAR;
  const body = (await res.json()) as { year: number };
  return typeof body.year === "number" ? body.year : FALLBACK_YEAR;
}

// One-shot fetch; cached for the session. Server-side probe is itself cached
// 24h so the request load is bounded even if every page mounts the hook.
export function useRankedEmblemYear(): number {
  const query = useQuery({
    queryKey: ["lol", "ranked-emblem-year"],
    queryFn: fetchRankedEmblemYear,
    staleTime: Number.POSITIVE_INFINITY,
  });
  return query.data ?? FALLBACK_YEAR;
}
