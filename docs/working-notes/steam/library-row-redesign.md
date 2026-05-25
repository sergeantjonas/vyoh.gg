# Steam library row redesign

**Status:** Researching. No implementation. Captures the design exploration for replacing the current 4-layer composition in [steam-game-row.tsx](../../../apps/web/src/steam/_shared/steam-game-row.tsx) with something that handles the full library cleanly. Tentative landing point is documented; alternatives kept so we can pivot if the chosen path doesn't survive contact with the real library.

Read this when: touching `steam-game-row.tsx`, evaluating an alternative composition, scoping enrichment-side image work, or onboarding to the Steam row's design constraints.

Related: [library-card-enrichment.md](library-card-enrichment.md) (sets up the SteamGameEnrichment table and asset URL composition).

---

## Problem framing

The row renders Steam's `library_hero.jpg` (1920×620, ~3.1:1) inside a row that's roughly 6:1 aspect (`h-32`/`h-36` at `max-w-4xl`). The aspect mismatch leaves ~50% empty width that has to be filled with *something*, and the choice of "what" is the design problem.

Current composition (4 layers):

1. Palette-gradient backdrop (`generatePaletteGradient` in [upstream.ts](../../../apps/api/src/img/upstream.ts)) — samples the asset's leftmost 200px, row-averages to 1px wide, stretches to 1920px, blurs. Goal: extend the asset's edge color leftward so the empty zone reads as a continuation of the hero.
2. Horizontal dark scrim — `linear-gradient(to_right, rgba(0,0,0,0.7) → 0)` over the leftmost 60% for text legibility.
3. Sharp foreground hero — `object-contain object-right`, `[mask-image:linear-gradient(to_right,transparent_0%,black_30%)]` so the asset's left edge feathers into the backdrop.
4. Wordmark logo + meta on the left, absolute-positioned over the scrim.

Plus the sheen overlay and view-transition morph anchors (`heroRef`, `logoRef`).

### Where the current composition fails

Based on the 25-asset sample (§ next) and the owner's read of currently-rendered cards:

- **Pragmata (one of the better-rendering cards today)**: works because the asset has a uniform white edge tone. Palette extension produces a smooth black-to-white gradient that reads as a deliberate banner. Confirms the system is *not* broken in general.
- **RE3 Remake (feels bad)**: asset's left edge is banded — sunset horizon glow + dark cloud sky + cityscape silhouette stacked vertically. Palette extension averages those bands and compresses the warm horizon (which carries the composition) into a thin band that doesn't run edge-to-edge anymore. Atmospheric continuity destroyed.
- **RE4 Remake (feels bad)**: Leon's close-up face occupies the asset's left half. Right-anchored contain + left-feather + scrim push Leon's face into the dimmed/feathered zone — partially obscured, gaze leading off-frame.
- **Wuchang (almost works)**: bright grey-white fog on the asset's left 60%. The palette extension produces a near-uniform grey, but a brighter vertical streak in the source corrupts it. The dark logo plate meets the bright fog with a visible tonal step.

The common failure mode: the extension-then-feather strategy destroys atmospheric continuity whenever the asset relies on full-width horizontal context (RE3, Wuchang) or pushes the subject into the feather zone (RE4). It succeeds only when the asset's left edge is a single uniform tone *and* the subject lives in the right half (Pragmata, Control).

---

## Sample set findings (25 assets)

Fetched via `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/{appid}/{asset}` and read locally. AppIDs:

User-named: 1287340 Pragmata, 2050650 RE4, 952060 RE3, 3489700 Stellar Blade, 570940 Dark Souls Remastered, 870780 Control.
Outliers: 28050 Deus Ex HR, 238010 Deus Ex HR DC, 337000 Deus Ex MD, 13520–2369390 Far Cry 1–6.
Pre-2019 era: 220 HL2, 620 Portal 2, 413150 Stardew Valley, 489830 Skyrim SE.
Wordmark-baked: 292030 Witcher 3, 1687950 Persona 5 Royal, 632470 Disco Elysium.
Busy/edge-to-edge: 1245620 Elden Ring, 1086940 BG3, 271590 GTA V.
Non-humanoid: 553420 Tunic, 1145360 Hades.

### Subject position distribution

- **Right ~36%**: Control, Witcher 3, Persona 5 Royal, GTA V, HL2, Tunic, Stellar Blade, Skyrim SE, FC6.
- **Center ~32%**: Elden Ring, Hades, RE3, Dark Souls Remastered, Deus Ex HR DC, FC2, FC4, Deus Ex MD.
- **Left ~16%**: BG3 (party group), RE4 (Leon close-up), Portal 2 (silhouette), FC3 (Vaas).
- **Distributed / edge-to-edge ~16%**: Disco Elysium (full-bleed painting), Stardew Valley (symmetric frame), FC5 (Last Supper line of 13), FC6 (full-bleed red atmosphere).

