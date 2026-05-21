import { normalizeChampionAlias } from "@/lol/_shared/assets/champion-icon";
import { useLolStaticSelect } from "@/lol/_shared/static/use-lol-static";
import type { LolStaticBundle } from "@vyoh/shared";
import { useMemo } from "react";

export interface ChampionInfo {
  id: number;
  name: string;
  roles: string[];
}

function buildChampionsMap(bundle: LolStaticBundle): Map<string, ChampionInfo> {
  return new Map(
    bundle.champions
      .filter((c) => c.id !== -1)
      .map((c) => [c.alias.toLowerCase(), { id: c.id, name: c.name, roles: c.roles }])
  );
}

export function useChampions() {
  return useLolStaticSelect(buildChampionsMap);
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
 * Returns a function that maps a champion id (Spectator-V5 `championId`) to
 * its display name. Returns `null` for unknown ids — callers decide how to
 * render the missing state (the wiki helper needs a name to construct a URL
 * and has no sensible fallback for a bare id).
 */
export function useChampionNameById() {
  const champions = useChampions();
  const byId = useMemo(() => {
    if (!champions.data) return null;
    const map = new Map<number, string>();
    for (const info of champions.data.values()) {
      map.set(info.id, info.name);
    }
    return map;
  }, [champions.data]);
  return (id: number) => byId?.get(id) ?? null;
}

/**
 * Returns a `Map<championId, ChampionInfo>` derived from the bundled
 * `/lol/static` payload, or `undefined` while the bundle is loading. Lets
 * callers do O(1) id → roles lookups for live-game lane assignment.
 */
export function useChampionInfoById(): Map<number, ChampionInfo> | undefined {
  const champions = useChampions();
  return useMemo(() => {
    if (!champions.data) return undefined;
    const map = new Map<number, ChampionInfo>();
    for (const info of champions.data.values()) {
      map.set(info.id, info);
    }
    return map;
  }, [champions.data]);
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
