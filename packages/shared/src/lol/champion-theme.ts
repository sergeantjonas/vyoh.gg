// Champion accent colors + blurhashes, one entry per champion, extracted from
// wiki art by `tools/champion-assets` into `champion-assets.gen.ts`. Shared
// because both renderers of the season artwork resolve colors through it: the
// web recap band inline, and the api when it seeds an OG-card background.
import { CHAMPION_ASSETS } from "./champion-assets.gen.ts";

export interface ChampionAsset {
  dominantHex: string;
  blurhash: string;
}

/** Shape of the generated `champion-assets.gen.ts` payload. */
export interface ChampionAssetsFile {
  generated: string;
  count: number;
  champions: Record<string, ChampionAsset>;
}

const FALLBACK: ChampionAsset = {
  dominantHex: "#888888",
  blurhash: "L26@7uIU00ay00ay~qj[%Mj[xufQ",
};

// Swarm-mode (and similar event-mode) aliases prefix the base champion; the
// wiki has no separate art for them, so they resolve to the base entry.
const SWARM_PREFIX = "Strawberry_";
export function normalizeChampionAlias(alias: string): string {
  return alias.startsWith(SWARM_PREFIX) ? alias.slice(SWARM_PREFIX.length) : alias;
}

// Callers pass aliases in either casing — PascalCase from Riot
// (`myParticipant.championName`) or lowercase from URL slugs
// (`Route.useParams().championKey`). Build a lowercased index once so the
// lookup tolerates both. Without this, lowercase URL keys silently fall
// through to FALLBACK and every champion renders as #888888.
const lowercaseIndex: Record<string, ChampionAsset> = {};
for (const [alias, asset] of Object.entries(CHAMPION_ASSETS.champions)) {
  lowercaseIndex[alias.toLowerCase()] = asset;
}

export function championTheme(alias: string): ChampionAsset {
  const normalized = normalizeChampionAlias(alias);
  return lowercaseIndex[normalized.toLowerCase()] ?? FALLBACK;
}
