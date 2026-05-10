import { useQuery } from "@tanstack/react-query";

const SPELLS_URL =
  "https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/summoner-spells.json";

const ASSETS_BASE =
  "https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default";

interface RawSummonerSpell {
  id: number;
  iconPath: string;
  name: string;
}

export interface SummonerSpellInfo {
  iconUrl: string;
  name: string;
}

function iconUrlFromPath(path: string): string {
  const rawUrl = ASSETS_BASE + path.replace("/lol-game-data/assets/", "/").toLowerCase();
  const src = rawUrl.replace("https://", "");
  return `https://wsrv.nl/?url=${src}&w=40&output=webp`;
}

export function useSummonerSpells(): Map<number, SummonerSpellInfo> | undefined {
  return useQuery({
    queryKey: ["lol", "summoner-spells"],
    queryFn: async () => {
      const res = await fetch(SPELLS_URL);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const raw: RawSummonerSpell[] = await res.json();
      return new Map(
        raw.map((s) => [s.id, { iconUrl: iconUrlFromPath(s.iconPath), name: s.name }])
      );
    },
    staleTime: Number.POSITIVE_INFINITY,
  }).data;
}
