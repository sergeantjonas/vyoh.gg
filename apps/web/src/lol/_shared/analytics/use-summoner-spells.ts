import { summonerSpellIconUrl } from "@/lol/_shared/assets/champion-icon";
import { useLolStaticSelect } from "@/lol/_shared/static/use-lol-static";
import type { LolStaticBundle } from "@vyoh/shared";

export interface SummonerSpellInfo {
  iconUrl: string;
  name: string;
}

function buildSummonerSpellsMap(bundle: LolStaticBundle): Map<number, SummonerSpellInfo> {
  const patch = bundle.patchVersion ?? "16.9.1";
  return new Map(
    bundle.summonerSpells
      .filter((s) => s.retiredAt == null)
      .map((s) => [s.id, { iconUrl: summonerSpellIconUrl(s.id, patch), name: s.name }])
  );
}

// Same shape as use-perks: derived from the bundled `/lol/static` payload;
// icon bytes come from the `/img/lol/spell/:id/:patch.webp` proxy.
export function useSummonerSpells(): Map<number, SummonerSpellInfo> | undefined {
  return useLolStaticSelect(buildSummonerSpellsMap).data;
}
