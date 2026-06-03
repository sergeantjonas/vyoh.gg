// Per-momentType typographic accent — the per-chapter colour signature that
// distinguishes moment kinds at a glance. Drives the eyebrow + inline
// `<Accent>` colour on both `lol-moment-chapter.tsx` and
// `steam-moment-chapter.tsx`. The atmosphere backdrop accent (set by the
// asset claim) stays game/champion-derived so the page background still
// harmonises with the splash; this lever shifts only the TYPOGRAPHIC
// register, giving each moment chapter a recognisable colour identity
// without breaking the spatial atmosphere.
//
// Palette principles:
//   - Positive sequence beats (Hot streak, Marathon endurance) live in the
//     warm-green-to-amber range.
//   - Negative sequence beats (Cold streak) live in rose.
//   - Peak / "this was your best" beats (RANK_UP, KDA_OUTLIER) share gold.
//   - Curious / return / fresh beats land in violet/teal/sky.
//   - Steam-side moments (FIRST_TIME_GAME, ACHIEVEMENT_CLUSTER) get their
//     own family so they don't collide with LoL moment colours.
// Each class is a single Tailwind `text-*-300` so the contrast against the
// blurred-splash backdrop matches the existing stroke-outlined accent
// shape (paint-order + textShadow are applied at the call site).

import type {
  LolMomentChapterDescriptor,
  SteamMomentChapterDescriptor,
} from "@vyoh/shared";

export type MomentAccentType =
  | LolMomentChapterDescriptor["momentType"]
  | SteamMomentChapterDescriptor["momentType"];

export function momentAccentClass(momentType: MomentAccentType): string {
  switch (momentType) {
    case "RANK_UP":
      return "text-amber-300";
    case "KDA_OUTLIER":
      return "text-yellow-200";
    case "STREAK_5W":
      return "text-emerald-300";
    case "STREAK_5L":
      return "text-rose-300";
    case "MARATHON":
      return "text-orange-300";
    case "RETURN_FROM_HIATUS":
      return "text-violet-300";
    case "OFF_META_PICK":
      return "text-sky-300";
    case "FIRST_TIME_GAME":
      return "text-teal-300";
    case "ACHIEVEMENT_CLUSTER":
      return "text-fuchsia-300";
  }
}
