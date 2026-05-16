import { runeIconUrl } from "@/lol/_shared/assets/champion-icon";
import { useDDragonVersion } from "@/lol/_shared/patch/use-ddragon-version";
import { useQuery } from "@tanstack/react-query";

const PERKS_URL =
  "https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/perks.json";

interface RawPerk {
  id: number;
  iconPath: string;
  name: string;
}

export interface PerkInfo {
  iconUrl: string;
  name: string;
}

// Runtime still fetches perks.json once for id→name mapping; icon bytes come
// from the `/img/lol/rune/:id/:patch.webp` proxy.
export function usePerks(): Map<number, PerkInfo> | undefined {
  const patch = useDDragonVersion();
  return useQuery({
    queryKey: ["lol", "perks", patch],
    queryFn: async () => {
      const res = await fetch(PERKS_URL);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const raw: RawPerk[] = await res.json();
      return new Map(
        raw.map((p) => [p.id, { iconUrl: runeIconUrl(p.id, patch), name: p.name }])
      );
    },
    staleTime: Number.POSITIVE_INFINITY,
  }).data;
}
