import { normalizeChampionAlias } from "@/lol/_shared/assets/champion-icon";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

// Pulled live from CDragon. Small (~14KB), refreshes itself patch-over-patch
// without a redeploy. React Query caches it as `Infinity` so the runtime fetch
// only happens once per page load. The shorthand `cdn.communitydragon.org`
// alias for this file was retired upstream and now 404s — use the canonical
// rcp-be-lol-game-data path, which is the source the CDragon docs point at.
const CHAMPIONS_URL =
  "https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champion-summary.json";

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

/**
 * Returns a function that maps a champion display name (the wiki name, e.g.
 * "Wukong", "Lee Sin") back to its Riot internal alias (e.g. "MonkeyKing",
 * "LeeSin"). Useful when a server response carries the display name but a
 * downstream consumer (image proxy, route param) needs the alias. Falls
 * back to the input itself if the champion map hasn't loaded yet or the
 * name isn't found.
 */
export function useChampionAliasFromName() {
  const champions = useChampions();
  const reverse = useMemo(() => {
    if (!champions.data) return null;
    const map = new Map<string, string>();
    for (const [aliasLower, info] of champions.data.entries()) {
      map.set(info.name, aliasLower);
    }
    return map;
  }, [champions.data]);
  return (displayName: string) => reverse?.get(displayName) ?? displayName;
}
