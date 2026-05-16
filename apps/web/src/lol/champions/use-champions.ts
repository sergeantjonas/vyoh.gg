import { normalizeChampionAlias } from "@/lol/_shared/assets/champion-icon";
import { useQuery } from "@tanstack/react-query";

// Pulled live from CDragon. Small (~14KB), refreshes itself patch-over-patch
// without a redeploy. React Query caches it as `Infinity` so the runtime fetch
// only happens once per page load.
const CHAMPIONS_URL = "https://cdn.communitydragon.org/latest/champion-summary.json";

interface RawChampion {
  id: number;
  alias: string;
  name: string;
  description: string;
  roles: string[];
}

export interface ChampionInfo {
  name: string;
  description: string;
  roles: string[];
}

async function fetchChampions(): Promise<Map<string, ChampionInfo>> {
  const res = await fetch(CHAMPIONS_URL);
  if (!res.ok) throw new Error(`Failed to load champions: HTTP ${res.status}`);
  const raw: RawChampion[] = await res.json();
  return new Map(
    raw
      .filter((c) => c.id !== -1)
      .map((c) => [
        c.alias.toLowerCase(),
        { name: c.name, description: c.description, roles: c.roles },
      ])
  );
}

export function useChampions() {
  return useQuery({
    queryKey: ["lol", "champions"],
    queryFn: fetchChampions,
    staleTime: Number.POSITIVE_INFINITY,
  });
}

function lookupKey(alias: string): string {
  return normalizeChampionAlias(alias).toLowerCase();
}

/**
 * Returns a function that maps a champion alias (Match-V5 `championName`,
 * e.g. "JarvanIV", "AurelionSol", "MonkeyKing") to its proper display
 * name ("Jarvan IV", "Aurelion Sol", "Wukong"). Falls back to the alias
 * itself while champion data is still loading.
 */
export function useChampionName() {
  const champions = useChampions();
  return (alias: string) => {
    return champions.data?.get(lookupKey(alias))?.name ?? normalizeChampionAlias(alias);
  };
}

/** Returns full flavor info for a champion alias (any casing). */
export function useChampionInfo(alias: string): ChampionInfo | undefined {
  const champions = useChampions();
  return champions.data?.get(lookupKey(alias));
}
