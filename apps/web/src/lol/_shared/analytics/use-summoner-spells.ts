import { summonerSpellIconUrl } from "@/lol/_shared/assets/champion-icon";
import { useDDragonVersion } from "@/lol/_shared/patch/use-ddragon-version";
import { useQuery } from "@tanstack/react-query";

const SPELLS_URL =
  "https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/summoner-spells.json";

interface RawSummonerSpell {
  id: number;
  iconPath: string;
  name: string;
}

export interface SummonerSpellInfo {
  iconUrl: string;
  name: string;
}

// Same shape as use-perks: runtime fetch needed for id→name mapping; icon
// bytes come from the `/img/lol/spell/:id/:patch.webp` proxy.
export function useSummonerSpells(): Map<number, SummonerSpellInfo> | undefined {
  const patch = useDDragonVersion();
  return useQuery({
    queryKey: ["lol", "summoner-spells", patch],
    queryFn: async () => {
      const res = await fetch(SPELLS_URL);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const raw: RawSummonerSpell[] = await res.json();
      return new Map(
        raw.map((s) => [
          s.id,
          { iconUrl: summonerSpellIconUrl(s.id, patch), name: s.name },
        ])
      );
    },
    staleTime: Number.POSITIVE_INFINITY,
  }).data;
}
