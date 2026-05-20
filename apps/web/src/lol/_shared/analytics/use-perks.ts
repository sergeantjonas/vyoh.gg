import { runeIconUrl } from "@/lol/_shared/assets/champion-icon";
import { useDDragonVersion } from "@/lol/_shared/patch/use-ddragon-version";
import { useLolStaticSelect } from "@/lol/_shared/static/use-lol-static";
import type { LolStaticBundle } from "@vyoh/shared";

export interface PerkInfo {
  iconUrl: string;
  name: string;
}

function buildPerksMap(bundle: LolStaticBundle, patch: string): Map<number, PerkInfo> {
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
  const patch = useDDragonVersion();
  return useLolStaticSelect((bundle) => buildPerksMap(bundle, patch)).data;
}
