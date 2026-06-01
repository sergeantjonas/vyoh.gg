/**
 * Text-shadow tier strategy shared across subject chapters. Each shadow is
 * built from `[hard zero-blur inner] + [tight halo] + [soft outer glow]`.
 *
 * The hard inner is the load-bearing layer — it cuts the glyph edge from
 * any background (bright or dark) regardless of background chroma. Soft
 * blur alone fades into bright splashes (Risen Legend gold, Immortalized
 * sand, Resident Evil's warm beige hero) because the halo's lightness
 * matches the background. The outer glow adds depth without taking on the
 * readability load.
 *
 * Crystallized from the R-2 Ahri chapter build (see
 * `docs/working-notes/cross-cutting/subject-chapter-design-spec.md`).
 * Promoted here when R-3's Steam chapter began consuming the same tiers
 * verbatim — single source of truth for every subject chapter going forward.
 */
export const SHADOW_MASTHEAD =
  "0 1px 0 rgba(0,0,0,0.9), 0 0 3px rgba(0,0,0,0.85), 0 2px 16px rgba(0,0,0,0.6)";
export const SHADOW_BODY =
  "0 1px 0 rgba(0,0,0,0.9), 0 0 2px rgba(0,0,0,0.85), 0 1px 6px rgba(0,0,0,0.55)";
export const SHADOW_LABEL =
  "0 1px 0 rgba(0,0,0,0.9), 0 0 2px rgba(0,0,0,0.85), 0 1px 4px rgba(0,0,0,0.55)";
/**
 * Accent-tinted labels (per-subject dominantHex) hide on splashes whose
 * chroma matches the accent — red-on-red on After Hours / RE4 splashes,
 * warm gold on Risen Legend. Hue collision (not brightness) caps standard
 * shadow's effectiveness, so accent glyphs need a true outline. Pair with
 * `paint-order: stroke` + `WebkitTextStroke: STROKE_ACCENT` at the call
 * site — the stroke is painted underneath the fill so the colored glyph
 * stays at original width and the stroke acts as an outline, not an
 * inflated boundary.
 */
export const SHADOW_ACCENT = "0 1px 2px rgba(0,0,0,0.65), 0 0 6px rgba(0,0,0,0.55)";
export const STROKE_ACCENT = "1.25px rgba(0,0,0,0.92)";
