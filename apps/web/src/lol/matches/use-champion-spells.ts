import { useLolStaticSelect } from "@/lol/_shared/static/use-lol-static";
import { type LolStaticBundle, stripWikitext, wikiAbilityIconUrl } from "@vyoh/shared";

export interface SpellInfo {
  iconUrl: string;
  name: string;
  description: string;
}

// Slot ordering matches match-skill-order's row layout: Q, W, E, R. The
// passive row is rendered separately and is not part of the four-spell array
// the consumer iterates over.
const SLOTS_IN_ORDER = ["Q", "W", "E", "R"] as const;

function buildChampionSpellsIndex(bundle: LolStaticBundle): Map<string, SpellInfo[]> {
  const idByAlias = new Map<string, number>();
  const nameById = new Map<number, string>();
  for (const c of bundle.champions) {
    if (c.id === -1) continue;
    idByAlias.set(c.alias, c.id);
    idByAlias.set(c.name, c.id);
    nameById.set(c.id, c.name);
  }

  const result = new Map<string, SpellInfo[]>();
  for (const [aliasOrName, id] of idByAlias.entries()) {
    const championName = nameById.get(id);
    if (!championName) continue;
    const abilities = bundle.championAbilities[id] ?? [];
    const spells: SpellInfo[] = SLOTS_IN_ORDER.map((slot) => {
      const ability = abilities.find((a) => a.slot === slot);
      if (!ability) return { iconUrl: "", name: "", description: "" };
      const rawDescription = ability.descriptionHtml ?? ability.descriptionWikitext ?? "";
      return {
        iconUrl: wikiAbilityIconUrl(championName, ability.name),
        name: ability.name,
        description: stripWikitext(rawDescription),
      };
    });
    result.set(aliasOrName, spells);
  }
  return result;
}

// Pulls the Q/W/E/R ability data for a champion from the bundled `/lol/static`
// payload. Icons resolve to wiki image URLs via `wikiAbilityIconUrl`, names
// come from `Module:ChampionData/data`, and descriptions follow the same
// drift-tolerant policy as items: `descriptionHtml` is preferred when the
// MediaWiki per-template sync has populated it, falling back to raw
// wikitext while the API catches up. Empty string when neither has landed.
export function useChampionSpells(championName: string): SpellInfo[] | undefined {
  const index = useLolStaticSelect(buildChampionSpellsIndex).data;
  if (!index) return undefined;
  return index.get(championName);
}
