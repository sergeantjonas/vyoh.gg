# Steam ↔ LoL section parity

**Status:** Planned. Sibling to [view-transitions-rollout](view-transitions-rollout.md) and [section-shell-vt-migration](section-shell-vt-migration.md), but tracks the *non-VT* parity items between the Steam and LoL section trees. Surfaced by a cross-section audit on 2026-05-24 that compared route shape, animation density, loading states, scroll handling, and empty states.

Read this when picking up any Steam polish task, or before adding a new Steam surface that has a structural equivalent in LoL.

---

## Why

LoL has been the rehearsal ground for most of the project's polish patterns: ref-counted backdrop, layered scroll-reset with skip-pairs, layout-mirroring skeletons with `motion.react` stagger, illustration-bearing empty states. Each of those has either no Steam equivalent or a degraded one. The drift isn't intentional — Steam shipped during the LoL polish arcs, not before, so it inherited the older patterns.

The VT morph for Steam library → game-detail is already tracked in [view-transitions-rollout.md §"What's next" #1](view-transitions-rollout.md). This note covers the **four other** parity items the audit surfaced; they are independent of the VT work and can ship in any order.

---

## What this is NOT

- **Not a VT migration.** The Steam library → game-detail morph is its own arc — see [view-transitions-rollout.md](view-transitions-rollout.md). The items here are loading-state, scroll, and empty-state polish that don't depend on VT.
- **Not a Steam feature arc.** No new data, no new routes. This is hygiene against `@docs/repo-conventions.md` and visual parity with shipped LoL patterns.
- **Not a forced symmetry.** Champion theming, queue/role taxonomies, KDA/damage-profile cards are domain-specific to LoL and stay there. Per-game genre/tag UI for Steam is a separate question, not part of this note.

---

## Items

### Item 1 — Skip-pairs for library ↔ game-detail back-restore

**What:** [`/steam`](../../../apps/web/src/routes/steam.tsx) already calls `useScrollResetOnNav(pathname)` at line 47 but passes no `skips` argument. The LoL section root passes two pairs (matches list ↔ detail, champions list ↔ detail) so back-navigation from a detail preserves the list scroll position — see [`$accountSlug.tsx:211–214`](../../../apps/web/src/routes/lol/$accountSlug.tsx#L211-L214). Steam needs the analogous pair for `/steam/library` ↔ `/steam/game/$appid`.

**Files in scope:**
- [`apps/web/src/routes/steam.tsx`](../../../apps/web/src/routes/steam.tsx) — add `skips` arg with `{ fromPrefix: "/steam/game/", toExact: "/steam/library" }`.

**Effort:** Quick win, single commit. Also add a test mirroring [`use-scroll-reset-on-nav.test.ts`](../../../apps/web/src/lib/use-scroll-reset-on-nav.test.ts).

**Why this is convention-relevant, not just polish:** Per `docs/repo-conventions.md` § "Scroll-to-top is layered between root and section roots": "When adding a new section, call `useScrollResetOnNav` in the section root in the same change, with `skips` for any list↔detail back-restore pairs." Steam got the wiring without the skip pairs, so back-restore silently doesn't work. Treat as a missed-convention fix, not new feature work.

---

### Item 2 — Layout-mirroring skeletons for Steam pages

**What:** Steam pages render text placeholders during loading ("Loading library…", "Loading wishlist…"). LoL replaced equivalents with layout-mirroring skeletons using a shared `motion.react` stagger — see [`match-list-skeleton.tsx`](../../../apps/web/src/lol/matches/match-list-skeleton.tsx) and [`champions-skeleton.tsx`](../../../apps/web/src/lol/champions/champions-skeleton.tsx), both built on [`shimmer-block.tsx`](../../../apps/web/src/components/shimmer-block.tsx).

**Surfaces missing skeletons:**
- [`/steam/library`](../../../apps/web/src/routes/steam/library.tsx) — tile grid + row variants, needs both
- [`/steam/game/$appid`](../../../apps/web/src/routes/steam/game.$appid.tsx) — hero strip + achievement panel + stat cards
- [`/steam/wishlist`](../../../apps/web/src/routes/steam/wishlist.tsx) — list rows

**Files in scope (likely):**
- New: `apps/web/src/steam/library/library-skeleton.tsx`, `apps/web/src/steam/game/game-detail-skeleton.tsx`, `apps/web/src/steam/wishlist-skeleton.tsx` (paths TBD by Steam folder conventions)
- Modified: the three route files above, swap text placeholder → skeleton on pending state
- Tests: one per skeleton component, axe-scan included per `docs/repo-conventions.md` § "Axe-scan new interactive components"

**Effort:** Small arc, 3 chunks (one per page). No shared abstractions to design — the LoL pattern is the template.

**Convention:** Per `docs/repo-conventions.md` § "Skeleton loaders must mirror the layout they replace", these aren't generic shimmers — the game-detail skeleton must branch on which content shape is loading (hero, achievement panel, stat cards).

---

### Item 3 — Port `EmptyState` to Steam empty surfaces

**What:** A shared [`EmptyState`](../../../apps/web/src/components/empty-state.tsx) component already exists and is used by LoL surfaces (e.g. zero matches after queue filter, zero champions after role filter). Steam surfaces use raw text instead.

**Surfaces missing EmptyState:**
- Empty library (sync pending or genuinely empty)
- Empty wishlist
- Empty achievements feed (no recent unlocks)
- Empty filter result on library (filters applied, nothing matches)

**Files in scope:**
- The three Steam route files above + library-controls' filter-empty branch
- No new component — just consume the existing `EmptyState` with Steam-appropriate copy and (optionally) a Steam-themed illustration

**Effort:** Quick win, single commit (no new code, just composition). Could be folded into Item 2's per-page commits if scope feels right at execution time.

---

### Item 4 — Extract shared ref-counted backdrop provider

**What:** [`SplashProvider`](../../../apps/web/src/lol/_shared/assets/splash-backdrop.tsx) (LoL) and [`SteamProfileBackdrop`](../../../apps/web/src/steam/profile-backdrop.tsx) (Steam) implement nearly-identical ref-counted portal-rendered backdrops: ref-count on mount/unmount, owner-keyed crossfade, blurhash placeholder, unmount-safety against stale leases. Each was implemented independently and they've drifted in small ways (animation timings, fallback behaviour, asset-timestamp handling).

**Files in scope:**
- Likely new: `apps/web/src/lib/ref-counted-backdrop.tsx` (or `packages/shared/src/ui/` if a shared component lib emerges) — generic `<RefCountedBackdrop>` provider + `useRefCountedBackdrop(key)` hook
- Modified: both existing backdrops re-implement as thin wrappers that supply their asset URL + accent + crossfade timing
- Tests: both existing backdrop tests should keep passing unchanged; new tests on the abstraction

**Effort:** Small arc, 2–3 chunks. Needs a quick design pass before code (decide where the abstraction lives — `apps/web/src/lib/` or `packages/shared/`; whether transition timing is per-instance config or fixed; whether blurhash + crossfade are baked in or pluggable).

**Open question:** Whether the backdrop owns its DOM portal target (current pattern) or whether a separate `<BackdropOutlet />` is mounted once in `__root.tsx` and providers just lease it. The second shape composes better but is a bigger refactor.

---

## Suggested order

1. **Item 1** (scroll-reset skip-pairs) — smallest, fixes a convention violation, no design call.
2. **Item 2** (Steam skeletons) — biggest visual delta, 3 small chunks, no new abstractions.
3. **Item 3** (EmptyState port) — composes naturally with Item 2's chunks if folded in.
4. **Item 4** (backdrop unification) — last, because it needs the design call and touches both sections; do it after the smaller items have built up parity confidence elsewhere.

The Steam VT morph from [view-transitions-rollout.md](view-transitions-rollout.md) is independent of all four and can interleave in any order.

---

## Related notes

- [view-transitions-rollout.md](view-transitions-rollout.md) — Steam library → game-detail morph (own arc, not covered here).
- [section-shell-vt-migration.md](section-shell-vt-migration.md) — structural arc that unblocks multi-element morph; orthogonal to these items.
- [elevation-arcs.md](elevation-arcs.md) — parent index.
- [quick-wins.md](quick-wins.md) — Items 1 and 3 are quick-win-shaped; if not picked up as part of this note, surface them there.
