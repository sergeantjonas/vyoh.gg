// Owner-curated overlay on the algorithmic chapter selection for `/`.
// Hard-coded — no admin UI — per
// docs/working-notes/cross-cutting/self-portrait-recap-arc.md (ADR-6).
// Edit by hand; commit the change. Promotes to an admin surface later only
// if editing weekly becomes annoying.

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

// Steam apps to never surface as a subject chapter, even if score qualifies.
// Note: store API `type !== "game"` already filters most utilities
// (Wallpaper Engine, 3DMark) — this list is for apps that ARE games but the
// owner doesn't want surfaced on the portfolio. Lands populated in R-4.
export const HIDDEN_APPIDS: readonly number[] = [];

// LoL queue ids to exclude from moment-chapter detection (custom games,
// tutorials). Ranked / draft / aram / arena stay included. Lands populated
// in R-4 / R-6.
export const HIDDEN_QUEUE_IDS: readonly number[] = [];

// Pin one chapter to the top regardless of score. `null` = pure algorithmic
// ordering once `useChapters()` lands in R-4. Set to a chapter slug (e.g.
// "ahri") to override.
export const PINNED_CHAPTER: string | null = null;
