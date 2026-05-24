# Steam Profile composite-layer density

**Status:** Investigation queued. Discovered during the [Safari VT debugging arc](safari-vt-snapshot-cost.md). The Steam Profile page (`/steam`) carries roughly **77 composite layers at rest** in Safari Web Inspector → Layers — about 4-5× the other Steam pages (Library/Wishlist/Achievements each show ~16-17 layers). The arc's WebKit bypass + CSS-slide substitute masks the symptom on tab nav, but the absolute layer count remains a structural cost on Profile specifically and would block re-enabling router VT on Steam in the future.

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

## Hypotheses for the 77

Ordered by likelihood, not yet empirically attributed (would need to expand individual layers in the Layers panel and read the promotion reason for each):

### 1. Trophy badges — `backdrop-blur-sm` on every rarity-percent chip

[`trophy-case-strip.tsx`](../../../apps/web/src/steam/profile/trophy-case-strip.tsx#L168-L169) renders a percent badge per trophy with `bg-background/80 backdrop-blur-sm`. **`backdrop-filter` always promotes its element to its own composite layer** (it has to, because the filter samples and re-renders pixels behind the element on a separate surface).

- ~10 trophies in the strip × 1 layer per badge = ~10 layers from badges alone.
- This is the single most addressable source.

### 2. Drop-shadow filters on text in chips

Several chips (NowPlayingChip is the documented example; others may follow the same pattern) use `[filter:drop-shadow(...)]` on text for legibility over hero imagery. `filter:` promotes the element to a composite layer.

- 2-3 drop-shadowed text elements per chip × 5 chips = 10-15 layers.

### 3. Hover-only `transform` promotion that never demotes

Several chips use `group-hover:scale-105` or similar on bg imgs. Once an element is promoted to a composite layer (e.g., during a hover), WebKit may keep it promoted even after the hover ends rather than incurring the layer-demote cost. Stale promotion accumulates over time as the user hovers different chips.

- Would not show on a fresh page load but could explain layer-count inflation observed after interaction.

### 4. `ring-1` + `shadow-lg` interactions on stacked imgs

The TrophyCaseStrip has an achievement icon with `shadow-lg ring-1 ring-black/40` overlaid on a backgrounded image. Box-shadow alone doesn't promote, but `shadow-lg` + `ring-*` (which is also box-shadow) + overlapping `absolute` positioning + an opacity transition on the parent may cumulatively trigger promotion. Per-trophy.

- ~10 trophies × 1 layer (if it promotes) = up to 10 layers.

### 5. Section-wide structural layers

`<main data-vt-main>` gets `view-transition-name: vt-main` when shell anim is on, which inherently makes it its own layer. The portaled section header in `<#section-header-slot>` is its own positioned context (`relative z-40`). The SteamProfileBackdrop in BackdropPortal is a fixed full-viewport layer with its own backdrop content. These are shared with the other Steam pages so they don't explain the Profile differential, but they contribute to the absolute count.

- ~5-10 layers, shared across all Steam pages.

## Recommended investigation approach

Before any code change, **attribute the 77 layers concretely**:

1. Open `/steam` in Safari Web Inspector → Layers.
2. Click each layer in the tree to see the "Compositing Reasons" panel on the right (Safari shows the specific CSS property that promoted each layer: `filter`, `backdrop-filter`, `transform`, `opacity < 1` with transform, `position: fixed`, `view-transition-name`, etc.).
3. Tally by reason. The dominant reason is the most actionable lever.
4. Cross-check: open `/steam/wishlist` in the same panel and note which layer reasons differ. The differential explains Profile's 77 vs the others' 16-17.

## Action ladder

Rank-ordered by expected impact × low blast-radius:

### Tier 1 — likely big wins, low risk

- **Drop `backdrop-blur-sm` from trophy rarity badges.** Replace with a solid `bg-background/95` or `bg-background/90` — visually identical at small chip sizes, eliminates the per-badge composite layer. Estimated 10 layer reduction.
- **Replace `[filter:drop-shadow(...)]` on text with `text-shadow:` where possible.** `text-shadow` doesn't promote a composite layer; `filter: drop-shadow` does. Visual fidelity is similar at small sizes (text shadows render slightly differently but read close at body sizes). Estimated 5-15 layer reduction across the chips.

### Tier 2 — if Tier 1 isn't enough

- **Audit `ring-*` + `shadow-*` combinations on stacked absolute elements.** Where possible, replace with a single `box-shadow` that combines the ring + shadow into one declaration to reduce stacking complexity.
- **Add explicit `will-change: auto` on hover-state elements** so they demote cleanly after hover ends. (`will-change: transform` would pre-promote — the opposite of what we want.)

### Tier 3 — structural, only if Tier 1-2 don't close enough

- **Simplify TrophyCaseStrip chrome.** The card is currently background-image + overlay gradient + achievement icon (shadowed, ringed) + percent badge (blurred bg). Could collapse to background-image + overlay + icon + plain badge.
- **Lazy-mount below-fold chips with `DeferredMount`** (the trends-page pattern in [`apps/web/src/_shared/deferred-mount.tsx`](../../../apps/web/src/_shared/deferred-mount.tsx)). The grid of 5 chips below TrophyCaseStrip may be below the fold on small viewports.

## Why this matters

The current state is **shippable** — Safari users navigate Steam smoothly thanks to the [VT bypass](safari-vt-snapshot-cost.md), and Profile is no slower than the other pages on Chrome/Firefox (where Recharts-free chip cards render fast). The 77-layer count is a latent cost source: it would resurface if we ever:

- Re-enabled router VT on Steam for WebKit (the bypass is engine-gated; if WebKit ships a snapshot capture improvement, we'd reconsider).
- Added VT-driven per-element morphs that capture this surface as part of a transition.
- Saw mobile Safari with a tighter GPU budget on real iPhone hardware (untested as of this writing — the desktop Safari measurements may understate the cost on lower-tier mobile devices).

Tier 1 fixes alone (drop `backdrop-blur-sm` + `filter: drop-shadow` → `text-shadow`) would likely halve the layer count with minimal visual impact. Even without the long-tail considerations above, it's a clean polish pass that reduces the structural cost of the most-visited Steam page.

## Open questions

- **Is the 77-layer count stable across page loads, or does it grow with interaction (hover-driven promotion that doesn't demote)?** Recheck after some hovering to verify.
- **What does the chronotype tile contribute?** [`steam-chronotype-tile.tsx`](../../../apps/web/src/steam/achievements/steam-chronotype-tile.tsx) wasn't audited in this note — it's on the achievements signature page, not Profile. If similar charts appear on Profile in future, factor in their promotion cost.
- **On mobile Safari (real iPhone hardware), how does the count change?** Smaller viewport may render fewer trophies / chips, reducing total count. Worth measuring on a real device before any polish work.

## Files in scope (if Tier 1 lands)

- `apps/web/src/steam/profile/trophy-case-strip.tsx` (drop `backdrop-blur-sm` on badges)
- `apps/web/src/steam/now-playing-chip.tsx` (likely + others — audit `filter:` usage)
- Potentially other chips with `drop-shadow` text

## Related notes

- [safari-vt-snapshot-cost.md](safari-vt-snapshot-cost.md) — parent debugging arc that surfaced this measurement.
- [perf-baseline.md](perf-baseline.md) — Lighthouse / bundle / Vitals baselines.
- [steam-lol-parity.md](steam-lol-parity.md) — broader Steam-vs-LoL parity items.
