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
/**
 * The same outline role for a drawn mark rather than a glyph — an accent-tinted
 * curve on a splash disappears for the identical hue-collision reason, and a
 * shadow tier cannot help a 2px line. Pair with `Sparkline`'s `outline` prop,
 * which paints it underneath the stroke exactly as `paint-order: stroke` does
 * for text. Matches `STROKE_ACCENT`'s alpha so the two treatments agree when a
 * curve sits beside accent copy.
 */
export const OUTLINE_ACCENT_CURVE = "rgba(0,0,0,0.92)";

/**
 * Body/label-tier text-stroke for legibility on bright splashes where the
 * 3-layer shadow alone can't cut through (e.g. Pragmata's near-white left
 * third, Lunar Supremacy's pale armor). Same role as `STROKE_ACCENT` but
 * sized down for small uppercase labels and body copy — 0.75px on 10–14px
 * text reads as an outline, not an inflation. Pair with `paintOrder:
 * stroke` at the call site so the stroke paints UNDERNEATH the fill (the
 * white glyph keeps its full character width; the stroke acts as a thin
 * outline rather than swelling the letterform).
 *
 * When to apply: uppercase-tracked editorial labels (eyebrows, section
 * headers, band labels) on chapters that may sit over bright/light
 * splashes. Body prose can stick with `SHADOW_BODY` alone — the larger
 * type already cuts through the shadow tier.
 */
export const STROKE_LABEL = "0.75px rgba(0,0,0,0.85)";
