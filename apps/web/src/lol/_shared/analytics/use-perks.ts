import { runeIconUrl } from "@/lol/_shared/assets/champion-icon";
import { useLolStaticSelect } from "@/lol/_shared/static/use-lol-static";
import type { LolStaticBundle } from "@vyoh/shared";

export interface PerkInfo {
  iconUrl: string;
  name: string;
}

function buildPerksMap(bundle: LolStaticBundle): Map<number, PerkInfo> {
  const patch = bundle.patchVersion ?? "16.9.1";
  return new Map(
    bundle.perks
      .filter((p) => p.retiredAt == null)
      .map((p) => [p.id, { iconUrl: runeIconUrl(p.id, patch), name: p.name }])
  );
}

// Map sourced from the bundled `/lol/static` payload; icon bytes still come
// from the `/img/lol/rune/:id/:patch.webp` proxy. Retired perks are filtered
// out so the live UI never surfaces a defunct keystone (e.g. Phase Rush).
export function usePerks(): Map<number, PerkInfo> | undefined {
  return useLolStaticSelect(buildPerksMap).data;
}
