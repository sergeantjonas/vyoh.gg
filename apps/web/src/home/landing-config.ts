// Owner-curated overlay on the algorithmic chapter selection for `/`.
// Hard-coded — no admin UI — per
// docs/working-notes/cross-cutting/self-portrait-recap-arc.md (ADR-6).
// Edit by hand; commit the change. Promotes to an admin surface later only
// if editing weekly becomes annoying.

import { wikiFileIconUrl } from "@/lol/_shared/assets/champion-icon";

export type AhriSkinEntry = {
  /** Display name for the skin (used as the lede chip while the chapter
   *  rests on that skin). "Base" renders the default-classic splash. */
  name: string;
  /**
   * Optional splash URL override. When omitted the chapter falls back to
   * the base Ahri backdrop served by the image proxy. Provide an explicit
   * URL to wire a skin splash today — the image proxy will gain a skin-
   * index segment in a later chunk, at which point this field can move to
   * `skinNum` and the URL composition becomes proxy-routed.
   */
  imageUrl?: string;
};

// Ahri-chapter splash rotation. Each non-Base entry pulls its splash from
// the wiki via the API image proxy (`wikiFileIconUrl` — same path used by
// rich tooltip icons). Owner can extend by adding `{ name, imageUrl }`
// pairs; rotation breakpoints and bloom transitions derive from the array
// length, so adding a skin is one edit.
export const AHRI_SKIN_ROTATION: readonly AhriSkinEntry[] = [
  { name: "Base" },
  {
    name: "Spirit Blossom",
    imageUrl: wikiFileIconUrl("Ahri_SpiritBlossomSkin.jpg"),
  },
  {
    name: "After Hours Spirit Blossom Springs",
    imageUrl: wikiFileIconUrl("Ahri_AfterHoursSpiritBlossomSpringsSkin.jpg"),
  },
  {
    name: "Immortalized Legend",
    imageUrl: wikiFileIconUrl("Ahri_ImmortalizedLegendSkin.jpg"),
  },
  {
    name: "Risen Legend",
    imageUrl: wikiFileIconUrl("Ahri_RisenLegendSkin.jpg"),
  },
  {
    name: "Midnight",
    imageUrl: wikiFileIconUrl("Ahri_MidnightSkin.jpg"),
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
