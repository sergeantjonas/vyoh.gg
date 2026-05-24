# SectionShell → View Transitions migration

**Status:** Shipped 2026-05-24. Part of [elevation-arcs.md](elevation-arcs.md) Tier 1. The Motion `<AnimatePresence>` wrap around the route `<Outlet />` in [`section-shell.tsx`](../../../apps/web/src/_shared/section-layout/section-shell.tsx) has been replaced with native View Transitions for route-level navigation. Companion arc to [view-transitions-rollout](view-transitions-rollout.md). The original chunked plan + spike findings are preserved below for the audit trail.

Read this when picking up VT polish work, when scoping a new section that wants per-element morphing, or when debugging a section-transition regression.

KB anchors: [03-motion.md §3 + §5.4 + §6.6](~/.claude/knowledge/frontend-2026/03-motion.md). MDN: https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API.

---

## What landed

### Core machinery

- [`apps/web/src/main.tsx`](../../../apps/web/src/main.tsx) — `defaultViewTransition.types` callback routes every navigation through [`getNavigationType()`](../../../apps/web/src/lib/navigation-type.ts), emitting one of `slide-left`, `slide-right`, `intra-section`, `cross-section`, `account-swap`, or `false`. Also sets `body[data-vt-shell]` BEFORE `startViewTransition` so the OLD snapshot already reflects the gate, and resets `mainScrollRef.scrollTop = 0` for slide types before the OLD capture so the slide is purely horizontal instead of diagonal.
- [`apps/web/src/styles/view-transitions.css`](../../../apps/web/src/styles/view-transitions.css) — per-type keyframes scoped via `:root:active-view-transition-type(...)`. The view-transition-name `vt-main` attaches to `<main data-vt-main>` only when `body[data-vt-shell="on"]`, so intra-section transitions hand the snapshot to per-element morphs (champion / match / steam-game) without a parent group competing.
- [`apps/web/src/routes/__root.tsx`](../../../apps/web/src/routes/__root.tsx) — `<main data-vt-main>` is the named element; the section header is portaled into a `#section-header-slot` div between `<Nav>` and `<main>` so only the content slides, not the header.

### Per-element morphs

- LoL champion card → champion detail (hero), LoL match row → match detail (hero), Steam game tile → game detail (hero), Steam game row → game detail (hero + logo two-element). Each click handler applies `view-transition-name` to its source element via ref, calls `document.startViewTransition`, then clears the name and navigates with `viewTransition: false` so the per-element morph isn't nested inside a router-level VT.

### Why named `<main>` (viewport-stable element) and not the inner content

The initial spike named `[data-section-content]` — the inner wrapper. That broke in two ways:

1. **Squish-then-stretch on first-load navigations.** The wrapper's height varies with the loaded data (cached library = tall, skeleton = short), so the OLD and NEW snapshots had different group rects and the browser interpolated between them. Fixed by naming `<main>` (which has a stable `flex-1` viewport height inside `h-dvh`), so the group rect is identical across OLD and NEW.
2. **Multi-MB textures stalling Safari.** Naming a document-height element on a list-heavy page (Steam library with 500+ tiles) made the VT pipeline allocate a snapshot bitmap the full document tall. Safari rasters on the main thread, which pushed INP into multi-second territory. Naming the viewport-sized `<main>` caps the snapshot at viewport height.

### Header sliding regression

After re-pointing the name from the inner wrapper to `<main>`, the header (then sticky inside `<main>`) became part of the snapshot and slid with the content. Fixed by portaling the section header out of `<main>` into the slot div in `__root.tsx`. The header keeps its compact spring + band tint (still driven by `mainScrollRef.scrollTop`), but now lives outside the named scroll container so it holds still while only the content slides.

### Scrollbar thumb regression

Tab nav from a long page (matches) to a short page captured an old-snapshot thumb at the deep scroll position and a new-snapshot thumb at the top — the browser interpolated, sliding the thumb diagonally across the gutter. Fixed in `view-transitions.css` by hiding the thumb during VT (`:root:active-view-transition [data-vt-main]` zero-paints `scrollbar-color` + `::-webkit-scrollbar-thumb`). The `scrollbar-gutter: stable both-edges` reservation holds layout, so nothing shifts.

