import { useQuery } from "@tanstack/react-query";

const SUMMARY_URL =
  "https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champion-summary.json";

export interface SpellInfo {
  iconUrl: string;
  name: string;
  description: string;
}

interface ChampionSummary {
  id: number;
  name: string;
  alias: string;
}

interface ChampionDetail {
  spells: { abilityIconPath: string; name: string; description: string }[];
}

function spellIconUrl(abilityIconPath: string): string {
  // /lol-game-data/assets/ASSETS/Characters/Annie/HUD/Icons2D/Annie_Q.png
  // → https://wsrv.nl/?url=raw.communitydragon.org/latest/game/assets/characters/annie/hud/icons2d/annie_q.png&w=40&output=webp
  const stripped = abilityIconPath
    .replace(/^\/lol-game-data\/assets\//i, "")
    .toLowerCase();
  return `https://wsrv.nl/?url=raw.communitydragon.org/latest/game/${stripped}&w=40&output=webp`;
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function useChampionSummary() {
  return useQuery({
    queryKey: ["lol", "champion-summary"],
    queryFn: async () => {
      const res = await fetch(SUMMARY_URL);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: ChampionSummary[] = await res.json();
      const map = new Map<string, number>();
      for (const c of data) {
        // alias matches Riot API championName (e.g. "MonkeyKing" for Wukong)
        map.set(c.alias, c.id);
        map.set(c.name, c.id);
      }
      return map;
    },
    staleTime: Number.POSITIVE_INFINITY,
  });
}

export function useChampionSpells(championName: string): SpellInfo[] | undefined {
  const summary = useChampionSummary();
  const championId = summary.data?.get(championName);

  const detail = useQuery({
    queryKey: ["lol", "champion-spells", championId],
    queryFn: async () => {
      const res = await fetch(
        `https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champions/${championId}.json`
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: ChampionDetail = await res.json();
      return data.spells.map((s) => ({
        iconUrl: spellIconUrl(s.abilityIconPath),
        name: s.name,
        description: stripHtml(s.description),
      }));
    },
    enabled: championId !== undefined,
    staleTime: Number.POSITIVE_INFINITY,
  });

  return detail.data;
}
