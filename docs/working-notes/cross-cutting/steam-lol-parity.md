# Steam ↔ LoL section parity

**Status:** Items 1–5 shipped 2026-05-24; Item 6 (per-game accent color on Steam game detail) remains, blocked on a Steam dominant-color source. Sibling to [view-transitions-rollout](view-transitions-rollout.md) and [section-shell-vt-migration](section-shell-vt-migration.md); surfaced by a cross-section audit on 2026-05-24.

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

### Item 4 — Share the lease + portal shell between the two backdrops

**Audit-correction (2026-05-24):** The original framing here ("nearly-identical ref-counted portal-rendered backdrops") was wrong. Reading both files end-to-end before drafting a chunk plan surfaced that they are *structurally different* patterns that happen to share a portal shell:

- **[`SplashProvider`](../../../apps/web/src/lol/_shared/assets/splash-backdrop.tsx) (LoL)** — multi-claim stack with deepest-owner-wins selection (`Map<ownerSeq, SplashClaim>`, highest id renders). One layer, `<AnimatePresence>` keyed on champion string. Blurhash placeholder + Ken Burns drift + per-champion `offsetX` pan. No ref-counting per owner — one owner = one claim slot.
- **[`SteamProfileBackdrop`](../../../apps/web/src/steam/profile-backdrop.tsx) (Steam)** — static base layer (profile image/video) + ref-counted overlay (game detail). `acquire()/release()` lease exists specifically to defend against the `<AnimatePresence>`-around-`<Outlet />` double-mount during nav (in-file comment at lines 30–37). Always-mounted overlay with opacity-driven visibility; no `AnimatePresence`. Includes `<BackdropVideo>` with `visibilitychange` pause-when-hidden.

The visual layer differs in every meaningful dimension (blurhash vs video, single-layer vs base+overlay, AnimatePresence vs always-mounted opacity, owner-stack vs ref-count). The lease semantics differ too (deepest-owner-wins vs any-claim-keeps-alive). What's actually shared is small: the portal target, the fixed-inset-0-z-10-pointer-events-none shell, the blur/brightness aesthetic, and the transition-token timings.

**Design call (Option B):** extract two small primitives — `useRefCountedClaim<T>()` hook and a `<BackdropPortal>` shell — into `apps/web/src/_shared/backdrop/`. Each section keeps its existing provider, structurally distinct, but composes both primitives instead of hand-rolling them. Rejected alternatives:

- **Option A — one generic provider configured by props.** Selection strategy (deepest-id-wins vs ref-count) and layer composition (single vs base+overlay) would need to become flags, and the visual layer would still be `children` anyway. The "shared abstraction" would just be the lease + portal — i.e. Option B with extra ceremony around it.
- **Option C — extract only CSS/timing tokens.** Cheapest, but leaves the StrictMode/AnimatePresence-around-Outlet defensiveness duplicated across both providers, which is exactly where the past drift happened.
- **Central `<BackdropOutlet />` in `__root.tsx` instead of per-provider portals.** Concrete payoff is cross-section crossfade (e.g. `/steam → /lol` fades the Steam backdrop out under the rising LoL backdrop). Currently the swap is abrupt because the section unmount tears down its portal entirely. Nobody has flagged this as a bug. Punt; revisit if cross-section crossfade becomes a real ask.

