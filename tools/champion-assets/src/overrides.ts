// Hand-picked `dominantHex` overrides for champions where the algorithm
// (highest-chroma cluster across Loading + Square palettes) lands on a
// non-iconic color due to a property of the current splash art:
//
// - Ahri: red dress is genuinely out-pixelled by blue orb + fox-fire wisps
//   + dark backdrop. No statistical pick recovers red.
// - Lux: gold magic + blonde hair desaturate into beige/peach during
//   node-vibrant's median-cut quantization (gradient halos blur pure gold
//   into mid-saturation tones).
// - Soraka: pale lavender/teal identity isn't present as a saturated
//   cluster anywhere in her current splash.
//
// Keep this list as small as possible — every override is a maintenance
// debt that needs revisiting if Riot reworks a champion's splash. Try the
// algorithm first; only override when the iconic disagreement is obvious.
//
// To add a champion: alias is the Riot key (PascalCase, e.g. "MonkeyKing"
// for Wukong, "KaiSa" for Kai'Sa — case matches `champion-summary.json`).
export const CHAMPION_COLOR_OVERRIDES: Record<string, string> = {
  Ahri: "#c8233e",
  Lux: "#e6b840",
  Soraka: "#9b8be3",
};
