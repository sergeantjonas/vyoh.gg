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

- **TanStack Router timing.** `startViewTransition(() => navigate(...))` expects the DOM mutation inside the callback. TanStack Router navigation is async (suspense for loaders). Verify the callback resolves *after* the new route's loader has settled, otherwise the snapshot will capture an empty/skeleton state. Probable fix: `await router.navigate(...)` inside the VT callback, or use the router's `subscribe('onResolved')` event.
- **Per-element naming collisions.** Two simultaneous morphs (e.g. champion icon + Win/Loss chip) need unique `view-transition-name`s. Document the naming scheme in `view-transition-nav.ts` so a future surface doesn't accidentally collide.
- **Recharts inside the detail page.** Recharts mounts with its own animation. The VT snapshot will freeze the chart in its pre-mount state and animate to its post-mount state, which may look odd. Test; if it does, exclude the chart container from the transition with `view-transition-name: none`.
- **Mobile Safari edge cases.** VT on iOS Safari has known quirks with overflow and `position: fixed` ancestors. The `<main>` scroll-container architecture (per repo CLAUDE.md) should be fine; verify on real device or sim.

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