**Pre-work — LoL hazard probe (resolved 2026-05-24 via static analysis):** LoL is **structurally immune** to the Steam stale-instance hazard. Mechanism: Steam uses a single-slot `useState<Claim | null>` where last-writer-wins, so an unmount's `setClaim(null)` from a stale instance can blank a still-valid claim from a surviving instance — that's the gap `liveCountRef` fills. LoL uses a per-owner `Map<ownerSeq, SplashClaim>` where each `useSplashChampion` instance gets a unique `ownerSeq` at first render ([splash-backdrop.tsx:230–231](../../../apps/web/src/lol/_shared/assets/splash-backdrop.tsx#L230-L231)); a cleanup can only delete its own slot (`clearChampion(owner)`) and cannot touch a sibling instance's slot. During the AnimatePresence double-mount of the same route, both instances claim under different owner ids, both coexist in the Map, the surviving one wins via deepest-id-wins selection, and the exiting one's cleanup removes only its own entry. Adding a ref-counted lease to LoL would be a *regression*: it would collapse the per-owner Map into a single slot and lose the deepest-id-wins behaviour that handles the nested parent+child case (e.g. champion-list hover overriding the section default — see the design intent at [splash-backdrop.tsx:27–31](../../../apps/web/src/lol/_shared/assets/splash-backdrop.tsx#L27-L31)). Conclusion: chunk 3 collapses to a portal-only swap, no lease migration.

**Files in scope:**
- New: `apps/web/src/_shared/backdrop/use-ref-counted-claim.ts` — generic hook, returns `{ claim, acquire, setClaim }` triple, defends against StrictMode double-invoke + transient unmount-from-stale-instance.
- New: `apps/web/src/_shared/backdrop/backdrop-portal.tsx` — thin `<Portal>` wrapper that ports children to `document.body` with the fixed-inset-0-z-10-pointer-events-none shell + SSR guard.
- New: `apps/web/src/_shared/backdrop/use-ref-counted-claim.test.tsx` + `backdrop-portal.test.tsx` — primitive-level lease/release semantics and portal mount/unmount safety.
- Modified: [`apps/web/src/steam/profile-backdrop.tsx`](../../../apps/web/src/steam/profile-backdrop.tsx) — `acquire/release` + `setClaim` delegate to the new hook; portal delegates to `<BackdropPortal>`. Visual layer (`<BackdropVideo>`, `<GameBackdropLayer>`) unchanged.
- Modified: [`apps/web/src/lol/_shared/assets/splash-backdrop.tsx`](../../../apps/web/src/lol/_shared/assets/splash-backdrop.tsx) — portal delegation only in chunk 3. Owner-keyed Map + deepest-id-wins selection stays untouched (pre-work confirmed LoL is structurally immune to the Steam hazard; replacing the Map would be a regression).
- Both existing backdrop tests stay passing unchanged. Test additions live on the new primitives, not the providers.

**Effort:** Small arc, 3 chunks max.

#### Chunk plan

1. **Chunk 1 — Extract primitives + tests.** Create `_shared/backdrop/use-ref-counted-claim.ts` + `backdrop-portal.tsx` with unit tests. Neither provider consumes them yet. Verifies the primitives in isolation — lease semantics under StrictMode, portal SSR guard, transient-unmount safety. Single commit. ~150 LoC + tests. *Shipped 2026-05-24, [`dc471e5`](../../../).*
2. **Chunk 2 — Migrate Steam to the primitives.** Replace `liveCountRef` + `acquire/release` in `SteamProfileBackdrop` with the new hook; replace the inline `createPortal` + shell with `<BackdropPortal>`. Visual layer untouched. Existing `profile-backdrop.test.tsx` stays green unchanged. Single commit. *Shipped 2026-05-24, [`9151ddf`](../../../).*
3. **Chunk 3 — Migrate LoL to `<BackdropPortal>`.** Swap inline `createPortal` + shell for `<BackdropPortal>` only. Owner-keyed Map and selection logic stay intact (see pre-work above). Existing `splash-backdrop.test.tsx` stays green unchanged. Single commit. *Shipped 2026-05-24, [`c69c7ac`](../../../).*

**Out of scope (explicit punts):** central `<BackdropOutlet />` in `__root.tsx`; any change to the visual layers (blurhash, Ken Burns, video pause); cross-section crossfade.

---

### Item 5 — Tile-parity hover chrome on the library row (tilt + sheen + hovercard popout)

The library tile has three hover behaviors the row was missing: (a) a CSS-only perspective tilt + shadow lift, (b) the Steam-style anchored sheen sweep via the registered `--sheen-extent` variable, and (c) the radix-hovercard popout showing recent screenshots + extended playtime stats. After the row redesign landed (the "Steam-native row" arc in [view-transitions-rollout.md](view-transitions-rollout.md)), the row has the visual weight + bounded card shape to host these — without it, a tilt on the original thin capsule-strip row would have looked silly.

**Shipped 2026-05-24.**

- Tilt + sheen on the shell ([`steam-game-row.tsx`](../../../apps/web/src/steam/_shared/steam-game-row.tsx)) so both library row + wishlist row get the same hover treatment via a shared `group/row` token on the wrapper. Tilt values dialed down vs the tile (`rotateX(2deg) rotateY(-1.5deg) scale(1.005)` vs the tile's `rotateX(7deg) rotateY(-9deg) scale(1.02)`) because heavy side-rotation warps wide rects more than square ones.
- Brightness + saturate scoped to the foreground hero img only (not the whole card) so overlaid logo + meta text don't shift or brighten.
- Hovercard popout on the library row ([`library-row.tsx`](../../../apps/web/src/steam/library/library-row.tsx)) reuses `LibraryTileHovercardContent` directly. Wishlist row skips the popout (external nav to Steam store; full game-detail context not relevant on click).
- Extracted `LIBRARY_HOVERCARD_CONTENT_CLASS` to [`library-tile-hovercard.tsx`](../../../apps/web/src/steam/library/library-tile-hovercard.tsx) so both consumers import from one place.

**Lesson:** when porting hover chrome between surfaces with different aspect ratios, the tilt math doesn't transfer 1:1 — wide rects need much shallower angles to avoid corner distortion. Same with image-layer effects vs whole-card effects: scoping brightness/saturate to the hero img (the visual focal point) rather than the outer card keeps overlaid text from being affected.

---

### Item 6 — Per-game accent color on Steam game detail

**What:** [accent-color-system.md](accent-color-system.md) shipped 2026-05-26 with LoL champion + match detail wired to a per-entity `--theme-color`. Steam game detail (`/steam/game/$appid`) currently has no dominant-color source, so it renders with the default `oklch(0.6 0.16 240)` accent — a visible parity gap with LoL once the Chunk 5 sweep starts consuming `--theme-*` across the app.

**Pre-work (blocker):** no Steam-side dominant-color pipeline exists. Two paths:

- **(a) Build-time palette extraction.** Add a `dominantHex` field to whatever Steam asset prep is closest. The LoL pattern is in `apps/web/src/lol/_shared/assets/champion-assets.json` — extracted at build time from splash art and committed. Steam equivalent would extract from `library_hero.jpg` or `header.jpg` per appid. Best long-term; the same extraction can later feed OG images, blurhash placeholders, tile-edge tinting, etc.
- **(b) Runtime canvas sampling.** Load the hero image into a `<canvas>`, sample center pixels, average to oklch. Cheaper to land but has cross-origin gotchas (`wsrv.nl` CORS headers vary) and pays the cost on every visit instead of once at build.

**Files in scope (path (a)):**
- New: a Steam asset-prep script (location TBD — pair with whatever build-time Steam asset work lands first) that writes `dominantHex` per appid into a committed JSON.
- New: `apps/web/src/steam/_shared/assets/game-theme.ts` mirroring `champion-theme.ts` shape — `gameTheme(appid).dominantHex` with fallback.
- Modified: [`apps/web/src/routes/steam/game.$appid.tsx`](../../../apps/web/src/routes/steam/game.$appid.tsx) — call `useThemeColor(gameTheme(appid).dominantHex)` near the top of `SteamGamePage`, mirroring the LoL wiring at `$championKey.tsx:141` and `$matchId.tsx:131`.

**Effort:** Small arc, 1–2 chunks. The runtime wiring is ~3 lines once a `gameTheme` source exists; the palette pipeline is the load-bearing piece.

**Why this lives here, not as its own arc:** it's a parity gap, not a feature. Once Steam has a dominant-color source for any reason (e.g., for blurhash placeholders, OG images, tile-edge tinting), the accent wiring is incidentally cheap.

---

## Suggested order

1. **Item 1** (scroll-reset skip-pairs) — *shipped 2026-05-24, [`23bc24e`](../../../).*
2. **Item 2** (Steam skeletons) — *shipped 2026-05-24, [`8dfc523`](../../../).*
3. **Item 3** (EmptyState port) — *shipped 2026-05-24, [`16d56e0`](../../../).*
4. **Item 4** (backdrop primitive extraction, Option B) — *shipped 2026-05-24 across [`dc471e5`](../../../), [`9151ddf`](../../../), [`c69c7ac`](../../../)*.
5. **Item 5** (tile-parity hover chrome) — *shipped 2026-05-24 (this commit), follows the row redesign.*
6. **Item 6** (per-game accent color) — *planned; blocked on a Steam dominant-color source.*

The Steam VT morph from [view-transitions-rollout.md](view-transitions-rollout.md) is independent of all four and can interleave in any order.

---

## Related notes

- [view-transitions-rollout.md](view-transitions-rollout.md) — Steam library → game-detail morph (own arc, not covered here).
- [section-shell-vt-migration.md](section-shell-vt-migration.md) — shipped 2026-05-24; orthogonal to these items.
- [elevation-arcs.md](elevation-arcs.md) — parent index.
- [quick-wins.md](quick-wins.md) — Items 1 and 3 are quick-win-shaped; if not picked up as part of this note, surface them there.
