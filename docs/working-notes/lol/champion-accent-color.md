# Champion accent color extraction

**Status:** Shipped 2026-05-26 — iconic-color picker that combines wiki Loading + Square palettes, ranks by chroma, and applies a 3-entry override list for the residual stuck cases. Drives the per-champion `--theme-color` cascade across `accent-color`, `::selection`, `--theme-fg`, `--theme-strong`.

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

## Follow-up 2026-05-26 — iconic-color picker

Initial regeneration shipped with single-source (full splash) + Vibrant-slot priority. Visual review with the owner exposed two further problems:

1. **Case-mismatch in `championTheme()` lookup.** `champion-table.tsx:345` constructs URL params with `alias.toLowerCase()`, but `champion-assets.json` keys are PascalCase. Every champion fell through to `#888888` FALLBACK; the visible variation people thought they saw was actually the splash backdrop image, not the CSS cascade. Fixed with a case-insensitive lookup index built once at module load. Now in [champion-theme.ts](../../../apps/web/src/lol/_shared/assets/champion-theme.ts).
2. **Non-iconic picks for some champions.** Even with correct data flow, node-vibrant's `Vibrant` slot picks the most-saturated mid-L cluster regardless of surface area, which surfaces small accent colors (Ahri's blue orb) over the iconic outfit hue (Ahri's red dress). Worked through several picker variants before landing on the current approach.

**Final picker** (in [tools/champion-assets/src/index.ts](../../../tools/champion-assets/src/index.ts)):

- **Sources**: union of two wiki images per champion:
  - `OriginalLoading.jpg` (308×560 portrait) — surfaces outfit colors when prominent (Wukong red sash, Kai'Sa purple suit, Seraphine pink hair).
  - `OriginalSquare.png` (~120×120 head crop) — surfaces hood/cape/aura colors that loading misses (Akali green hood, Yasuo sky-blue, Garen Demacia-blue).
- **Picker**: union both palettes (12 swatches max), filter to `population > 0`, sort by HSL chroma descending, take the most-saturated. **Population is deliberately ignored** — every population-weighted score tested loses to large face/skin Muted clusters (e.g. `Loading Muted pop=469` smothers Akali's hood `Vibrant pop=2`). The only way to surface iconic outfit hues is to rank by chroma.
- **Overrides**: `tools/champion-assets/src/overrides.ts` lists the residual cases where no algorithm can recover the iconic color from the current splash pixels. Currently 3 entries: Ahri (red dress out-pixelled by blue), Lux (gold quantization-blurred to beige), Soraka (no saturated white/teal cluster anywhere).

**Image sourcing now wiki-primary** — previously CDragon-direct, now routed through wiki to honour the project's wiki-primary image rule. Champion-summary metadata still comes from CDragon (text, not images).

**Cascade extension to native primitives**: `accent-color` and `::selection` are now declared on `:root` in [index.css:298-315](../../../apps/web/src/index.css#L298-L315) referencing `var(--theme-fg)` (the chroma-boosted, lightness-lifted derivation of `--theme-color`). Form controls and text selection now read as the champion's identity color in dark mode.

## Future extensions

- **Other color-extraction libraries** — node-vibrant's median-cut quantization blurs gradient halos into desaturated mid-tones (Lux gold → beige) and doesn't surface small-population saturated clusters reliably. Worth evaluating `colorthief`, `colorgram`, or a hand-rolled HSV histogram with hue bucketing. Goal: reduce the override list from 3 toward 0. Not blocking — current results are good enough to ship and the override is the escape hatch.
- **Steam game accents** — same picker shape will apply when that pipeline lands. Extract per-app dominant from the Steam header asset, write alongside the other `SteamGameEnrichment` fields, expose through a `steamGameTheme()` helper symmetric to `championTheme()`. Decide whether the same hybrid-source approach applies (Steam doesn't have a "loading screen" equivalent — likely just the library hero + capsule).