### Adjacent perf work delivered while debugging

The VT debugging surfaced compounding paint cost on the most navigation-heavy surfaces, so the same arc landed:

- **Steam library virtualized** (both row + tile layouts) using TanStack `useVirtualizer` — single-column for rows, `lanes`-based for the tile grid with breakpoint-driven lane count. See [library-list-virtual.tsx](../../../apps/web/src/steam/library/library-list-virtual.tsx) and [library-grid-virtual.tsx](../../../apps/web/src/steam/library/library-grid-virtual.tsx). Drops Steam library first-paint nodes from 2000–3000 to ~150.
- **Shared virtualizer-stats overlay** ([components/virtualizer-stats.tsx](../../../apps/web/src/components/virtualizer-stats.tsx)) reused by match-list + both library variants, gated on `?perf=1` or `vyoh:perf=1` in localStorage.
- **Trends tiles defer-mount** via [`_shared/deferred-mount.tsx`](../../../apps/web/src/_shared/deferred-mount.tsx) — IntersectionObserver-gated, mount once, never unmount. First 4 tiles eager; the rest defer behind a `200px` rootMargin with sized placeholders so the grid doesn't collapse.
- **Recharts off `/recap` chunk** — `MatchLanePhase` (your-game tab) and `MatchGoldLead` (timeline tab) lazy-loaded with `React.lazy` + Suspense inside [`match-detail-view.tsx`](../../../apps/web/src/lol/matches/match-detail-view.tsx). The default landing tab (recap) no longer pulls Recharts.

### Spike cleanup

- `SectionShell` no longer accepts `pathname`, `slideDirection`, or `slideTransitionOverride` — those were AnimatePresence-era props with nothing to drive after the VT migration. Removed in the same pass.
- `apps/web/src/_shared/section-layout/use-tab-slide-direction.ts` (+ test) deleted — the slide direction is now computed router-side in `getNavigationType` rather than per-shell.
- `slideKey` coarsening dropped from both `$accountSlug.tsx` and `steam.tsx` — needed only while AnimatePresence kept old/new Outlets briefly co-mounted; with VT, only one Outlet is mounted at a time.
- Stale "spike-private" framing on the LOL_TAB_ORDER / STEAM_TAB_ORDER constants in `navigation-type.ts` downgraded — the duplication is now documented as deliberate (cheaper than the cross-file indirection until a third surface needs the same lookup).

### Follow-up: Safari snapshot-cost bypass (2026-05-24, same day)

Within hours of the migration shipping, Safari/iOS surfaced visible chop on intra-Steam tab navigation. Chrome and Firefox were fine. The bypass-and-substitute fix that landed is documented end-to-end in [safari-vt-snapshot-cost.md](safari-vt-snapshot-cost.md). Short version:

- `getNavigationType()` returns `false` for intra-Steam navs on WebKit (`isWebKit()` gate), skipping `document.startViewTransition` entirely for the engine that handles the snapshot capture badly.
- A compositor-only CSS slide (`safari-slide-in-from-{left,right}` keyframes + [`useSafariSlideDirection`](../../../apps/web/src/steam/use-safari-slide-direction.ts) hook) substitutes for the visual continuity Safari users would otherwise lose.
- LoL section navs are unaffected — Safari handles their (lighter) snapshot capture fine.

The Steam Profile page also surfaced as a structural outlier during the same arc (~77 composite layers vs ~17 on the other Steam pages). Resolved 2026-05-25 by dropping `backdrop-blur-sm` on `TrophyCaseStrip` rarity badges — Embla mounts all 44 carousel slides, one promoted layer per badge. Solid `bg-background/95` substitute brought the page to 27 layers, within ~10 of sibling-tab parity.

---

## Why

Two forces push this now:

