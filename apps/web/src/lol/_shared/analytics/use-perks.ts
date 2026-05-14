import { getRuneAsset } from "@/lol/_shared/asset-manifest";
import { useQuery } from "@tanstack/react-query";

const PERKS_URL =
  "https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/perks.json";

const ASSETS_BASE =
  "https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default";

interface RawPerk {
  id: number;
  iconPath: string;
  name: string;
}

export interface PerkInfo {
  iconUrl: string;
  name: string;
}

// Manifest covers icon URLs; the runtime still fetches perks.json once for
// id→name mapping (manifest stores only paths/hashes, not localized names).
function iconUrlFromPath(id: number, path: string): string {
  const bundled = getRuneAsset(id);
  if (bundled) return bundled;
  const rawUrl = ASSETS_BASE + path.replace("/lol-game-data/assets/", "/").toLowerCase();
  const src = rawUrl.replace("https://", "");
  return `https://wsrv.nl/?url=${src}&w=40&output=webp`;
}

export function usePerks(): Map<number, PerkInfo> | undefined {
  return useQuery({
    queryKey: ["lol", "perks"],
    queryFn: async () => {
      const res = await fetch(PERKS_URL);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const raw: RawPerk[] = await res.json();
      return new Map(
        raw.map((p) => [
          p.id,
          { iconUrl: iconUrlFromPath(p.id, p.iconPath), name: p.name },
        ])
      );
    },
    staleTime: Number.POSITIVE_INFINITY,
  }).data;
}
