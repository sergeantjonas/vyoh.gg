# View Transitions API rollout

**Status:** Planned. Part of [elevation-arcs.md](elevation-arcs.md) Tier 1. Replaces ~200 lines of manual rect-morph plumbing (`active-match-context.tsx`, `active-champion-context.tsx`) with the native View Transitions API where the browser supports it; Motion `layoutId` morph stays as the cross-browser fallback.

Read this when starting the VT rollout, or before extending the rect-capture pattern to a third surface (Steam library, live-game participants).

KB anchors: [03-motion.md §3 View Transitions API](~/.claude/knowledge/frontend-2026/03-motion.md), [16-web-platform-apis.md §View Transitions API](~/.claude/knowledge/frontend-2026/16-web-platform-apis.md). MDN: https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API.

---

## Why

Two forces push this now:

1. **The manual rect-morph pattern is now duplicated.** [active-match-context.tsx](../../../apps/web/src/lol/matches/active-match-context.tsx) and [active-champion-context.tsx](../../../apps/web/src/lol/champions/active-champion-context.tsx) carry parallel rect-capture, scroll-restore, RAF-clear, `MORPH_SETTLE_MS` body-gate scaffolding. A third surface (Steam library → game detail, live-game participants → champion detail) would force the generalisation called out in [champion-nav-parity.md §Chunk 1](../lol/champion-nav-parity.md) — but the platform primitive is the cleaner generalisation than `ActiveCardProvider<TKey>`.
2. **Portfolio framing.** The View Transitions API is the 2026 default for shared-element morphs. A site that uses the native API where the browser supports it and falls back to Motion is more interesting to look at than one that does either alone.

This is also the explicit follow-up flagged in [vnext-ideas.md §View Transitions API](vnext-ideas.md): "Worth a feasibility spike — if it works for our shared-element morphs, it's a substantial code reduction."

---

## What this is NOT

- **Not a wholesale Motion replacement.** Motion stays primary for gesture, layout reflow on filter, AnimatePresence on stat cards, tilt/sheen/breathe. VT API covers route-level morphs and "filter applied → list reflow" categories only.
- **Not a cross-document migration.** The app is a TanStack Router SPA. Same-document VT only. Cross-document VT is interesting for a future Astro-rendered case-study page but is out of scope here.
- **Not a removal of rect-capture immediately.** Keep `ActiveMatchProvider` and `ActiveChampionProvider` as the fallback path for browsers that lack VT support (mainly Firefox until `view-transition-name` ships default-on; check caniuse at pickup time).

---

## Browser-support stance

Per [03-motion.md](~/.claude/knowledge/frontend-2026/03-motion.md) and caniuse:

- **Same-document VT**: Chrome 111+, Edge 111+, Safari 18+. Firefox is the laggard — verify status at pickup (`caniuse.com/view-transitions`).
- **Cross-document VT**: Safari 18.2+ shipping; Chrome stable; Firefox unknown. Out of scope for this arc.
- **Reduced motion**: VT API does **not** automatically respect `prefers-reduced-motion`. Must opt out manually with the `@media` block from [03-motion.md §6.6](~/.claude/knowledge/frontend-2026/03-motion.md).

Feature-detect with `'startViewTransition' in document`. When false, fall back to the existing Motion `layoutId` morph path. Both code paths coexist; the fallback is what's already running today.

---

## Target outcome

After this arc, the following flows use VT API on supporting browsers:

1. **Champion list → Champion detail → back** (`/lol/$accountSlug/champions` ↔ `/lol/$accountSlug/champions/$championKey`) — champion portrait/icon morphs from grid cell into hero. Name + role badge morphs in lockstep.
2. **Match list → Match detail → back** (`/lol/$accountSlug/matches` ↔ `/lol/$accountSlug/matches/$matchId`) — match row morphs into hero; KDA + champion icon + Win/Loss chip all carry continuous identity.
3. **Steam library → game detail → back** (`/steam/library` ↔ `/steam/library/$gameId`, when it ships) — game tile morphs into hero.
4. **Filter applied → list reflow** on `/lol/$accountSlug/champions` (sort by Games / WR / KDA / Playtime) — the existing `layout` prop on `<m.li>` works fine but VT could replace it on supporting browsers with a single `startViewTransition()` wrap; **gather evidence before adopting** since Motion's `layout` already feels great here.

Visible delta on supporting browsers: the morph is **browser-native, GPU-composited, and immune to React render timing** (no `MORPH_SETTLE_MS` body-gate needed because VT freezes the old snapshot until the new state is ready).

---

## Chunked plan

### Chunk 1 — VT router primitive

New file: `apps/web/src/lib/view-transition-nav.ts`.

