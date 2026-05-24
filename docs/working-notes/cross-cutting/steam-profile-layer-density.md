# Steam Profile composite-layer density

**Status:** Tier 1 fix landed and verified 2026-05-25 — `backdrop-blur-sm` removed from trophy rarity badges, **77 → 27 layers** in Safari Web Inspector (50-layer drop, beat the ~44 prediction by ~6). Profile is now within ~10 layers of sibling Steam pages (17). Further work parked unless a downstream need surfaces. Discovered during the [Safari VT debugging arc](safari-vt-snapshot-cost.md). The Steam Profile page (`/steam`) was carrying roughly **77 composite layers at rest** in Safari Web Inspector → Layers — about 4-5× the other Steam pages (Library/Wishlist/Achievements each show ~16-17 layers). The arc's WebKit bypass + CSS-slide substitute masks the symptom on tab nav, but the absolute layer count remains a structural cost on Profile specifically and would block re-enabling router VT on Steam in the future.

Read this when: scoping a polish pass on Profile, considering re-enabling router VT for Steam on WebKit, or onboarding to why Profile feels heavier than its sibling tabs.

---

## What we know

Layer counts measured 2026-05-24, viewport ≈ desktop (1440px), no hover, Safari Web Inspector → Layers panel:

| Page | Layers at rest |
|---|---|
| `/steam/wishlist` | 16 |
| `/steam/library` | 17 |
| `/steam/achievements` | 17 |
| **`/steam` (Profile)** | **77** |

Profile renders, in order:
- `<h1>Profile</h1>` + tagline
- [`<NowPlayingChip />`](../../../apps/web/src/steam/now-playing-chip.tsx)
- [`<TrophyCaseStrip />`](../../../apps/web/src/steam/profile/trophy-case-strip.tsx) — horizontal strip of ~10 trophies
- A grid of five chips: `<RecentUnlocksChip />`, `<WishlistChip />`, `<LibraryCompositionChip />`, `<OwnedGamesChip />`, `<PlatformMixChip />`

Other Steam pages render either a virtualised list (Library / Achievements) or a flat list (Wishlist). The structural difference is Profile's component density: 7 composite chip-shaped widgets vs the other pages' single primary list.

## Attribution (measured 2026-05-25)

Full Layers panel dumped to a table, sources cross-referenced against the route. Breakdown of the original 77:

| Source | Count | Notes |
|---|---|---|
| Trophy rarity badges (`backdrop-blur-sm` on every `TrophyTile` percent chip) | **~44** | 12 amber + 32 plain. One per Embla slide. |
| Carousel chrome + visible-tile transforms (mask, hairline, radial glow with `blur-md mix-blend-screen`, capsule img) | ~8 | The 5 `div.min-w-0.shrink-0.grow-0.basis-auto.pl-3` rows in the panel are CarouselItems with non-zero memory — the rest sit off-viewport at 0 B but are still mounted. |
| Profile backdrop stack (video `blur-[2px]`, gradient mask, body::before, portal container) | ~5 | Intentional design. ~80 MB of the 128 MB memory total. |
| Sticky nav `backdrop-blur-md` | 1 | Shared with all Steam pages. |
| `<main>` overflow + html/document/body | ~4 | Always promoted. |
| Section header slot + container layers | ~3 | Shared. |
| Page-transition overlay (`fixed.bg-background/50.backdrop-blur-md`) | 1 | Route-transition backdrop. |
| Devtools widget (`fixed.bottom-4.left-4.backdrop-blur`) | 1 | Dev-only. |
| Long tail (small radial glows, single-icon spans) | ~10 | Mostly low-impact. |

**The trophy badges alone account for ~57% of the layer count** on this page. The note's original "~10 trophies × 1 layer = ~10 layers" estimate was 4× too low because [`trophy-case-strip.tsx`](../../../apps/web/src/steam/profile/trophy-case-strip.tsx) has evolved since the original measurement:

- `FETCH_LIMIT = 50` (was 10 when the original measurement was taken).
- The strip is now an Embla **Carousel** with autoplay, not a static row. Embla mounts every slide; only visible ones have layout, but every badge still composites.
- ~44 entries pass `RARITY_GATE` for the owner's data → 44 mounted `TrophyTile`s → 44 promoted badge layers.

The 26-paint anomaly on `div.relative.mx-auto.max-w-4xl.px-6` was almost certainly the autoplay rotation triggering paint cycles in the carousel scope every 6s — same root cause.

### Other hypotheses, now refuted or de-prioritised

