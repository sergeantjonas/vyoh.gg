// URL helpers for the bounded LoL asset universe. Resolves alias/id lookups
// against a slim, presence-only mirror of the build-time manifest
// (manifest.gen.ts), then derives the bundled asset path from bucket
// conventions. The full manifest.json stays in public/ for the refresh
// script's diffing — it is intentionally NOT imported here to keep it out
// of the JS bundle. See docs/working-notes/lol-image-pipeline.md Decision 3.
import {
  championVariants,
  itemIds,
  roleIconSlugs,
  runeIds,
  manifestPatch as runtimePatch,
  summonerSpellIds,
} from "./manifest.gen";

export type ChampionVariant = "square" | "card" | "backdrop";

const VARIANT_BIT: Record<ChampionVariant, number> = {
  square: 1,
  card: 2,
  backdrop: 4,
};

const SWARM_PREFIX = "Strawberry_";
export function normalizeChampionAlias(alias: string): string {
  return alias.startsWith(SWARM_PREFIX) ? alias.slice(SWARM_PREFIX.length) : alias;
}

export function getChampionAsset(
  alias: string,
  variant: ChampionVariant
): string | undefined {
  const key = normalizeChampionAlias(alias);
  const bits = championVariants[key];
  if (bits === undefined) return undefined;
  if ((bits & VARIANT_BIT[variant]) === 0) return undefined;
  return `/lol/champions/${key}/${variant}.webp`;
}

export function getItemAsset(id: number | string): string | undefined {
  const key = String(id);
  return itemIds.has(key) ? `/lol/items/${key}.webp` : undefined;
}

export function getRuneAsset(id: number | string): string | undefined {
  const key = String(id);
  return runeIds.has(key) ? `/lol/runes/${key}.webp` : undefined;
}

export function getSummonerSpellAsset(id: number | string): string | undefined {
  const key = String(id);
  return summonerSpellIds.has(key) ? `/lol/summoner-spells/${key}.webp` : undefined;
}

export function getRoleIconAsset(slug: string): string | undefined {
  return roleIconSlugs.has(slug) ? `/lol/role-icons/position-${slug}.svg` : undefined;
}

export const manifestPatch = runtimePatch;