Exports:
- `navigateWithViewTransition(navigateFn, name?: string)` — wraps a TanStack Router `navigate()` call inside `document.startViewTransition(() => navigateFn())` when supported, else calls `navigateFn()` directly.
- `useViewTransitionNavigate()` — hook returning the above, bound to the router's `useNavigate()`.
- `prefersReducedMotion()` helper (already lives elsewhere — import, don't duplicate).
- `addReducedMotionGuard()` — injects the `@media (prefers-reduced-motion: reduce) { ::view-transition-group(*) { animation: none !important; } }` block once at app boot.

The primitive is router-agnostic; this keeps the door open for a future Start migration (per [tanstack-start-migration.md](tanstack-start-migration.md)) without rewriting morph logic per route.

Test: feature-detection branches both ways with `vi.spyOn(document, 'startViewTransition')`; reduced-motion path bypasses VT and falls through.

Out of this chunk: a working primitive + its test + reduced-motion guard mounted in `main.tsx`. **No call sites yet.**

### Chunk 2 — Champion list ↔ detail (first morph)

Champion is the right pilot — the surface is simpler than match (single hero element, no team-vs-team layout) and the manual rect-morph just shipped, so the side-by-side comparison is fresh.

Changes:
- [apps/web/src/lol/champions/champion-table.tsx](../../../apps/web/src/lol/champions/champion-table.tsx): on card click, set `view-transition-name: champion-${alias}` on the card via inline style, then call `useViewTransitionNavigate()`. **Do not remove** the existing `ActiveChampionProvider.setOriginRect()` path — it stays as the non-VT fallback (gated behind the same feature-detect).
- [apps/web/src/routes/lol/$accountSlug/champions/$championKey.tsx](../../../apps/web/src/routes/lol/$accountSlug/champions/$championKey.tsx): the hero element receives `view-transition-name: champion-${alias}` inline; the existing `originRectRef` consume path remains for the fallback case.
- New CSS in `apps/web/src/styles/view-transitions.css` (imported once in `main.tsx`):
  ```css
  ::view-transition-group(*) { animation-duration: 280ms; animation-timing-function: cubic-bezier(0.32, 0.72, 0, 1); }
  ::view-transition-old(*), ::view-transition-new(*) { mix-blend-mode: normal; }
  @media (prefers-reduced-motion: reduce) {
    ::view-transition-group(*), ::view-transition-old(*), ::view-transition-new(*) { animation: none !important; }
  }
  ```

Tests:
- Champion table click sets the view-transition-name attribute before navigating (snapshot the inline style).
- Hero mounts with the matching view-transition-name.
- Reduced motion preference suppresses the morph; navigation still works.

Verify in browser per `~/.claude/CLAUDE.md` UI-changes rule — Chromium (works), Firefox (falls back), Safari TP if available, mobile Safari sim.

### Chunk 3 — Match list ↔ detail (second morph)

Same shape as Chunk 2 against:
- [apps/web/src/lol/matches/match-row.tsx](../../../apps/web/src/lol/matches/match-row.tsx) + [match-hero.tsx](../../../apps/web/src/lol/matches/match-hero.tsx).
- Multi-element morph: not only the champion icon but also the Win/Loss chip and KDA text. Each gets its own `view-transition-name: match-${id}-${slot}` so the browser animates them independently while keeping the row/hero as a group.

Open question: how does VT compose with `MORPH_SETTLE_MS` gate? Likely the gate becomes unnecessary on the VT path (VT freezes the snapshot until the new tree settles). Drop the gate when VT fires; keep it for the fallback path.

### Chunk 4 — Filter / sort reflow on champion grid

Evidence-gather first. Compare:
- Current: Motion `layout` on `<m.li>` items reorders on sort change. Already feels great per [vnext-ideas.md §Magazine-grid reflow](vnext-ideas.md).
- VT alternative: wrap `setSort()` in `startViewTransition()`. Each `<li>` gets `view-transition-name: champion-tile-${alias}`. Browser handles the reorder morph natively.

If VT version doesn't visibly improve on the Motion version, **skip this chunk** — Motion `layout` is already class-leading per the KB. Document the spike result in this note either way.

### Chunk 5 — Steam library ↔ game detail

Apply the same primitive to Steam — when the Steam detail route lands, the library tile morphs into the hero. Naming convention: `view-transition-name: steam-game-${appId}`.

This is the third surface that vindicates building the primitive once vs. duplicating context providers.

### Chunk 6 — Trim the rect-morph fallback for VT-only paths

Once telemetry (RUM, even just back-of-the-envelope from owner sessions) confirms VT is firing on the majority of visits, **consider** removing the manual rect-morph plumbing for the VT-covered flows. This is risk-tolerant: keep until at least one quarter of stable VT usage. Do not delete prematurely — the fallback also covers reduced-motion users.

When done, the `ActiveMatchProvider` and `ActiveChampionProvider` shrink to just **scroll-position-restore** (which VT does not handle and which is genuinely a navigation concern, not a motion one).

---

## Files in scope

New:
- `apps/web/src/lib/view-transition-nav.ts` + test
- `apps/web/src/styles/view-transitions.css`

Modified:
- `apps/web/src/main.tsx` (import CSS, mount reduced-motion guard)
- `apps/web/src/lol/champions/champion-table.tsx` + test
- `apps/web/src/routes/lol/$accountSlug/champions/$championKey.tsx`
- `apps/web/src/lol/matches/match-row.tsx` + test
- `apps/web/src/lol/matches/match-hero.tsx`
- `apps/web/src/routes/lol/$accountSlug/matches/$matchId.tsx`
- Steam library + detail when they exist (Chunk 5)

---

## Risks / open questions

- **TanStack Router timing.** `startViewTransition(() => navigate(...))` expects the DOM mutation inside the callback. TanStack Router navigation is async (suspense for loaders). Verify the callback resolves *after* the new route's loader has settled, otherwise the snapshot will capture an empty/skeleton state. Probable fix: `await router.navigate(...)` inside the VT callback, or use the router's `subscribe('onResolved')` event. **Update 2026-05-23:** TanStack Router 1.169.2 ships first-class `viewTransition` prop on `<Link>` and `router.navigate({ viewTransition })`, and `defaultViewTransition` at router level. Internally it awaits loaders before `document.startViewTransition`, so the snapshot-of-skeleton risk is solved by the router — prefer the native prop over a custom `navigateWithViewTransition` wrapper for any flow driven by `<Link>`.
- **Per-element naming collisions.** Two simultaneous morphs (e.g. champion icon + Win/Loss chip) need unique `view-transition-name`s. Document the naming scheme in `view-transition-nav.ts` so a future surface doesn't accidentally collide.
- **Recharts inside the detail page.** Recharts mounts with its own animation. The VT snapshot will freeze the chart in its pre-mount state and animate to its post-mount state, which may look odd. Test; if it does, exclude the chart container from the transition with `view-transition-name: none`.
- **Mobile Safari edge cases.** VT on iOS Safari has known quirks with overflow and `position: fixed` ancestors. The `<main>` scroll-container architecture (per repo CLAUDE.md) should be fine; verify on real device or sim.

## Chunk 2 attempt 2026-05-23 — rolled back, then shipped 2026-05-24

The first pass at Chunk 2 wired the morph end-to-end and was reverted in the same session. The fix landed the following day after the actual root cause was found via a VT lifecycle logger. Symptoms observed in all browsers (Chrome/Safari/Firefox, dev *and* prod):

1. **Card "snapped into place" instead of morphing.**
2. **Breadcrumb on the destination page became unclickable** after one or two failed transitions.
3. **Regression on `/lol/$accountSlug/matches` ↔ detail back-scroll restore** when the match list had been scrolled. Reproducibly correlates with chunk 2 wiring being applied: gone after every rollback, present after every re-apply (including the final shipped version). The matches navigation itself never invokes VT — no `viewTransition` Link prop, no `view-transition-name` anywhere in matches code, no VT lifecycle entries in the console when navigating matches. The mechanism is currently unknown; analysis of the five changed files doesn't show an obvious path of influence on matches scroll-restore (which lives in [`active-match-context.tsx`](../../../apps/web/src/lol/matches/active-match-context.tsx) and the match-list's mount effect). Tracked as a separate follow-up — bisect the changed files (`view-transition-nav.ts` logger side-effect / `champion-table.tsx` `useNavigate` subscription / `$accountSlug.tsx` slideKey / `champion-hero.tsx`) by reverting one at a time and re-running the scroll-restore flow to isolate.

