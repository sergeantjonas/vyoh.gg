// Tier → Tailwind colour maps, shared by the hero rank strip and any surface
// that tints by rank tier. Kept in one module so the text colour and its glow
// bloom stay the same hue family and can't drift apart.

export const TIER_COLOR: Record<string, string> = {
  IRON: "text-slate-400",
  BRONZE: "text-orange-500",
  SILVER: "text-slate-300",
  GOLD: "text-amber-400",
  PLATINUM: "text-teal-300",
  EMERALD: "text-emerald-400",
  DIAMOND: "text-sky-400",
  MASTER: "text-violet-400",
  GRANDMASTER: "text-rose-400",
  CHALLENGER: "text-yellow-300",
};

// `bg-*` mirror of TIER_COLOR's hues, for the blurred emblem backlight.
export const TIER_GLOW: Record<string, string> = {
  IRON: "bg-slate-400",
  BRONZE: "bg-orange-500",
  SILVER: "bg-slate-300",
  GOLD: "bg-amber-400",
  PLATINUM: "bg-teal-300",
  EMERALD: "bg-emerald-400",
  DIAMOND: "bg-sky-400",
  MASTER: "bg-violet-400",
  GRANDMASTER: "bg-rose-400",
  CHALLENGER: "bg-yellow-300",
};
