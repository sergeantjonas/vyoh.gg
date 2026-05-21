import { runeIconUrl } from "@/lol/_shared/assets/champion-icon";
import { useDDragonVersion } from "@/lol/_shared/patch/use-ddragon-version";
import { useLolStaticSelect } from "@/lol/_shared/static/use-lol-static";
import { type LolStaticBundle, stripWikitext } from "@vyoh/shared";
import { useCallback } from "react";

export interface PerkInfo {
  iconUrl: string;
  name: string;
  description: string;
}

const perksCache = new WeakMap<LolStaticBundle, Map<string, Map<number, PerkInfo>>>();

function buildPerksMap(bundle: LolStaticBundle, patch: string): Map<number, PerkInfo> {
  let byPatch = perksCache.get(bundle);
  if (!byPatch) {
    byPatch = new Map();
    perksCache.set(bundle, byPatch);
  }
  const cached = byPatch.get(patch);
  if (cached) return cached;

  const result = new Map(
    bundle.perks
      .filter((p) => p.retiredAt == null)
      .map((p) => {
        const raw = p.descriptionHtml ?? p.descriptionWikitext ?? "";
        return [
          p.id,
          {
            iconUrl: runeIconUrl(p.id, patch),
            name: p.name,
            description: stripWikitext(raw),
          },
        ];
      })
  );
  byPatch.set(patch, result);
  return result;
}

// Map sourced from the bundled `/lol/static` payload; icon bytes still come
// from the `/img/lol/rune/:id/:patch.webp` proxy. Retired perks are filtered
// out so the live UI never surfaces a defunct keystone (e.g. Phase Rush).
export function usePerks(): Map<number, PerkInfo> | undefined {
  const patch = useDDragonVersion();
  const select = useCallback(
    (bundle: LolStaticBundle) => buildPerksMap(bundle, patch),
    [patch]
  );
  return useLolStaticSelect(select).data;
}