1. **The AnimatePresence-around-Outlet pattern is structurally incompatible with per-element VT naming.** TanStack Router's `<Outlet />` always reads global router state, so during a section navigation both the exiting and entering `<m.div>` children of AnimatePresence render the destination route. When the destination component carries `view-transition-name`-bearing elements, the browser sees two elements with the same name at NEW-snapshot capture and rejects (`InvalidStateError: Multiple elements found`). We've worked around this twice now by coarsening `slideKey` so the AnimatePresence wrapper reuses the same m.div across list↔detail boundaries — see [view-transitions-rollout.md](view-transitions-rollout.md) §"Root cause" and §"Chunk 3 attempt". Each new section that wants VT element-pairing will need the same trick; that's accumulating debt.

2. **The 2026-aligned pattern is to use VT for route transitions and reserve AnimatePresence for component-level mount/unmount.** Per [03-motion.md §3 (View Transitions API) and §5.4 (when AnimatePresence vs ViewTransition)](~/.claude/knowledge/frontend-2026/03-motion.md), AnimatePresence is the right tool for list-item add/remove, popovers, toasts, modal mount — *component-scoped* lifecycle animations. Route-level transitions where "we're swapping the page" is the explicit intent are what VT was designed for. Astro's `ClientRouter`, Next 15+'s `experimental.viewTransition`, and TanStack Router's first-class `defaultViewTransition` config all point at the same convergence.

---

## What this is NOT