Right-anchored is the plurality, not the majority. Any design that *assumes* subjects sit on the right will misbehave for nearly two-thirds of a typical library.

### Edge-tone distribution

- **Bright left edge** (~30%): Witcher 3 (snowy mountains), HL2 (white fog), GTA V (orange Vinewood sky), FC2 (full-bleed orange/yellow), FC3 (bright tropical sky), FC4 (light mountains), FC5 (bright outdoor), Skyrim SE (light grey snow). These are the Pragmata family — but Pragmata succeeds where these fail because Pragmata's bright zone is *uniform white* and these are tonally banded.
- **Dark left edge**: most others.

### Pre-baked left-negative-space (assets drawn knowing Steam's UI overlay sits there)

Control (pure black left), Stellar Blade (starfield), Persona 5 Royal (dark with sparks), Hades (dark volcanic), Deus Ex HR DC (black left), Deus Ex MD (black left).

### Assets with no `library_hero.jpg` at the legacy CDN path

2 of 28 probed: Deus Ex HR original (28050), Far Cry 1 (13520). Both have `page_bg_generated_v6b.jpg` fallbacks that are already heavily blue/teal-washed — far more usable as a row backdrop than the non-v6b warm variants.

---

## Approaches considered

### A. Status quo — palette extension + feather + dim scrim

**Mechanism:** see § Problem framing.

**Handles well:** uniform-edge assets (Pragmata, Control), right-anchored subjects with dark left edges (most pre-baked-negative-space cases).

**Fails:** banded-edge assets (RE3 horizon, Wuchang fog with streak), left-anchored subjects (RE4, BG3 cast group), atmospheric continuity cases.

**Cost to keep:** $0. Already shipped.

**Verdict:** keep as the baseline to beat. If the recommended approach doesn't land, revert to this.

---

### B. Multiply-blend tonemap

**Mechanism:** drop the palette extension backdrop. Replace the dim scrim with `mix-blend-mode: multiply` over a dark gradient. Any source color × dark → dark, so bright left edges get categorically tonemapped to near-black before the eye perceives a seam. Hero stays `object-contain object-right`, no mask-fade.

**Handles well:** bright-left-edge family. Pragmata's white becomes dark, no muddy grey transition zone. Control unchanged.

**Fails:** atmospheric continuity cases (RE3, Wuchang) — multiply crushes the horizon glow and fog into uniform dark. *Worse* than status quo for the cases the owner currently flags as problematic. Doesn't address left-anchored subjects.

**Cost:** ~10 lines net deletion in [steam-game-row.tsx](../../../apps/web/src/steam/_shared/steam-game-row.tsx). No API or enrichment changes.

**Verdict:** rejected. Misdiagnosed which cases were failing; this fixes a problem the owner doesn't have and breaks ones they do.

---

### C. Frame inset (hero in rounded window)

**Mechanism:** hero contained inside an explicitly-bordered rounded window on the right (e.g. ~70% of row width). Outer chrome is intentional dark card with logo/meta. The seam is replaced by an explicit frame edge — no transition zone, no extension.

**Handles well:** categorically eliminates the seam by making the boundary intentional. Predictable across all asset types. Pragmata's white meets a hard frame, no grey ramp. RE3's horizon is preserved (whole asset visible inside the frame).

**Fails:** hero is smaller (~60–70% of row width instead of the ~50% it occupies at contain-right today, but visually framed/bordered which reads as "smaller window"). Reads as "behind glass" rather than "card with art" — less immersive. Doesn't solve left-anchored subjects (Leon still on the right side of the frame because the asset is right-aligned inside).

**Cost:** moderate. New CSS but no enrichment or API changes.

**Verdict:** Plan B if `object-cover` + smart anchor doesn't land. The visual style is opinionated but it's a single layout that handles every sample case without metadata.

---

### D. `object-cover` + per-asset subject anchor — *tentative landing*

