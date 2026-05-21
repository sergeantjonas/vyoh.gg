import { summonerSpellIconUrl } from "@/lol/_shared/assets/champion-icon";
import { useDDragonVersion } from "@/lol/_shared/patch/use-ddragon-version";
import { useLolStaticSelect } from "@/lol/_shared/static/use-lol-static";
import { type LolStaticBundle, stripWikitext } from "@vyoh/shared";
import { useCallback } from "react";

export interface SummonerSpellInfo {
  iconUrl: string;
  name: string;
  description: string;
}

const spellsCache = new WeakMap<
  LolStaticBundle,
  Map<string, Map<number, SummonerSpellInfo>>
>();

function buildSummonerSpellsMap(
  bundle: LolStaticBundle,
  patch: string
): Map<number, SummonerSpellInfo> {
  let byPatch = spellsCache.get(bundle);
  if (!byPatch) {
    byPatch = new Map();
    spellsCache.set(bundle, byPatch);
  }
  const cached = byPatch.get(patch);
  if (cached) return cached;

  const result = new Map(
    bundle.summonerSpells
      .filter((s) => s.retiredAt == null)
      .map((s) => {
        const raw = s.descriptionHtml ?? s.descriptionWikitext ?? "";
        return [
          s.id,
          {
            iconUrl: summonerSpellIconUrl(s.id, patch),
            name: s.name,
            description: stripWikitext(raw),
          },
        ];
      })
  );
  byPatch.set(patch, result);
  return result;
}

// Same shape as use-perks: derived from the bundled `/lol/static` payload;
// icon bytes come from the `/img/lol/spell/:id/:patch.webp` proxy.
export function useSummonerSpells(): Map<number, SummonerSpellInfo> | undefined {
  const patch = useDDragonVersion();
  const select = useCallback(
    (bundle: LolStaticBundle) => buildSummonerSpellsMap(bundle, patch),
    [patch]
  );
  return useLolStaticSelect(select).data;
}
