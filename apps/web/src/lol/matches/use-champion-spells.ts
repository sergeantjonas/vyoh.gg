import { abilityIconUrl } from "@/lol/_shared/assets/champion-icon";
import { useLolStaticSelect } from "@/lol/_shared/static/use-lol-static";
import type { LolStaticBundle } from "@vyoh/shared";

// Identity-only spell row. Descriptions are fetched per-spell via
// `useAbilityDescription` (lazy endpoint with patch-watermark caching) so
// the bundle stays small and never blocks on the wiki-template sync. See
// docs/working-notes/lol/lazy-ability-descriptions.md.
export interface SpellInfo {
  championId: number;
  slot: string;
  abilityIndex: number;
  iconUrl: string;
  name: string;
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

  // Proxy URLs use the bundle's patchVersion as a cache key. Falls back to
  // "0" on cold-start (before the first static sync) — the proxy ignores the
  // value anyway since wiki URLs are stable.
  const patch = bundle.patchVersion ?? "0";

  const result = new Map<string, SpellInfo[]>();
  for (const [aliasOrName, id] of idByAlias.entries()) {
    const championName = nameById.get(id);
    if (!championName) continue;
    const abilities = bundle.championAbilities[id] ?? [];
    const spells: SpellInfo[] = SLOTS_IN_ORDER.map((slot) => {
      const ability = abilities.find((a) => a.slot === slot);
      if (!ability) {
        return { championId: id, slot, abilityIndex: 0, iconUrl: "", name: "" };
      }
      return {
        championId: id,
        slot,
        abilityIndex: ability.abilityIndex,
        iconUrl: abilityIconUrl(id, slot, ability.abilityIndex, patch),
        name: ability.name,
      };
    });
    result.set(aliasOrName, spells);
  }
  return result;
}

// Returns sync identity for a champion's Q/W/E/R rows (id, slot,
// abilityIndex, icon URL, display name) from the `/lol/static` bundle.
// Descriptions are fetched per-spell via `useAbilityDescription`.
export function useChampionSpells(championName: string): SpellInfo[] | undefined {
  const index = useLolStaticSelect(buildChampionSpellsIndex).data;
  if (!index) return undefined;
  return index.get(championName);
}