- **Not a removal of Motion.** Motion stays primary for everything component-level: tilt, sheen, hover springs, list-item add/remove (e.g. `AnimatePresence` on match-list rows for SSE inserts), modal mount/unmount, the existing `MORPH_SETTLE_MS` body-hold gate, `useReducedMotion` plumbing, and so on. The migration replaces *one* AnimatePresence (the SectionShell route-slide wrap), not all of them.
- **Not a removal of the section slide effect.** The visual outcome should be the same: left/right slide between sections (Matches → Trends → Champions etc.) driven by direction. The implementation moves from Motion variants to CSS keyframes on `::view-transition-old/new`, scoped by transition `types`.
- **Not a removal of the existing `slideKey` coarsening.** Those coarsenings can stay or be removed in a follow-up cleanup, depending on how the new transition mechanism handles list↔detail navigations. Default position: leave them in place during the migration and revisit at the end.
- **Not a re-attempt at multi-element morph.** The Stage 2 multi-element refinement from VT rollout Chunk 3 is closed as abandoned (2026-05-24). Out of scope here; see [view-transitions-rollout.md § Closed: LoL multi-element morph refinement](view-transitions-rollout.md#closed-lol-multi-element-morph-refinement-2026-05-24).

---

## Browser-support stance

Same as the parent VT rollout — Chrome 111+, Edge 111+, Safari 18+, Firefox 134+ (with caveats). Feature-detect via `'startViewTransition' in document` (`supportsViewTransitions()` already in [`view-transition-nav.ts`](../../../apps/web/src/lib/view-transition-nav.ts)).

The fallback question is more interesting here than in the VT rollout: section-level slide currently runs on every navigation regardless of browser. After the migration, browsers without VT would either need (a) AnimatePresence to coexist as a fallback, or (b) accept that they get plain navigation with no slide. Option (b) is acceptable — section transitions are polish, not load-bearing, and per [03-motion.md §6.4](~/.claude/knowledge/frontend-2026/03-motion.md) "replace, don't disable" applies to *motion that conveys information*; a left-vs-right slide direction is decorative. Decision deferred to Chunk 2 of this arc.

---

## Target outcome

After this arc:

- [`section-shell.tsx`](../../../apps/web/src/_shared/section-layout/section-shell.tsx) no longer wraps `<Outlet />` in `<AnimatePresence>`. The Outlet renders directly.
- Section nav `<Link>` elements pass `viewTransition: { types: [<direction>] }` (or the global `router.defaultViewTransition` is set, with types computed per navigation).
- New CSS in [`view-transitions.css`](../../../apps/web/src/styles/view-transitions.css) defines `::view-transition-old(root)` / `::view-transition-new(root)` keyframes scoped to `:active-view-transition-type(slide-left)` / `slide-right` for the directional slide.
- Existing `slideKey` coarsenings stay (for now) so the per-element morph paths in the VT rollout don't regress. Revisit removal in Chunk 4.
- AccountSwitcher, keyboard tab cycling (`useTabSlideDirection`), and the existing direction computation in `$accountSlug.tsx` all keep working unchanged — the migration is mechanism-only, not behaviour.

Visible delta to users: section navigation looks the same (or better, since the GPU-composited VT pseudo-elements are typically smoother than Motion's transform animations on large subtrees). On VT-unsupported browsers: plain instant navigation, no slide.

Visible delta to developers: any new list↔detail surface can opt into per-element VT morphing without needing the `slideKey` coarsening trick — adding the `view-transition-name` is enough. That's the load-bearing payoff.

---

## Chunked plan

### Chunk 1 — Audit + spike

Before any code, inventory every place that depends on SectionShell's AnimatePresence behaviour:

- [`$accountSlug.tsx`](../../../apps/web/src/routes/lol/$accountSlug.tsx): `slideKey` + `useTabSlideDirection` + `slideTransitionOverride` for card-morph routes. The direction logic stays valid; only the consumer changes.
- [`steam.tsx`](../../../apps/web/src/routes/steam.tsx): same SectionShell wrap, same pattern. Confirm what direction/key logic exists there.
- Any other route that wraps in SectionShell. `ugrep -l SectionShell apps/web/src/routes/`.
- Tests: [`section-shell.test.tsx`](../../../apps/web/src/_shared/section-layout/section-shell.test.tsx), [`section-shell-context.test.tsx`](../../../apps/web/src/_shared/section-layout/section-shell-context.test.tsx).
- Spike: build a minimal VT-driven slide on a throwaway branch — `defaultViewTransition` on the router + CSS keyframes on `::view-transition-old/new` keyed by transition type. Verify the slide visual is acceptable and that the rect-morph fallbacks in `champion-table.tsx` / `match-row.tsx` don't regress.

Out of this chunk: a concrete plan document (probably extending this note) for how the migration lands; no production code changes.

#### Chunk 1 findings (2026-05-24)

Audit results — every place that touches SectionShell's AnimatePresence behaviour:

- **SectionShell consumers (only two):** [`$accountSlug.tsx`](../../../apps/web/src/routes/lol/$accountSlug.tsx) and [`steam.tsx`](../../../apps/web/src/routes/steam.tsx). Both compute `slideDirection` via `useTabSlideDirection(pathname, tabIndexOf)` and pass a coarsened `slideKey` as `pathname`. The `SectionShell` API accepts `pathname` + `slideDirection` and uses both *only* to feed the AnimatePresence wrap; nothing else in the shell reads them.
- **`slideTransitionOverride` (LoL only):** `$accountSlug.tsx:245-247` zeroes the transition duration when entering/leaving a card-morph route (champion-detail or match-detail). This exists *because* the AnimatePresence slide otherwise competes with the rect-morph card animation. With AnimatePresence gone, the override has nothing to suppress — drop the param entirely in Chunk 3.
- **Direction computation flow:** `useTabSlideDirection` is a pure render-time hook that diffs `pathname` against the prior render's pathname and returns -1 | 0 | 1 by comparing tab indices. It does NOT depend on AnimatePresence — it composes equally well with a `defaultViewTransition.types` callback. Reuse as-is.
- **Reduced-motion handling:** both sections zero `slideDirection` when `useReducedMotion()` is true. After migration, reduced motion is handled at CSS level (existing block in `view-transitions.css`), so the `slideDirection` zeroing becomes redundant — but harmless. Leave in place for the migration; remove in Chunk 4 cleanup if desired.
- **Tests:** [`section-shell.test.tsx`](../../../apps/web/src/_shared/section-layout/section-shell.test.tsx) (120 lines) covers identity/actions/nav rendering, header ref forwarding, `onHeaderRect`, scroll-driven band opacity. **Nothing tests the AnimatePresence wrap directly** — these tests survive the removal unchanged. [`section-shell-context.test.tsx`](../../../apps/web/src/_shared/section-layout/section-shell-context.test.tsx) (31 lines) covers the `compact` context only.
- **TanStack Router support confirmed.** `defaultViewTransition: boolean | ViewTransitionOptions` is in `@tanstack/router-core@1.169.2` ([router.d.ts:534-542](file:///workspaces/vyoh.gg/node_modules/.pnpm/@tanstack+router-core@1.169.2/node_modules/@tanstack/router-core/dist/esm/router.d.ts#L534)). `types` accepts either a static array or a callback `(locationChangeInfo) => Array<string> | false`. The callback receives `fromLocation`, `toLocation`, `pathChanged`, `hrefChanged`, `hashChanged` — enough to derive section indices and slide direction at the router level without any per-Link wiring. Returning `false` from the callback skips the VT for that navigation (useful for AccountSwitcher cross-slug nav).
- **AccountSwitcher path:** uses `navigate({ to: tabRoute, params, search })` ([account-switcher.tsx:35](../../../apps/web/src/lol/_shared/account/account-switcher.tsx#L35)). With `defaultViewTransition` at the router level, this navigation would by default trigger a VT. The `types` callback should detect same-section-different-slug and return either `['account-swap']` (for a crossfade) or `false` (to bypass VT entirely). Pick crossfade — it reads as intentional, and bypassing means an unstyled cut.
- **`SectionShell.pathname` after migration.** Once the AnimatePresence wrap is gone, `pathname` and `slideDirection` are unused props. Remove from the API in Chunk 3; both call sites simplify.

#### Spike approach (do this on a throwaway branch, no commits)

1. Add `defaultViewTransition` to `createRouter` in `main.tsx` with a `types` callback that returns `['slide-left']`, `['slide-right']`, or `false`. Compute by:
   - Match `fromLocation.pathname` and `toLocation.pathname` against `TABS` from both `$accountSlug.tsx` and `steam.tsx`. If both resolve to indices in the same section's TABS, return `slide-left`/`slide-right` based on sign of `(toIdx - fromIdx)`. If indices are equal (intra-tab navigation, e.g. list↔detail), return `['intra-section']` (so CSS can crossfade or do nothing). If sections differ (`/lol/...` → `/steam/...`), return `['cross-section']` (a different easing/duration). If same-section + same-tab + slug change → `['account-swap']`.
   - Where do TABS live? Currently inlined per-route. The spike can colocate a temporary `getNavigationType(from, to)` in `apps/web/src/lib/` that imports both TABS arrays. If the spike works, productionise by moving the helper to a shared file and adding tests.
2. Add CSS to `view-transitions.css`:
   ```css
   ::view-transition-old(root) { animation: 220ms cubic-bezier(0.32, 0.72, 0, 1) both vt-fade-out; }
   ::view-transition-new(root) { animation: 220ms cubic-bezier(0.32, 0.72, 0, 1) both vt-fade-in; }
   :active-view-transition-type(slide-left) {
     ::view-transition-old(root) { animation-name: slide-out-left; }
     ::view-transition-new(root) { animation-name: slide-in-right; }
   }
   :active-view-transition-type(slide-right) { /* mirror */ }
   @keyframes slide-out-left { to { transform: translateX(-32px); opacity: 0; } }
   @keyframes slide-in-right { from { transform: translateX(32px); opacity: 0; } }
   ```
3. Comment out (do not delete) the `<AnimatePresence>` wrap in `section-shell.tsx` and render `{children}` directly. Keep the existing `slideKey`/`slideDirection` props as no-ops for the spike.
4. Manual verification matrix (all in dev, then prod build):
   - **Section slides:** matches → trends → champions → live → recap; /steam → library → wishlist → achievements; back and forth in both. Verify direction is correct.
   - **List ↔ detail (rect-morph fallback):** champion list → champion detail → back; match list → match detail → back; steam library → game detail → back. VT-supporting browsers should fire per-element morph; Firefox should fall back without regression.
   - **Cross-section nav:** /lol/...matches → /steam/library. Verify the `cross-section` type fires (separate keyframe, not slide).
   - **AccountSwitcher:** swap accounts on /lol/.../matches — verify the `account-swap` type fires a crossfade, not a slide.
   - **Reduced motion:** OS setting on → every navigation is an instant cut (existing CSS guard).
   - **Match list scroll-restore:** scroll deep into /matches, click into a match, back. Verify pin loop restores scroll (the chunk 3 fix in `pinCompletedRef` should still cover this; VT should not regress it because the timing shift was caused by AnimatePresence cleanup, not by VT).
5. If all green, the spike confirms the approach. Productionise the helper, remove the comment-out, and proceed to Chunk 2.

**Spike risks to specifically watch for:**
- `:active-view-transition-type(...)` browser support — caniuse before relying on it. Fallback: emit a `data-vt-type` attribute on `<html>` from a router subscription, and key CSS off that instead.
- `<Link>`-vs-`navigate()` parity: TanStack Router routes both through `defaultViewTransition`, but verify by spying on `document.startViewTransition` calls in a quick test (`vi.spyOn(document, 'startViewTransition')`).
- The existing per-Link `viewTransition: false` opt-outs we don't have any of yet — but the moment we add `defaultViewTransition`, every navigation tries to VT, including ones that don't have a matching `view-transition-name` pair. That's fine (root crossfade), but verify the rect-morph routes in champion-table/match-row/library-tile still take precedence (they call `document.startViewTransition` manually before navigating, which should preempt the router's automatic call — but verify in the lifecycle logger output).

The lifecycle logger (`localStorage.setItem('vt-debug', '1')`) is the primary instrument for this spike — turn it on for every manual check and watch for unexpected double-VT calls or stale snapshots.

### Chunk 2 — Direction-aware VT slide

- Add CSS to [`view-transitions.css`](../../../apps/web/src/styles/view-transitions.css) defining `slide-left` and `slide-right` keyframes on `::view-transition-old(root)` and `::view-transition-new(root)`, scoped by `:active-view-transition-type(...)`.
- Wire the existing direction computation (`useTabSlideDirection`) to call `router.navigate({ viewTransition: { types: [direction] } })` or set `defaultViewTransition` with a `types` callback that reads location info.
- Confirm reduced-motion behaviour: the existing `@media (prefers-reduced-motion: reduce)` block in `view-transitions.css` already zeroes VT animations, so this gets that treatment for free.

### Chunk 3 — Replace SectionShell's AnimatePresence wrap

- Remove the `<AnimatePresence mode="popLayout">` and `<m.div key={pathname} ...>` from [`section-shell.tsx`](../../../apps/web/src/_shared/section-layout/section-shell.tsx).
- Render `{children}` directly (where `children` is the `<Outlet />` from the parent layout).
- The `pageSlideVariants` definitions become dead — remove.
- Update [`section-shell.test.tsx`](../../../apps/web/src/_shared/section-layout/section-shell.test.tsx) accordingly.
- Verify every section navigation still slides correctly (matches → trends → champions → live → recap → /steam/library → /steam/wishlist → etc.).

### Chunk 4 — Cleanup: revisit `slideKey` coarsenings

With AnimatePresence gone, the duplicate-Outlet problem disappears — both list and detail no longer coexist in the DOM at all. The `slideKey` coarsenings in `$accountSlug.tsx` become unnecessary.

But: TanStack Router's own transition behaviour during a VT might still keep components mounted briefly. Test by removing the coarsenings one at a time and re-running the champion + match list↔detail morphs. Only remove them if the per-element morph still works without them.

If they need to stay, document why in `$accountSlug.tsx` (replacing the current comment that references AnimatePresence).

### Chunk 5 — ~~Unblock multi-element morph refinement~~ (closed as abandoned)

The intent was to retry per-slot naming on match-row + match-hero (`match-${id}-icon`, `-kda`, `-chip`) once the AnimatePresence collision was gone, paired with a `ChampionCardChrome` restructure to fix the gradient-cutoff problem from the original Stage 2 attempt.

Closed without shipping (2026-05-24). The architectural blocker is gone, but the restructure cost (four ChampionCardChrome consumers to re-validate against any change) plus the visual cascade from constraining the wrapper (right-third "naked", gradient straddling bounds) was judged not worth the visual delta. Single-element whole-card morphs read clean today; a future surface that already meets the "independently-positioned bounded layer" bar (per the Steam chunk-5-extension lesson) can do multi-element without the restructure, and that's where to spend the budget. See [view-transitions-rollout.md § Closed: LoL multi-element morph refinement](view-transitions-rollout.md#closed-lol-multi-element-morph-refinement-2026-05-24).

---

## Files in scope

Modified:
- `apps/web/src/_shared/section-layout/section-shell.tsx` (remove AnimatePresence wrap)
- `apps/web/src/_shared/section-layout/section-shell.test.tsx`
- `apps/web/src/routes/lol/$accountSlug.tsx` (route navigation calls + possibly revisit slideKey)
- `apps/web/src/routes/steam.tsx` (route navigation calls)
- `apps/web/src/styles/view-transitions.css` (add slide keyframes scoped by type)
- Possibly `apps/web/src/main.tsx` (if `defaultViewTransition` is the chosen entry point)

Possibly new:
- `apps/web/src/lib/use-view-transition-direction.ts` or similar helper if the existing `useTabSlideDirection` doesn't compose cleanly with the new mechanism.

---

## Risks / open questions

- **Spec maturity of `viewTransition.types`.** The `types` API for scoping CSS via `:active-view-transition-type(...)` is part of CSS View Transitions Module Level 2, currently a Working Draft (https://drafts.csswg.org/css-view-transitions-2/). Chrome and Safari both ship it; Firefox status needs verification at pickup. Without `types`, we'd need a different mechanism for direction-keyed slide (perhaps adding a data-attribute to `<html>` from the router subscription, scoped CSS reads it). Fallback design exists; just call it out before starting.
- **AccountSwitcher transition.** The account switcher changes the URL from `/lol/<oldSlug>/...` to `/lol/<newSlug>/...` — different `accountSlug` but same section. Currently this also triggers the section slide. After migration, decide whether account swaps should slide, crossfade, or do nothing. Probably a quick crossfade is right (consistent with how "same section, different params" navigations feel in native apps).
- **Keyboard tab cycling.** The current shell supports arrow/tab navigation between sections. Need to verify the direction-aware VT types still get passed correctly when the navigation originates from a keyboard handler vs a `<Link>` click.
- **Suspense + VT timing.** TanStack Router's `viewTransition` integration awaits route loaders before snapshotting. None of our current routes use loaders (queries do the data work in components), so the snapshot fires immediately on navigate — which is fine for static layouts but worth re-testing after the migration since the AnimatePresence transition currently masks any "snapshot of skeleton" issues.
- **Reduced motion replacement.** The existing `prefers-reduced-motion` block in `view-transitions.css` zeroes the animation but keeps the snapshot/swap atomic, which is the right pattern. After migration, reduced-motion users get an instant cut between sections instead of the current Motion-animated slide. Per [03-motion.md §6.2](~/.claude/knowledge/frontend-2026/03-motion.md), replace-don't-disable applies; consider whether a brief crossfade replacement is warranted for reduced-motion (probably yes, ~150 ms).

---

## Related notes

- [safari-vt-snapshot-cost.md](safari-vt-snapshot-cost.md) — Safari-specific follow-up arc that landed the WebKit bypass + CSS-slide substitute for intra-Steam navs.
- [view-transitions-rollout.md](view-transitions-rollout.md) — the parent arc. This migration unblocked any future per-element morph work; the LoL multi-element refinement that motivated it was closed as abandoned the same day.
- [elevation-arcs.md](elevation-arcs.md) — index of "elevate past boring app" arcs.
- KB: [03-motion.md](~/.claude/knowledge/frontend-2026/03-motion.md) §3 (View Transitions API), §5.4 (List entry/exit with AnimatePresence and ViewTransition), §6.6 (View Transitions and reduced motion).
