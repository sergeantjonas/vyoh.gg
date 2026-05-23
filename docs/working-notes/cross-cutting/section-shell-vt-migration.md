# SectionShell → View Transitions migration

**Status:** Planned. Part of [elevation-arcs.md](elevation-arcs.md) Tier 1. Removes the Motion `<AnimatePresence>` wrap around the route `<Outlet />` in [`section-shell.tsx`](../../../apps/web/src/_shared/section-layout/section-shell.tsx) in favour of native View Transitions for route-level navigation. Companion arc to [view-transitions-rollout](view-transitions-rollout.md) — the VT rollout depends on this for any per-element morph beyond the single-element shape currently shipped.

Read this when picking up VT polish work, when scoping a new section that wants per-element morphing, or before adding a third surface that would otherwise need the `slideKey` coarsening trick.

KB anchors: [03-motion.md §3 + §5.4 + §6.6](~/.claude/knowledge/frontend-2026/03-motion.md). MDN: https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API.

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
- **Not a re-attempt at multi-element morph.** The multi-element refinement deferred from Chunk 3 of the VT rollout is gated on this migration (so it has a stable architectural foundation), but it's a *separate* chunk and not in scope here.

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

### Chunk 5 — Unblock multi-element morph refinement

With the structural foundation in place, retry the multi-element morph deferred from VT rollout Chunk 3 (per-slot naming on match-row + match-hero: `match-${id}-icon`, `-kda`, `-chip`). This includes the `ChampionCardChrome` restructure work documented in the VT rollout's Stage 2 attempt write-up.

This chunk lives here (not in the VT rollout) because the restructure work is what the migration unblocks — multi-element morph wasn't blocked by VT itself, it was blocked by the AnimatePresence collision class compounding with the gradient-cutoff problem. Solving the architectural issue first means the visual polish work can focus on the visual question.

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

- [view-transitions-rollout.md](view-transitions-rollout.md) — the parent arc. This migration is the prerequisite for its multi-element refinement and any future per-element morph work.
- [elevation-arcs.md](elevation-arcs.md) — index of "elevate past boring app" arcs.
- KB: [03-motion.md](~/.claude/knowledge/frontend-2026/03-motion.md) §3 (View Transitions API), §5.4 (List entry/exit with AnimatePresence and ViewTransition), §6.6 (View Transitions and reduced motion).
