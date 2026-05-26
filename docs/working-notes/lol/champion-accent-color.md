# Champion accent color extraction

**Status:** Shipped 2026-05-26 — regenerated `champion-assets.json` via the existing `tools/champion-assets` pipeline; corrected the tool's stale output path. No schema change, no consumer flip. The visible `accent-color` / `::selection` / `--theme-fg` / `--theme-strong` cascade now varies per champion.

## What turned out to be the actual fix

I went into this expecting to extract a second swatch (`accentHex`) alongside `dominantHex` because the dim values in the old JSON (`#080808`, `#081828`, `#282818` — heavily quantized, low-chroma) looked like node-vibrant's `DarkVibrant` slot leaking into a "vibrant" pick. The plan was to add a separate UI-accent picker with an HSL filter and flip four consumer sites to read the new field.

What actually happened when I re-ran the tool:

1. **Regenerating produced properly saturated colors immediately** — Aatrox `#b94844` (sword-red), Ahri `#5979bd` (soul-blue), Akali `#795230` (ninja-brown), Annie `#b9744b` (fire-orange), Vladimir `#ba4a47` (blood-red), Lux `#c03442`, etc. The same picker (`Vibrant ?? LightVibrant ?? DarkVibrant ?? Muted`) returned vibrant clusters on every champion.
2. **I tried an accent picker anyway with a stricter filter and a different priority order** — it returned the exact same hex for every champion (zero divergence across 191 entries). The Vibrant slot was always non-null and always passed the filter, so the second pick collapsed onto the first.
3. **So the new field added no information** — keeping it would be 1.4KB of duplicated hex strings and a YAGNI schema split. Reverted to single-field `dominantHex`.

## Why the old JSON was dim — likely cause

The old JSON was generated 2026-05-13 by an earlier run of the same tool. Most likely cause is a stale tool output path: until this change, `tools/champion-assets/src/index.ts` wrote to `apps/web/src/data/champion-assets.json` (a directory that no longer exists), but the consumer reads from `apps/web/src/lol/_shared/assets/champion-assets.json`. The committed JSON at the consumer path was a checked-in artefact from before the consumer location moved — running the tool afterward would silently write to the orphan path and never touch the file the app actually loads.

Fixed the tool's output path in the same change. Now the build script writes to the canonical consumer path; future regens land in the right file.

## Changes that shipped

1. **`tools/champion-assets/src/index.ts`** — output path corrected from `apps/web/src/data/champion-assets.json` (orphan) to `apps/web/src/lol/_shared/assets/champion-assets.json` (consumer path). Added a comment block explaining the swatch-selection priority and why source chroma matters more than lightness given the dark-mode `--theme-fg = oklch(... max(l, 0.85) ...)` derivation.
2. **`apps/web/src/lol/_shared/assets/champion-assets.json`** — fully regenerated, 191 champions, all entries carry vibrant per-champion identity colors.

No consumer changes. The four sites that read `championTheme(...).dominantHex` ([champion-detail route](../../../apps/web/src/routes/lol/$accountSlug/champions/$championKey.tsx#L143), [match-detail route](../../../apps/web/src/routes/lol/$accountSlug/matches/$matchId.tsx#L136), [champion-card](../../../apps/web/src/lol/champions/champion-card.tsx#L19), [champion-sticky-strip](../../../apps/web/src/lol/_shared/ui/champion-sticky-strip.tsx#L37)) now receive proper vibrant colors via the existing wiring.

## Visual verification

Test surfaces:

- **Champion-detail page** (e.g. Zyra, Ahri, Aatrox) — checkbox in the Serious queues popover, text selection, derived `--theme-strong` / `--theme-fg` / `--theme-ring` tints should all reflect the champion's color.
- **Champion grid card hover** — per-card tint via `--theme-color` style prop.
- **Match-detail** — owner's champion in that match drives the cascade.
- **Sticky strip** — the per-champion ribbon on champion-detail.

If any consumer reads as "too loud" or "too washed out," the next move is to tune the derived-token formulas in [index.css:236-240](../../../apps/web/src/index.css#L236-L240) (chroma multiplier in `--theme-muted`, lightness clamp in `--theme-fg`) rather than the source value — the regenerated `dominantHex` is the right source, and per-surface intensity belongs in the derivations.

## Future extensions

Same fix shape will apply to Steam game accents when that pipeline lands — extracting a per-app dominant via node-vibrant from the Steam header asset, writing alongside the other `SteamGameEnrichment` fields, exposing through a `steamGameTheme()` helper symmetric to `championTheme()`. Not in scope for this arc.
