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

// Steam apps to never surface as a subject chapter, even if score qualifies.
// Non-game appTypes (tools, utilities — Wallpaper Engine, 3DMark) are
// filtered server-side in `recap-subjects.service.ts` via the standard
// `appType === null || appType === 0` rule shared with the library filter.
// This list is for apps that ARE games but the owner doesn't want surfaced
// on the portfolio. Mirrored server-side in `recap-curation.ts` — keep in sync.
export const HIDDEN_APPIDS: readonly number[] = [
  1034140,
  1091500, // Cyberpunk 2077 — high lifetime hours, but stale; don't feature on `/`
];

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
// chapter visuals can be reviewed without a real qualifying candidate
// (FIRST_TIME_GAME requires firstSeenAt within 30d + ≥30 min of post-add
// session minutes — common to have zero matches on a stable library).
// Same multi-slot shape as `DEV_LOL_MOMENT_OVERRIDE`; set to `[]` outside
// active visual review. The `appid` should point to a real owned game so
// the hero image resolves; `name` drives the masthead text.
export const DEV_STEAM_MOMENT_OVERRIDE: readonly SteamMomentChapterDescriptor[] = [];