### Root cause

A dev-only VT lifecycle logger added to [view-transition-nav.ts](../../../apps/web/src/lib/view-transition-nav.ts) (wraps `document.startViewTransition` once at boot, logs `updateCallbackDone` / `ready` / `finished` resolutions, enumerates offending elements on `ready` rejection) showed:

```
[vt #1] ready rejected: InvalidStateError: Multiple elements found with view-transition-name: champion-Rell-UTILITY
[vt #1] elements with view-transition-name (3):
  root
  champion-Rell-UTILITY <div data-champion-card="Rell" ...>
  champion-Rell-UTILITY <div data-champion-card="Rell" ...>
```

**Two `ChampionHero` instances in the live DOM at NEW-snapshot capture time.** Not StrictMode (reproduces in prod build), not `defaultPreload: "intent"` (reproduces with it disabled), not the CardTilt AABB hypothesis from the first attempt write-up.

The actual cause is structural: [SectionShell](../../../apps/web/src/_shared/section-layout/section-shell.tsx) wraps the route `<Outlet />` in `<AnimatePresence mode="popLayout">` keyed by `pathname`. During list→detail navigation, AnimatePresence keeps the exiting `<m.div key="/champions">` mounted for its exit animation while mounting the entering `<m.div key="/champions/Ahri">`. Each contains an `<Outlet />`. Crucially, **TanStack Router's `<Outlet />` always renders the current route — it exposes no per-instance location binding** (unlike React Router's `<Routes location={...}>`). So once router state advances during the VT callback, *both* m.divs' Outlets render `ChampionDetailPage`, both heroes apply the same `view-transition-name`, NEW-snapshot capture rejects.

This is a known incompatibility between the AnimatePresence-around-Outlet pattern and per-element VT names. Per [03-motion.md §5.4 + decision tree §6.6](~/.claude/knowledge/frontend-2026/03-motion.md), the 2026 recommended pattern for route transitions is VT directly, not AnimatePresence — AnimatePresence remains correct for component-level mount/unmount. A future arc may migrate SectionShell's slide entirely to VT-driven CSS animations scoped by `viewTransition: { types: [...] }`.

### Fix shipped