- **Drop-shadow text filters** — no `filter: drop-shadow` layers appeared in the dump. NowPlayingChip and the other chips don't promote on text. The original hypothesis was wrong.
- **Stale hover-driven `transform` promotion** — not observed at rest. May still apply after sustained interaction, but it's not what created the differential.
- **`ring-1` + `shadow-lg` on stacked imgs** — the trophy capsule `img.relative.size-full` does appear in the dump (~12 KB, 1 layer per visible tile), so the ring + shadow stack does promote, but it contributes ~5 layers from the visible slides, not ~10.
- **Section-wide structural layers** — confirmed present but they're shared across all Steam pages, so they explain part of the absolute floor (~10-15 layers across html/document/body/main/nav/section-header) without explaining the Profile differential.

## Recommended investigation approach

Before any code change, **attribute the 77 layers concretely**:

1. Open `/steam` in Safari Web Inspector → Layers.
2. Click each layer in the tree to see the "Compositing Reasons" panel on the right (Safari shows the specific CSS property that promoted each layer: `filter`, `backdrop-filter`, `transform`, `opacity < 1` with transform, `position: fixed`, `view-transition-name`, etc.).
3. Tally by reason. The dominant reason is the most actionable lever.
4. Cross-check: open `/steam/wishlist` in the same panel and note which layer reasons differ. The differential explains Profile's 77 vs the others' 16-17.

## Action ladder

### Tier 1 — landed and verified 2026-05-25

- **Dropped `backdrop-blur-sm` from trophy rarity badges.** [`trophy-case-strip.tsx`](../../../apps/web/src/steam/profile/trophy-case-strip.tsx) — `bg-background/80 backdrop-blur-sm` → solid `bg-background/95`. Measured reduction: **77 → 27 layers** (50-layer drop, 6 better than the ~44 predicted — likely because some parent elements also demoted once their children stopped requiring composite parents). Profile is now within ~10 layers of sibling Steam pages (17), comfortably within the structural-floor envelope.

### Tier 2 — parked, only reach for if Tier 1 doesn't close enough

- **Reduce the carousel's mounted-slide pool.** Currently every entry passing `RARITY_GATE` mounts a full `TrophyTile` (~44 with current data). Two options:
  - Cap `FETCH_LIMIT` (e.g. 15-20) — owner has explicitly declined this; trophy variety is the point of the carousel.
  - Virtualise Embla slides via `EmblaCarouselClassNames` + manual mount gating, or swap to a windowed-render approach. Adds real complexity; only worth doing if a future use case (re-enabling Safari router VT, mobile Safari measurement) needs the further reduction.
- **Audit `ring-*` + `shadow-*` combinations on stacked absolute elements.** Confirmed minor source (~5 layers from visible capsule imgs). Marginal win.

### Tier 3 — structural, if even Tier 2 isn't enough

- **Simplify TrophyCaseStrip chrome.** Could collapse capsule-img + radial glow + bottom hairline + icon-with-ring to fewer layers, at a real visual cost.
- **Lazy-mount below-fold chips with `DeferredMount`.** The grid of 5 chips below the strip may be below the fold on small viewports.

## Why this matters

The current state was **shippable** before Tier 1 — Safari users navigate Steam smoothly thanks to the [VT bypass](safari-vt-snapshot-cost.md), and Profile was no slower than the other pages on Chrome/Firefox. The 77-layer count was a latent cost source: it would resurface if we ever:

- Re-enabled router VT on Steam for WebKit (the bypass is engine-gated; if WebKit ships a snapshot capture improvement, we'd reconsider).
- Added VT-driven per-element morphs that capture this surface as part of a transition.
- Saw mobile Safari with a tighter GPU budget on real iPhone hardware (untested as of this writing — the desktop Safari measurements may understate the cost on lower-tier mobile devices).

With Tier 1 landed, the page should be near layer-parity with sibling tabs; the remaining structural cost is the profile-backdrop stack (intentional design) and shared section chrome.

## Open questions

- **Does the 26-paint count on `div.relative.mx-auto.max-w-4xl.px-6` drop now that badges no longer composite?** If badges were the dominant repaint trigger from carousel rotation, paint count should fall too. If it stays ~26, the autoplay itself is the repaint source and we'd reconsider whether 6s autoplay is worth the paint cost. Worth a glance next time you have the Layers panel open.
- **On mobile Safari (real iPhone hardware), how does the post-fix count change?** Smaller viewport renders fewer carousel tiles in view, but all 44 are still mounted. Worth measuring on a real device before any further work.

## Files in scope

- [`apps/web/src/steam/profile/trophy-case-strip.tsx`](../../../apps/web/src/steam/profile/trophy-case-strip.tsx) — Tier 1 lives at the two badge classNames in `TrophyTile`.

## Related notes

- [safari-vt-snapshot-cost.md](safari-vt-snapshot-cost.md) — parent debugging arc that surfaced this measurement.
- [perf-baseline.md](perf-baseline.md) — Lighthouse / bundle / Vitals baselines.
- [steam-lol-parity.md](steam-lol-parity.md) — broader Steam-vs-LoL parity items.
