import assets from "@/data/champion-assets.json";

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
  return map[alias] ?? FALLBACK;
}
