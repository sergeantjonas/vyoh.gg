// Owner-curated overlay on the algorithmic chapter selection for `/`.
// Hard-coded — no admin UI — per
// docs/working-notes/cross-cutting/self-portrait-recap-arc.md (ADR-6).
// Edit by hand; commit the change. Promotes to an admin surface later only
// if editing weekly becomes annoying.

import type {
  LolMomentChapterDescriptor,
  SteamMomentChapterDescriptor,
} from "@vyoh/shared";

import { wikiSplashUrl } from "@/lol/_shared/assets/champion-icon";

export type AhriSkinEntry = {
  /** Display name for the skin (used as the lede chip while the chapter
   *  rests on that skin). "Base" renders the default-classic splash. */
  name: string;
  /**
   * Optional splash URL override. When omitted the chapter falls back to
   * the base Ahri backdrop served by the image proxy. Use `wikiSplashUrl`
   * for skin art — the dedicated wiki-splash proxy route transcodes at
   * 1920px wide (vs 32px for the tooltip-icon route).
   */
  imageUrl?: string;
};

// Ahri-chapter splash rotation. Auto-cycles via `useSkinRotation` — each
// entry holds for a few seconds, with a soft blur-bloom crossfade between
// adjacent skins. Owner can extend by adding `{ name, imageUrl }` pairs;
// the cycle picks them up automatically.
export const AHRI_SKIN_ROTATION: readonly AhriSkinEntry[] = [
  { name: "Base", imageUrl: wikiSplashUrl("Ahri_OriginalSkin_HD.jpg") },
  {
    name: "Spirit Blossom",
    imageUrl: wikiSplashUrl("Ahri_SpiritBlossomSkin_HD.jpg"),
  },
  {
    name: "After Hours Spirit Blossom Springs",
    imageUrl: wikiSplashUrl("Ahri_AfterHoursSpiritBlossomSpringsSkin_HD.jpg"),
  },
  {
    name: "Immortalized Legend",
    imageUrl: wikiSplashUrl("Ahri_ImmortalizedLegendSkin_HD.jpg"),
  },
  {
    name: "Risen Legend",
    imageUrl: wikiSplashUrl("Ahri_RisenLegendSkin_HD.jpg"),
  },
  {
    name: "Midnight",
    imageUrl: wikiSplashUrl("Ahri_MidnightSkin_HD.jpg"),
  },
];

// Hardcoded featured Steam appid for the R-3 chapter. Promotes to algorithmic
// selection in R-4 (`useChapters()` with recency-decayed scoring). Edit by
// hand when you want to feature a different game on `/`. Defaults to the
// most recently unlocked-against game while R-3 is the only Steam chapter
// on the page; queries `/steam/achievements/recent?limit=1` to pick a
// candidate when you're not sure what's fresh.
export const STEAM_FEATURED_APPID = 2050650; // Resident Evil 4

// Apps that ARE games but the owner doesn't want surfaced as a chapter subject
// live in the `SteamGameCuration` table on the `unfeatured` axis, edited through
// `admin/steam-games` rather than here — a hand-mirrored copy on both sides of
// the api boundary is what this file used to carry, and the two drifted by
// definition. Non-game appTypes (tools, utilities — Wallpaper Engine, 3DMark)
// are still filtered server-side via the `appType === null || appType === 0`
// rule shared with the library filter.

// LoL queue ids to exclude from moment-chapter detection (custom games,
// tutorials). Ranked / draft / aram / arena stay included. Lands populated
// in R-4 / R-6.
export const HIDDEN_QUEUE_IDS: readonly number[] = [];

// Pin one chapter to the top regardless of score. `null` = pure algorithmic
// ordering once `useChapters()` lands in R-4. Set to a chapter slug (e.g.
// "steam-2050650") to override. The Ahri chapter is a structural anchor
// rendered above this list and isn't part of the algorithmic stream, so
// pinning it has no effect — pin a Steam or moment slug.
export const PINNED_CHAPTER: string | null = null;

