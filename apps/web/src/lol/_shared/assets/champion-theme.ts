import assets from "./champion-assets.json";
import { normalizeChampionAlias } from "./champion-icon";

interface ChampionAsset {
  dominantHex: string;
  blurhash: string;
}

const FALLBACK: ChampionAsset = {
  dominantHex: "#888888",
  blurhash: "L26@7uIU00ay00ay~qj[%Mj[xufQ",
};

// Callers pass aliases in either casing — PascalCase from Riot
// (`myParticipant.championName`) or lowercase from URL slugs
// (`Route.useParams().championKey`). Build a lowercased index once so the
// lookup tolerates both. Without this, lowercase URL keys silently fall
// through to FALLBACK and every champion renders as #888888.
const map = assets.champions as Record<string, ChampionAsset>;
const lowercaseIndex: Record<string, ChampionAsset> = {};
for (const [alias, asset] of Object.entries(map)) {
  lowercaseIndex[alias.toLowerCase()] = asset;
}

export function championTheme(alias: string): ChampionAsset {
  const normalized = normalizeChampionAlias(alias);
  return lowercaseIndex[normalized.toLowerCase()] ?? FALLBACK;
}
