import { summonerSpellIconUrl } from "@/lol/_shared/assets/champion-icon";
import { useDDragonVersion } from "@/lol/_shared/patch/use-ddragon-version";
import { useLolStaticSelect } from "@/lol/_shared/static/use-lol-static";
import type { LolStaticBundle } from "@vyoh/shared";

export interface SummonerSpellInfo {
  iconUrl: string;
  name: string;
}

function buildSummonerSpellsMap(
  bundle: LolStaticBundle,
  patch: string
): Map<number, SummonerSpellInfo> {
  return new Map(
    bundle.summonerSpells
      .filter((s) => s.retiredAt == null)
      .map((s) => [s.id, { iconUrl: summonerSpellIconUrl(s.id, patch), name: s.name }])
  );
}

// Same shape as use-perks: derived from the bundled `/lol/static` payload;
// icon bytes come from the `/img/lol/spell/:id/:patch.webp` proxy.
export function useSummonerSpells(): Map<number, SummonerSpellInfo> | undefined {
  const patch = useDDragonVersion();
  return useLolStaticSelect((bundle) => buildSummonerSpellsMap(bundle, patch)).data;
}
