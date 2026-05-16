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

const map = assets.champions as Record<string, ChampionAsset>;

export function championTheme(alias: string): ChampionAsset {
  return map[normalizeChampionAlias(alias)] ?? FALLBACK;
}