Coarsen [`slideKey` in `$accountSlug.tsx`](../../../apps/web/src/routes/lol/$accountSlug.tsx) to the section root for champion-detail routes (mirroring the existing match-detail trick at lines 182–183). When the key doesn't change across list↔detail, AnimatePresence reuses the same `<m.div>` — `{children}` updates in place, only one `<Outlet />` in the DOM at any time, no name collision. Section-level navigations still differ on key, so the inter-section slide still fires.

Other wiring shipped:
- [`champion-table.tsx`](../../../apps/web/src/lol/champions/champion-table.tsx) — `onClick` handler that applies `view-transition-name` via ref, calls `document.startViewTransition` manually (not TanStack's `Link viewTransition` prop, because we need to clear the source name inside the callback before the await so it isn't double-counted at NEW snapshot if anything else goes wrong). Modifier-click + keyboard-Enter fall through to the regular Link path. Rect-morph fallback preserved for non-VT browsers via `supportsViewTransitions()` gate.
- [`champion-hero.tsx`](../../../apps/web/src/lol/champions/champion-hero.tsx) — destination hero applies matching name from `activePosition` (set on the row's `onPointerDown` before navigation).
- Breadcrumb (`champion-breadcrumb.tsx`) **stays on the existing rect-morph path** — forward-only VT for now. If a forward transition ever hangs, the breadcrumb is still a guaranteed escape hatch.
- No global `::view-transition-group` defaults this round (deliberately omitted from the second attempt to eliminate that as a suspect; can add back later if visual polish demands it). **Added back 2026-05-24** scoped to `intra-section` only — see "What's next" #2.
- No body-hold skip — `MORPH_SETTLE_MS` still runs even on VT browsers. Minimises moving parts; revisit if it's visibly redundant. **Gated 2026-05-24** behind `!supportsViewTransitions()` — see "What's next" #2.

### Lessons (kept for any future per-element morph)

- Add the lifecycle logger first; it cracked this case open in one click. The offender-enumeration on rejection is what made the structural cause visible.
- Reproduce in a prod build *and* with feature flags toggled before naming a culprit. We chased StrictMode and preload first because they were the loudest dev-only suspects; both turned out to be wrong.
- AnimatePresence around `<Outlet />` is a structural incompatibility with VT element pairing. Any new section that wants per-element morph either needs `slideKey` coarsening (the trick used here) or needs to live outside the AnimatePresence wrapper entirely.
- The `view-transition-name` on the source should be applied via ref at click time and cleared inside the VT callback *before any await* — having it persistent on a list of cards multiplies the collision risk if the architecture issue ever resurfaces.

## Chunk 3 attempt 2026-05-24 — match list ↔ detail (shipped, single-element)

Applied the same pattern as the champion morph against `match-row.tsx` + `match-hero.tsx`, plus broader `slideKey` coarsening in `$accountSlug.tsx` so the matches list↔detail boundary reuses the same AnimatePresence m.div (same fix shape as champion — the existing match-detail coarsening only covered the detail-tab variants, not the list→detail boundary, so it had to be widened).

### Side regressions found and fixed during the chunk

- **Matches list scroll-restore broke when chunk 2 was applied.** The user kept correlating it to chunk 2 wiring across multiple rollback/re-apply cycles, but the cause stayed elusive through a few wrong guesses (StrictMode, preload-on-intent, the lifecycle logger). The actual fix was instrumenting `match-list.tsx`'s scroll-restore code with temporary `[scroll-debug]` logs — the output showed the pin loop being cancelled with `pinTicks: 0`, meaning React StrictMode's mount → cleanup → remount cycle was racing the first RAF. The pre-existing `didPinRef` guard was set in the effect body, so the StrictMode remount saw it as "already pinned" and skipped restart, leaving scroll stuck wherever the initial render-time `scrollTo` landed (clamped to 0 because the virtualizer hadn't built its total-size container yet). Why chunk 2 surfaced it: chunk 2's additional synchronous work in `$accountSlug.tsx` and module-load timing shifted the race so the cleanup consistently won; pre-chunk-2 the timing happened to leave at least one RAF tick before cleanup. The bug was always latent — chunk 2 just made it deterministic. Fix in `match-list.tsx`: replaced `didPinRef` with `pinCompletedRef` that's marked complete only after the pin loop has actually run (any RAF tick fired, or 600 ms expiration). StrictMode's pre-RAF cleanup leaves `pinTicks === 0` → ref stays clear → remount restarts the loop properly. Activity/Suspense re-fire protection is preserved because successful completion still marks the ref.

- **VT lifecycle logger auto-install dropped.** Was suspected as the scroll-restore cause and gated behind `localStorage.setItem('vt-debug', '1')` before the real cause was found. Decided to keep the gate anyway — globally patching `document.startViewTransition` at module load is the kind of side-effect that should be opt-in. Comment in `view-transition-nav.ts` documents this.

### Stage 2 (multi-element) attempted and abandoned

Spec'd Chunk 3 called for per-slot morphing (`match-${id}-icon`, `-kda`, `-chip`) rather than a whole-card morph. Tried it: the icon slot snapshotted independently of its fade-to-background gradient (sibling element), producing a hard cutoff at the splash strip's right edge mid-morph. Restructured `ChampionCardChrome` to wrap the splash strip + gradient in a single named container — that fixed the cutoff but the wrapper's `inset-0` bounding box obscured the side-panel text during the morph (text lives in the unnamed root crossfade, which composes under the named pseudos). Constrained the wrapper to left 2/3 and recalibrated gradient percentages so the steady-state visual would match — but the right-third of the card lost its solid background overlay, making cards look "naked" in steady state because the body's radial gradient bled through.

Each fix introduced a new artifact. Reverted everything in `match-row.tsx`, `match-hero.tsx`, and `champion-card.tsx` to baseline and shipped Stage 1 instead: a single whole-card view-transition-name (`match-${matchId}`) applied via ref in `onClick`, cleared inside the VT callback before the navigation await, matching the champion morph exactly. Visually consistent across the two surfaces, no rough edges, ships clean.

Multi-element morph remains achievable but requires a more invasive `ChampionCardChrome` refactor than is justified for this chunk. Concretely, the card frame would need to be restructured so the gradient and the right-third background are both *children of the named icon container* (not siblings), with the wrapper still constrained enough to not obscure the side-panel text. That restructure should happen separately, when there's appetite for a dedicated visual-polish session — and it should be validated against all four ChampionCardChrome consumers (champion list/hero, match list/hero).

## Chunk 5 attempt 2026-05-24 — Steam library ↔ game detail (shipped)

Option-2 morph anchor: rather than morph the whole 2:3 portrait tile into the 3:1 landscape hero (which would force a visible aspect warp on the primary art), name only the **shared blurred-capsule layer** that both surfaces render. The source tile adds a hidden `<img src={steamCapsuleUrl(...)}>` as the lowest stacking child; the destination already paints the same blurred capsule as the hero backdrop. Naming just that layer carries visual continuity across the aspect change while the primary art crossfades via the root transition.

Wiring shipped (commit `30d9001`):
- [`library-tile.tsx`](../../../apps/web/src/steam/library/library-tile.tsx) — added `morphLayerRef` + the same onClick shape as champion/match (apply name on ref, clear inside callback before the navigate await, modifier-click and missing-support fall through).
- [`game.$appid.tsx`](../../../apps/web/src/routes/steam/game.$appid.tsx) — inline `style={{ viewTransitionName: \`steam-game-${appid}\` }}` on the existing hero blurred-capsule img.
- [`steam.tsx`](../../../apps/web/src/routes/steam.tsx) — `slideKey` coarsening for `/steam/library` + `/steam/game/*` (mirror of the `$accountSlug.tsx` trick).
- Tests in `library-tile.test.tsx` covering VT name presence at OLD-capture time, clear after, modifier-click bypass, no-support fall-through.

### Lessons

- **`scale-110` on a named morph element causes a visible "shrink at end".** The browser captures the named element's bbox via `getBoundingClientRect`, which reflects transforms but ignores ancestor `overflow:hidden` clipping. With `scale-110`, the snapshot rect is 110% of the container, so the morph lerps toward a rect 5% larger each side than what the final clipped DOM renders. Result: visible shrink as the snapshot is replaced by the actual rendered img. Fix: drop `scale-110` from any element carrying a `view-transition-name`. Filters that don't affect bbox (e.g. `blur-sm`) are fine. Generalises: any transform on the named element (scale, rotate, translate) shifts the captured rect away from the post-transition rendered rect — keep the named element a plain inset-0 layout box.

- **Aspect-ratio mismatches are tractable by naming a shared sub-layer instead of the visible primary art.** When the source and destination surfaces are dramatically different shapes (Steam 2:3 portrait tile → 3:1 landscape hero), morphing the whole frame warps the primary art unpleasantly. Adding a hidden mirror of an asset both sides already render (here: the blurred capsule backdrop) and naming *only* that sub-layer carries continuity without forcing the primary art to warp. The primary art crossfades through the root transition instead. Cost: one extra `<img>` in the source DOM, hidden by the primary art at rest.

### Chunk 5 extension 2026-05-24 — library row redesign + multi-element morph + universal hero backdrop (shipped)

Started as "add VT morph to the library row" and grew into a four-part arc once side-by-side review made the existing capsule-anchor architecture untenable:

**Part 1 — Steam-native row redesign.** Replaced the original compact capsule-strip + text-column row with a full-bleed composition: blurred hero backdrop fills the row, sharp hero on the right with `mask-image:linear-gradient(to_right,transparent_0%,black_45%)` feathering the seam into the card body, logo wordmark + meta overlaid on the left with a stacked-shadow filter (`drop-shadow(0 0 6px rgba(0,0,0,0.85)) drop-shadow(0 2px 3px rgba(0,0,0,0.9))`) for legibility against bright art (Monster Hunter sky, Batman white bg). Extracted as a shared `<SteamGameRowShell>` in [`apps/web/src/steam/_shared/steam-game-row.tsx`](../../../apps/web/src/steam/_shared/steam-game-row.tsx). Reused by both [`library-row.tsx`](../../../apps/web/src/steam/library/library-row.tsx) and the wishlist row in [`wishlist.tsx`](../../../apps/web/src/routes/steam/wishlist.tsx). Skeletons updated to mirror the new shape.

**Part 2 — Multi-element morph (hero + logo).** Dropped the bare `steam-game-${appid}` capsule-anchor entirely in favor of two named landmarks: `steam-game-${appid}-hero` and `-logo`. Source row names the foreground hero img + logo img (via `heroRef`/`logoRef` on the shell), destination [`game.$appid.tsx`](../../../apps/web/src/routes/steam/game.$appid.tsx) names matching elements via inline `style={{ viewTransitionName }}`. Tile carries only the `-hero` name on its hidden mirror layer (no logo to morph from — tile shows portrait capsule, not a wordmark) — destination's `-logo` element simply crossfades via the root transition when navigating from the tile, no regression for that surface. The chunk 3 LoL multi-element attempt failed because `ChampionCardChrome` had a gradient sibling to the named icon that tore at the snapshot boundary; the Steam case avoids this because every named element is an independently-positioned `absolute inset-0` layer with no gradient straddling its bounds.

**Part 3 — Universal hero backdrop.** Once the row stopped using the blurred capsule (because the redesign uses blurred hero), the destination's blurred-capsule backdrop layer became the visible doubled-logo artifact (capsule has the wordmark baked in; logo overlay on top read as "two logos"). Replaced with: destination renders the hero img alone over a CSS gradient fallback (`bg-linear-to-br from-muted via-card to-muted`) for the rare missing-hero case. Server-side backdrop chain in [`steam-image.service.ts`](../../../apps/api/src/img/steam-image.service.ts) reordered to `library_hero.jpg` → `page_bg_generated.jpg` (warmer original) → `page_bg_generated_v6b.jpg` (blue v6b) → `storepagebackground` mirror; bumped `BACKDROP_SCHEMA_VERSION` to 3 (in [`steam-image.ts`](../../../apps/web/src/steam/_shared/steam-image.ts)) and added a `:schemaVersion` route segment to bust the year-long immutable cache cleanly. Page-wide backdrop in [`profile-backdrop.tsx`](../../../apps/web/src/steam/profile-backdrop.tsx) bumped `blur-[5px] → blur-[8px]` + added `brightness-75` + matching dim wash so the same hero asset reads as an ambient palette echo rather than a redundant copy of the in-banner hero. Shared `makeHeroFallbackHandlers` helper chains hero → page-background → CSS-gradient on the destination, row shell's foreground hero, and tile's hidden anchor (covers ~98% of a typical library; the last ~2% are stripped-down standalone variants like CoD MW2 MP-only with no Steam asset set at all).

**Part 4 — Library coverage probe.** Probed the user's actual library (`/api/steam/owned-games`) against the asset chain: 159/175 (90.9%) have `library_hero.jpg`; 13/16 missing-hero titles recover via `page_bg_generated.jpg` (~98% cumulative); 3 are genuinely artless (502 from every probed asset). Side-by-side review of the five candidate Deus Ex assets (the user picked `page_bg_generated.jpg` over the dim/blue v6b) drove the chain reorder; Nightreign side-by-side drove the `library_hero` prepend (Nightreign has hero but no warmer page_bg variant — v6b only).

### Lessons (chunk 5 extension)

- **Multi-element morph is tractable when named elements are independently-positioned bounded layers.** The LoL chunk-3 failure was a sibling-tearing problem (gradient siblings to the named icon); naming a composite slice produced cutoffs at the gradient boundary. The Steam case avoids this because every named element (hero img, logo img) is a standalone `absolute inset-0` layer with no neighbour straddling its bounds. Generalises: before attempting multi-element morph on a new surface, check whether each candidate named element has any sibling that visually extends across its bounding rect — if yes, restructure or pick a different anchor; if no, the morph is structurally safe.

- **Source/destination doing triple duty on one element is a maintenance hazard.** The original chunk 5 used the blurred capsule as (a) loading placeholder, (b) permanent fallback for older titles, AND (c) the morph anchor. When the row redesign changed the visual treatment, the capsule's role as morph anchor became invisible (no longer the user-perceived primary), but removing it broke the placeholder + fallback. Splitting concerns: morph anchor is now the foreground hero (visible to the user); placeholder is a CSS gradient; fallback is a server-side chain. Each role has one owner.

- **`Cache-Control: immutable` requires URL-versioned cache-bust segments for chain-preference changes.** The proxy URL `/img/steam/backdrop/:appid/:assetTimestamp.webp` was unchanged across our chain reorders, so even after the server returned different bytes, browsers kept serving the year-old cached version. Adding a static `:schemaVersion` segment (matching the existing `ACHIEVEMENT_SCHEMA_VERSION` pattern) is the canonical fix — bumping the constant in a single place invalidates the cache for all users. Documented in the `BACKDROP_SCHEMA_VERSION` comment.

- **Aspect-mismatch hero rows want mask-image, not object-position bias.** Earlier attempt was full-bleed hero with `object-position: right` to keep the focal subject visible — but at row aspect ratios (~10:1), every game's vertical centring cropped subjects' heads off. Switching to "hero shown at near-natural aspect on the right ~60% of the row + `mask-image` feathering the left edge into the card body" eliminated the crop problem and the hard-cutoff seam in one move. The hero is shown at close to its native 3:1 aspect; only horizontal cropping happens at narrow widths, which is much more forgiving than vertical.

---

## Screenshot lightbox attempt 2026-05-24 — game-screenshot-strip → lightbox (shipped)

First same-route VT in the codebase — every prior morph hung off route navigation, where the destination element is rendered fresh by the next route. Here both source (active Embla slide) and destination (Radix Dialog lightbox img) live in the same component, the destination is portal-mounted by Radix on state flip, and the source is one slide in a fade-stacked carousel. The handler intercepts `DialogPrimitive.Root.onOpenChange` (both directions), applies `viewTransitionName: screenshot-${appid}` to the source synchronously, calls `document.startViewTransition(...)`, then inside the callback runs `flushSync(() => setModalOpen(next))` to force the React commit before NEW-snapshot capture, then assigns the name to the destination and clears on `transition.finished.finally`. Slide refs are keyed by index in a `Map` so only `slideRefs.current.get(currentIndex)` carries the name — Embla fade-stacks all slides, but only the active one should be paired.

### Lessons (kept for any future same-route modal/lightbox morph)

- **Radix Dialog Content's `data-[state=open]:zoom-in-95` fights VT.** The named destination element is a child of `DialogPrimitive.Content`. When the dialog opens, Radix applies `animate-in zoom-in-95 fade-in-0` on Content, which puts the ancestor at `scale(0.95)` at NEW-snapshot capture time. The destination rect is then 5% smaller than its final size, and the morph subtly pops at the end. Fix: suppress the open-side animation classes (`data-[state=open]:*`) when `supportsViewTransitions()` is true — VT owns the open motion. Keep the close-side classes (`data-[state=closed]:*`) since the OLD snapshot is captured before any close animation starts. Apply the same pattern to any future modal where a child element is VT-paired.

- **Unloaded `<img>` reports natural 0×0 — VT captures destination as 0×0 at the page origin.** First open per game fetches `fullUrl` cold; without explicit `width`/`height` attributes, the img has no intrinsic dimensions until pixels arrive, so its rendered rect is 0×0. The morph then plays back as "shrink and fly to the top-left corner." Fix: set `width={1920} height={1080}` on the img (Steam screenshot aspect) to reserve a 16:9 layout box before pixels load. The reserved rect respects `max-h-[95vh] max-w-[95vw]` and `object-contain` still centres the actual pixels inside the box, so smaller-than-Full-HD screenshots aren't stretched.

- **JPEGs stream top-down — a snapshot mid-load captures top-loaded-bottom-white.** Even with a reserved layout rect, on first open per game the JPEG is fetched cold and decodes top-down. If the NEW snapshot fires before pixels reach the bottom, the morph briefly shows the bottom half as a white flash. Fix: eagerly preload the active `fullUrl` via `new Image()` in a `useEffect` keyed on `[currentIndex, screenshots]` — fires on mount and on every autoplay rotation, so by click time the bitmap is in cache and decoded. Bandwidth cost is one full-res per ~3.5s rotation tick (typical ~200KB Steam screenshot); bounded and reasonable for a game-details page.

- **`flushSync` is non-negotiable for same-route VT.** React state updates are batched/async; without `flushSync(() => setModalOpen(next))` inside the `startViewTransition` callback, the destination element isn't in the DOM at NEW-snapshot capture time and the morph snaps instead of interpolating.

- **Test the VT path via a stubbed `document.startViewTransition`.** happy-dom doesn't ship the API, so the production fallback (`setModalOpen` direct) is exercised automatically by any test that doesn't install the stub. For VT-path coverage, install a fake `startViewTransition` that captures the source's `viewTransitionName` at call time, then asserts source clears + destination receives the name after the callback. See `game-screenshot-strip.test.tsx` for the canonical pattern.

---

## What's next (priority order)

1. ~~**AnimatePresence → VT-driven section slides**~~ — **shipped 2026-05-24** ([section-shell-vt-migration.md](section-shell-vt-migration.md)). SectionShell's `<AnimatePresence>` wrap is gone; route-level transitions go through `defaultViewTransition.types` with per-type keyframes on `::view-transition-old/new`. Safari follow-up shipped same day ([safari-vt-snapshot-cost.md](safari-vt-snapshot-cost.md)).

2. ~~**Visual polish on the shipped morphs.**~~ — **shipped 2026-05-24**. Both deferred items landed and verified visually-equivalent on all three intra-section morph surfaces (champion list↔detail, match list↔detail, Steam library↔detail): (a) per-element morph CSS defaults added in [`view-transitions.css`](../../../apps/web/src/styles/view-transitions.css) — `:root:active-view-transition-type(intra-section)::view-transition-group(*)` overrides UA to 320 ms / `cubic-bezier(0.32, 0.72, 0, 1)` + `mix-blend-mode: normal` on old/new pseudos. Scoped to `intra-section` so shell-level slides keep their snappier 240 ms timing. `vt-main`/`root` are killed by `animation: none` above so the wildcard has no effect there. (b) `MORPH_SETTLE_MS` body-hold now gated by `supportsViewTransitions()` in both [`$championKey.tsx`](../../../apps/web/src/routes/lol/$accountSlug/champions/$championKey.tsx) and [`$matchId.tsx`](../../../apps/web/src/routes/lol/$accountSlug/matches/$matchId.tsx) — VT browsers skip the gate (OLD snapshot already freezes the previous DOM until NEW is captured, so there's nothing to pop into), rect-morph fallback retains the 700 ms hold.

3. **Telemetry / observation period.** Before Chunk 6 (removing the rect-morph fallback for VT-covered flows), get at least a quarter of stable VT usage observed. The fallback also covers reduced-motion users and any browser still lacking VT support, so do not delete prematurely.

### Closed: LoL multi-element morph refinement (2026-05-24)

Considered done — not via shipping, but via deliberate abandonment. The Stage 2 attempt during Chunk 3 (per-slot `match-${id}-{icon,kda,chip}` naming) hit a wall: every fix introduced a new artifact (icon snapshot cut off at the gradient sibling boundary → restructure obscured side-panel text → constrained wrapper made the right-third look "naked"). The mooted next step was a `ChampionCardChrome` restructure to wrap splash + gradient + right-third background as children of a single named container.

Decision: not worth the invasive refactor for the visual delta. Single-element whole-card morph on match-row → match-hero ships clean today; the per-slot version is theoretically nicer but the four ChampionCardChrome consumers (champion list/hero, match list/hero) all have to be re-validated against any restructure, and the steady-state visual cost (gradient bounds, background overlay) keeps pushing the work outward.

The lesson stands: per-element morph is tractable when each named element is an independently-positioned bounded layer with no sibling straddling its bounding rect (per the Steam chunk-5-extension lesson). If a future surface meets that bar without a restructure, multi-element morph is on the table — but the LoL surfaces don't, and forcing them isn't worth it.

---

## Catalogued candidate surfaces (post-Steam survey 2026-05-24)

Surveyed after Steam library shipped to inventory remaining VT-worthy surfaces. The "What's next" list above is the strategic next-step view; this section is the exhaustive catalog so a future session doesn't have to re-survey. Group by category, not by priority — pick based on appetite when picking up.

### List-↔-detail morphs (route navigation)

- **Patches list → patch detail.** [`patches-page.tsx`](../../../apps/web/src/lol/patches/patches-page.tsx) → `/lol/patches/$version`. New surface — currently no morph wiring at all in this section. Single hero element (the patch version badge / header). Straightforward port of the shipped pattern; no aspect-mismatch quirks.
- **Wishlist → game detail.** [`/steam/wishlist`](../../../apps/web/src/routes/steam/wishlist.tsx) currently uses a `?appid=` query-param focus pane rather than a real route. Not a VT problem — a product/architectural decision about whether wishlist becomes a list↔detail pair. If/when it does, VT applies trivially.

### Sort / filter reorder (same-route, list reflow)

For each: drop in `view-transition-name: <surface>-${id}` per row before the sort-state update; wrap the state setter in `startViewTransition()`. The SectionShell incompatibility doesn't apply (same route, same DOM tree). Cheap and self-contained.

- **Steam library tile/row reorder** under [`library-controls.tsx`](../../../apps/web/src/steam/library/library-controls.tsx) (sort: Name / Platform / Playtime / Recent).
- **LoL champion table reorder** under [`champion-sort-selector.tsx`](../../../apps/web/src/lol/champions/champion-sort-selector.tsx) (sort: Games / WR / KDA / Playtime). This is the Chunk 4 spike already in the chunked plan above — compare side-by-side with Motion `layout` before adopting, per the "skip if Motion is fine" gate.
- **Steam achievements** sort / grouping if any becomes user-controllable.

### Modal / lightbox open-close (same-route, element ↔ overlay)

- ✅ **Game screenshot strip → lightbox** — shipped 2026-05-24. See "Screenshot lightbox attempt" section below.

### Deferred (bundled into bigger arcs)

- **Tab indicator bars** — Steam tabs ([`steam.tsx`](../../../apps/web/src/routes/steam.tsx)), LoL account tabs ([`$accountSlug.tsx`](../../../apps/web/src/routes/lol/$accountSlug.tsx)), match-detail tabs ([`match-detail-tabs.tsx`](../../../apps/web/src/lol/matches/match-detail-tabs.tsx)). Motion `layoutId` indicator already works well; visible delta from a VT swap is marginal. Bundled under #1 of "What's next" (the SectionShell migration) rather than separate items.
- **Trophy-case strip → expanded item.** No existing detail target; would need to invent the "click rare-unlock to expand" UX first. Not a VT problem until that UX exists.

---

## Reduced motion

Already handled — see Chunk 1. The standard pattern (per [03-motion.md §6.6](~/.claude/knowledge/frontend-2026/03-motion.md)):

```css
@media (prefers-reduced-motion: reduce) {
  ::view-transition-group(*),
  ::view-transition-old(*),
  ::view-transition-new(*) {
    animation: none !important;
  }
}
```

This kills the animation but keeps the snapshot/swap atomic — the navigation still feels intentional rather than abrupt. See also [reduced-motion-replacements.md](reduced-motion-replacements.md) for the broader audit.