**Mechanism:** full-bleed cover crop with per-asset `(subjectXPercent, subjectYPercent)` from smartcrop-sharp saliency computed at enrichment. Logo + meta float on a left-side dim gradient over the art (Steam client's own "Recent Activity" row pattern).

**Pipeline:**

1. Enrichment-time: run `smartcrop-sharp` (pure pixel ops, ~50ms per asset, no ML model load) on `library_hero.jpg`. Take saliency centroid → `subjectXPercent`, `subjectYPercent`. Default 50/50 if detection fails. Two new nullable columns on `SteamGameEnrichment`.
2. Render-time:
   ```tsx
   <img
     ref={heroRef}
     src={steamLibraryHeroUrl(appid, t)}
     className="absolute inset-0 size-full object-cover"
     style={{ objectPosition: `${subjectXPercent ?? 50}% ${subjectYPercent ?? 50}%` }}
   />
   <div className="absolute inset-y-0 left-0 w-3/5 bg-[linear-gradient(to_right,rgba(0,0,0,0.78)_0%,rgba(0,0,0,0.55)_35%,rgba(0,0,0,0.2)_70%,transparent_100%)]" />
   <div className="absolute inset-0 flex items-center px-5"> /* logo + meta */ </div>
   ```
3. Track B (no `library_hero.jpg`): the existing chain in [steam-image.service.ts](../../../apps/api/src/img/steam-image.service.ts) falls through to `page_bg_generated_v6b.jpg`. The cover layout works on those too — they're already dimmed and have full-width compositions that cover-crop cleanly.

**Handles well:** atmospheric continuity (RE3 horizon glow runs edge-to-edge), left-anchored subjects (RE4 Leon stays prominent at the left of the visible crop via `objectPosition: 0% 30%`), uniform-edge cases (Pragmata's white-bg cover-crops to white-bg), bright-edge family (no extension zone where bright meets dark).

**Fails (graceful):** loses ~50% of horizontal asset content per row (3:1 → 6:1 crop). Far-edge content gets cropped (Stellar Blade's earth horizon on the right, FC5's outermost characters, Pragmata's leftmost shadow). These are mostly atmospheric, not focal.

**Risk:** assets with subjects at the extreme top or bottom of the asset (none in the current sample but theoretically possible) would clip badly. Mitigated by the Y anchor — and if the anchor is wrong for a specific asset, manual override is one DB update.

**Cost:** moderate. New columns + enrichment computation + backfill + row rewrite. ~3 chunks.

**Verdict:** *current pick*. Reasons in § Why this lands.

---

### E. `object-cover` + face-api (instead of smartcrop)

**Mechanism:** same as D but use `face-api.js` TinyFaceDetector to locate faces directly. ~5MB model, ~200ms per asset, can run at 0/90/180/270° rotations for upside-down subjects (Stellar Blade ~800ms total).

**Handles well:** human-face accuracy where smartcrop's generic saliency might pick high-contrast non-face regions (e.g. an explosion behind the character).

**Fails:** model load cost. Doesn't help non-humanoid (Hornet, Tunic fox, Witcher medallion, Hades's Cerberus DLC art).

**Cost:** higher than smartcrop; needs model assets in the API container.

**Verdict:** keep as a **Plan B for anchor accuracy** if smartcrop's centroids are visibly wrong on the live library. Falls back to smartcrop for non-humanoid.

---

### F. Adaptive per-asset layout (multiple compositions, picked at render)

**Mechanism:** classify each asset at enrichment into one of N layouts: `rightSubjectClearLeftEdge`, `rightSubjectBrightLeftEdge`, `centerSubject`, `leftSubjectClearRightEdge`, `leftSubjectBrightRightEdge`, `distributedNoNegativeSpace`. Render switches on the class.

**Handles well:** can give each asset its ideal composition. Theoretically the best per-asset result.

**Fails:** UX consistency. A library where every row uses a different composition reads as chaos. Maintenance cost is high — every new layout multiplies the test surface.

**Cost:** high. N layouts + classifier + per-asset metadata (3–4 columns) + visual QA across the library.

**Verdict:** rejected for v1, but the per-asset `(X, Y)` anchor from approach D *is* a milder form of this. If D ships and a small subset of assets still misbehave, we can add a `forceLayout` override column rather than fully classifying.

---

### G. Mirror-reflected extension

**Mechanism:** flip the asset horizontally and feather the mirrored copy into the left zone. The "extension" is the asset's actual content reflected back.

**Handles well:** edge color matches by construction. No banded-extension problem because we're stretching real pixels.

**Fails:** untested. Mirrored content reads as "weird" — characters appear twice (RE4 Leon × 2), text-baked-into-asset would mirror illegibly (Witcher 3, FC5). Likely too unconventional for a portfolio piece.

**Cost:** low-moderate (CSS scaleX(-1) trick or Sharp-side flip-and-paste).

**Verdict:** parked. Worth trying as a visual experiment if approaches D and C both fall through, but lots of failure modes around text and faces.

---

### H. `header.jpg` as alternative base

**Mechanism:** use `header.jpg` (460×215, ~2.14:1) instead of `library_hero.jpg`. Aspect closer to row aspect.

**Fails:** smaller absolute size (lower DPI when scaled). Many headers have *baked-in wordmarks*, which conflicts with the separate-logo morph anchor. The extra leftover zone is smaller (~35% vs ~50%) but still non-zero. The 2 fallback-only games still don't have it as a clean hero source.

**Cost:** low. Pure URL swap if needed.

**Verdict:** rejected as primary. Could be a per-asset fallback for cases where `library_hero.jpg` is missing AND `page_bg_generated_v6b.jpg` looks worse than the header for that game — but that's a 1-2 game edge case at most.

---

## Track B: no `library_hero.jpg`

Bounded to Deus Ex HR original (28050) and Far Cry 1 (13520) in the current 28-game sample. Both have `page_bg_generated_v6b.jpg` available, which is **already heavily blue/teal-washed** — far more usable as a row backdrop than the non-v6b warm variants (the brighter Far Cry beach + Deus Ex newsroom images).

The existing fallback chain in [`SteamImageService.hero`](../../../apps/api/src/img/steam-image.service.ts) and the row's `makeHeroFallbackHandlers` already routes through `library_hero.jpg` → `page_bg_generated*` → `storepagebackground`. With approach D in place, no additional Track B work is needed: the cover-crop layout runs the same way on whatever the chain delivers. If the v6b variant arrives, it'll cover-crop cleanly because it's already a wide, dim, full-bleed image.

---

## Trade-off matrix

| Approach | Seam | Atmospheric continuity | Left-subject preserved | Metadata needed | Impl cost |
|---|---|---|---|---|---|
| A. Status quo | Bad on bright edges | Bad on banded edges | No | None | $0 (shipped) |
| B. Multiply tonemap | Categorically eliminated | Bad (crushes glow) | No | None | Tiny |
| C. Frame inset | Eliminated (explicit frame) | Preserved | No (right-aligned in frame) | None | Moderate |
| D. Cover + smart anchor | N/A (no extension) | Preserved (full bleed) | Yes (via X anchor) | 2 columns | Moderate |
| E. Cover + face-api | N/A | Preserved | Yes | 2 columns + model | Higher |
| F. Adaptive layouts | Per-layout | Per-layout | Yes | 3–4 columns + classifier | High |
| G. Mirror extension | Edge tone matches | Preserved | No | None | Low–moderate |
| H. `header.jpg` base | Smaller extension zone | Mixed | No | None | Low |

---

## Why this lands (approach D)

The two failure modes the owner currently flags — RE3 banded extension destroying horizon glow, RE4 left-anchored subject in the feather zone — are both caused by the *extension-then-feather strategy itself*, not by the choice of feather technique. Replacing the extension zone with a crop categorically removes the failure mode. Approaches B and C address only the seam half; D addresses both halves.

The owner's previous resistance to `object-cover` was about *naive* cropping (top/bottom slice clipping Stellar Blade or Witcher 3 character heads). A per-asset `(X, Y)` anchor solves that — every observed asset has a reasonable anchor that keeps the focal subject in frame.

What we lose (~50% horizontal asset content per row) is mostly atmospheric edge content, not focal. The cases where edge content *is* focal (Stellar Blade's earth horizon, FC5's outermost characters) read as enrichment rather than load-bearing.

The 25-asset sample covered the four position classes (right/center/left/distributed) and three edge-tone classes (dark/bright/banded) — enough variance that further sampling is unlikely to surface a new failure mode for D. If one emerges in production, the manual-override path (DB update of `subjectXPercent`/`subjectYPercent` for that appid) is a one-row fix, not a layout rework.

## If D doesn't land

In rough preference order:

1. **C (frame inset)** — single layout, no metadata, categorically eliminates the seam. Visually opinionated but predictable.
2. **D with E (face-api) layered in** — if smartcrop's anchors are visibly off, swap the saliency engine before abandoning the layout.
3. **F (adaptive)** — only if a meaningful subset still misbehaves after D + manual overrides. Adds maintenance surface; treat as a last resort.
4. **G (mirror)** — experimental. Worth a prototype if all above fail.

A revert to **A (status quo)** is always available — the current composition is shipped and works for ~50–60% of the sample. Going backward is acceptable if the redesign doesn't beat the baseline.

---

## Next steps

1. Decide whether to prototype D as a static mockup (hardcoded anchors for 4–5 test games) before doing the enrichment work, or go directly to the enrichment + render rewrite.
2. If proceeding to implementation: chunk plan is (a) enrichment columns + smartcrop wiring + backfill, (b) row rewrite + Track B verification, (c) visual QA across the live library with override flagging for any visibly-misanchored assets.
3. If D fails QA: fall back to C with no further investigation needed (it's documented, no metadata to roll back).
