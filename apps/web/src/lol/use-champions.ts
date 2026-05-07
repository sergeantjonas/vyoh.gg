import { useQuery } from "@tanstack/react-query";

const CHAMPIONS_URL =
  "https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champion-summary.json";

interface RawChampion {
  id: number;
  alias: string;
  name: string;
}

async function fetchChampions(): Promise<Map<string, string>> {
  const res = await fetch(CHAMPIONS_URL);
  if (!res.ok) throw new Error(`Failed to load champions: HTTP ${res.status}`);
  const raw: RawChampion[] = await res.json();
  return new Map(raw.filter((c) => c.id !== -1).map((c) => [c.alias, c.name]));
}

export function useChampions() {
  return useQuery({
    queryKey: ["lol", "champions"],
    queryFn: fetchChampions,
    staleTime: Number.POSITIVE_INFINITY,
  });
}

/**
 * Returns a function that maps a champion alias (Match-V5 `championName`,
 * e.g. "JarvanIV", "AurelionSol", "MonkeyKing") to its proper display
 * name ("Jarvan IV", "Aurelion Sol", "Wukong"). Falls back to the alias
 * itself while champion data is still loading.
 */
export function useChampionName() {
  const champions = useChampions();
  return (alias: string) => champions.data?.get(alias) ?? alias;
}