// Curator copy overlay applied on top of the algorithmic descriptor.
// `eyebrow` overrides the bucket-derived kicker ("Playing lately", "This
// season on", …) for a chapter the owner wants framed differently
// ("Featured", "Editor's pick"); `title` overrides the per-kind default
// title (currently the game name for steam-subject). Keyed by chapter
// `slug` — for Steam subjects that's `steam-{appid}`. Empty by default;
// add entries as needed.
export const CHAPTER_COPY_OVERRIDES: Record<
  string,
  { eyebrow?: string; title?: string }
> = {};

// Dev override: when populated, prepends synthetic LoL-moment descriptors at
// the head of the algorithmic chapter stream so the chapter visuals can be
// reviewed even when the detector finds no qualifying real candidates (most
// moment detectors use a 30d window — owners on a quiet stretch surface
// nothing). Set to `[]` outside active visual review — the detectors handle
// production. The matchId should point to a real owner match if you want
// the masthead link to resolve; the championAlias picks the splash.
export const DEV_LOL_MOMENT_OVERRIDE: readonly LolMomentChapterDescriptor[] = [];

// Dev override: prepends synthetic Steam-moment descriptors at the head of
// the algorithmic chapter stream so the FIRST_TIME_GAME / ACHIEVEMENT_CLUSTER
// / LAUNCH_RARITY_DRIFT chapter visuals can be reviewed without a real
// qualifying candidate (FIRST_TIME_GAME requires firstSeenAt within 30d +
// ≥30 min of post-add session minutes — common to have zero matches on a
// stable library; LAUNCH_RARITY_DRIFT needs three unlocks bracketed by a
// rarity sample on a game played inside its release window).
// Same multi-slot shape as `DEV_LOL_MOMENT_OVERRIDE`; set to `[]` outside
// active visual review. The `appid` should point to a real owned game so
// the hero image resolves; `name` drives the masthead text.
export const DEV_STEAM_MOMENT_OVERRIDE: readonly SteamMomentChapterDescriptor[] = [];

// Beast of Reincarnation, the day-one title the launch-drift beat was built
// against. Paste into the override above to review the LAUNCH_RARITY_DRIFT
// visuals; the percentages are the real third-reading values.
// {
//   kind: "steam-moment",
//   slug: "steam-moment-launch-drift-2001760",
//   momentType: "LAUNCH_RARITY_DRIFT",
//   score: 15,
//   daysSince: 2,
//   ageBucket: "current",
//   appid: 2001760,
//   name: "Beast of Reincarnation",
//   firstTime: null,
//   cluster: null,
//   framing: null,
//   launchDrift: {
//     releaseDate: "2026-08-03",
//     observedFrom: "2026-08-04T05:30:00.000Z",
//     observedTo: "2026-08-31T05:30:00.000Z",
//     observationCount: 12,
//     bracketedUnlockCount: 7,
//     headline: {
//       apiName: "corvus_end",
//       displayName: "Corvus's End",
//       unlockedAt: "2026-08-05T21:14:00.000Z",
//       percentAtUnlock: 0.7,
//       percentNow: 28.4,
//     },
//     curve: [0.7, 2.1, 6.2, 9.8, 13.4, 16.1, 18.9, 21.7, 24.0, 25.8, 27.2, 28.4],
//     receipt: [
//       { apiName: "corvus_end", displayName: "Corvus's End", unlockedAt: "2026-08-05T21:14:00.000Z", percentAtUnlock: 0.7, percentNow: 28.4 },
//       { apiName: "bestie", displayName: "Bestie", unlockedAt: "2026-08-05T22:02:00.000Z", percentAtUnlock: 1.4, percentNow: 34.3 },
//       { apiName: "taurus_end", displayName: "Taurus's End", unlockedAt: "2026-08-06T19:40:00.000Z", percentAtUnlock: 1.5, percentNow: 34.8 },
//       { apiName: "closest_companion", displayName: "Closest Companion", unlockedAt: "2026-08-07T20:11:00.000Z", percentAtUnlock: 3.2, percentNow: 38.4 },
//       { apiName: "munitions_master", displayName: "Munitions Master", unlockedAt: "2026-08-16T18:25:00.000Z", percentAtUnlock: 3.4, percentNow: 5.7 },
//     ],
//   },
// },
