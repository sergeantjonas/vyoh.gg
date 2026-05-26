# Detail panel arc

**Status:** Planned — design draft from 2026-05-27 brainstorm. No code yet. Depends on [nav-condensation-arc.md § 1.1](nav-condensation-arc.md) inline-detail-tabs pattern landing first.

Detail pages (match detail, champion detail, Steam game detail, future detail surfaces) move from full route-change page swaps to **full-width slide-over panels with URL-as-state**. The list stays mounted underneath with scroll, virtualizer offset, and filter state preserved; the panel slides in from the right with a row-to-content morph for click navigation, or appears in-place for cold deep-link arrivals.

Sister notes: [view-transitions-rollout.md](view-transitions-rollout.md) (the morph reuses the project's existing VT primitive), [section-shell-vt-migration.md](section-shell-vt-migration.md) (shipped pattern that informed this design), [safari-vt-snapshot-cost.md](safari-vt-snapshot-cost.md) (engine-gate precedent for WebKit fallback).

---

## Premise

The current detail-page experience for `/lol/$accountSlug/matches/$id` is a full route change: the list unmounts, the detail page mounts in its place, on close the list re-mounts and re-fetches. That works, but it pays three costs:

1. **List state is destroyed.** Scroll position, virtualizer offset, filter state — all reset on every detail visit. Skip-aware `useScrollResetOnNav` patches some of this for back-navigation, but it's a workaround for unnecessary unmounts.
2. **No deep-link affordance.** Sharing a match URL works, but the recipient lands on a detail page disconnected from the list it came from.
3. **The detail page's chrome competes with the section's chrome.** Today match-detail hides the section nav and shows a breadcrumb; the navigation-condensation arc restores the section nav but the detail-as-its-own-page framing still feels heavier than necessary.

A slide-over panel pattern solves all three at once. The list stays mounted; the panel is a route-driven overlay; deep-linking is first-class because the URL still represents the panel state; and the section nav stays visible behind the panel because the panel doesn't replace the section, it sits inside it.

The pattern generalises beyond match-detail: champion detail, Steam game detail, and any future detail surface (achievement detail, tournament detail, etc.) inherit the same shape.

---

## Surface decision

**Recommendation: full-width slide-over panel, not a side panel.**

A 70%-width side panel would let the list peek out as ambient context — visually nice, but the detail-page candidates (match detail, champion detail, Steam game detail) are all balanced around full-page width. Cramming them into 70% would compromise the content.

Full-width panel keeps every other benefit of the pattern (list stays mounted, URL-as-state, fast close, morph) and only sacrifices the "list peeks out" affordance — which the content can't accommodate anyway.

The breadcrumb at the top of the panel content (already established in [nav-condensation-arc.md § 1.1](nav-condensation-arc.md)) is the explicit "the list is behind this panel" signal that compensates.

---

## Architecture

### Route shape

TanStack Router parallel/nested routes. Conceptually:

```
matches/
  ├── route.tsx            → layout that renders the list AND a panel outlet
  ├── index.tsx            → empty (panel slot is empty when URL is /matches)
  └── $id.tsx              → renders into the panel outlet when URL is /matches/$id
```

The layout always renders the list. The `$id` route renders into the panel outlet when the URL includes `$id`. Visiting `/lol/$account/matches/$id` directly mounts both at the same time — list + panel together, single page render.

Same shape applies to `steam/library/$appid`, future `lol/$account/champions/$champion`, etc.

### Detail-page chrome entry animation

Worth flagging explicitly: this arc's panel open animation **also serves the "detail-page chrome entry" role**. There's no separate need for a chrome-flavoured entry animation in nav-condensation-arc § 1.1 — the breadcrumb + inline detail tabs at the top of the panel content animate in as part of the panel's slide-in. One animation does both jobs.

If this arc ever gets descoped or deferred indefinitely and detail pages stay as full route changes, the inline detail tabs from 1.1 may want their own entry animation pass. Not a concern while this arc is in flight.

### Open / close animation

- **Open (click from list):** trigger a View Transition. The row's avatar / champion icon / K-D-A elements share a `view-transition-name` with their destination positions inside the panel — they morph from row to panel-content. The panel container itself slides in from the right concurrently. The morph and the slide compose visually as one motion.
- **Close (back-navigate or click ✕):** reverse. Panel slides out to the right; morphed elements settle back to their row positions; list is right where you left it (it never unmounted).
- **Cold deep-link arrival:** SSR (or first-paint) delivers list + panel together. Virtualizer scrolls the matching row into view via `virtualizer.scrollToIndex(idx)`. No morph (no "before" position to morph from); the panel just *is*, in its open state. Slide-in animation skipped.

### Entry-mode detection

Two cases at panel-mount:

- **Click-from-list:** the source row was painted before the panel opened. Run row → panel morph + slide-in.
- **Cold arrival (direct URL, refresh, external link):** the source row didn't exist a moment ago. Skip the morph; either skip the slide or run a plain slide-from-edge without paired morph.

**Detection strategy:** a sentinel set in router state when the click handler navigates. Click handler does `navigate({ to: '/matches/$id', state: { from: 'list' } })`; the panel reads the sentinel at mount-time. If present → run morph; if absent → cold arrival, no morph. More reliable than referrer-based heuristics.

### List scroll-restore on cold arrival

Match-list and Steam library are both already virtualized ([library-shortlist.md § Virtualization](library-shortlist.md), shipped, and [project_unified_image_fallback.md](~/.claude/projects/-workspaces-vyoh-gg/memory/project_unified_image_fallback.md) timeline for Steam library). `virtualizer.scrollToIndex(idx)` is the canonical primitive; call it once the match data resolves with the index of the matching row.

**Edge case:** if the deep-linked detail isn't in the loaded list pages (e.g. an ancient match outside the recent N pages), the list either fetches enough pages to include it or just shows whatever it has loaded. Accept the second behaviour — don't design around the edge case.

### Panel content structure

Inherits from [nav-condensation-arc.md § 1.1](nav-condensation-arc.md):

- **Breadcrumb** at the top of the panel content as inline content (e.g. `← Matches · Match · 2026-05-25 vs Aatrox`). Not chrome.
- **Detail tabs** (Recap / Your game / Timeline for match-detail; Overview / Achievements / Stats for Steam game-detail) as inline horizontal tab nav at the top of the panel content. Not sticky. They scroll away as the user reads.
- **Share affordance** in the panel header — a small "share this match / game" button that copies the deep-link URL to clipboard, with Sonner toast feedback. Tiny addition; strong "this app gets it" signal.

The panel container handles its own scroll (the panel is the scroll container, not the page). Main `<main>` scroll stays at the list position while the panel is open.

---

## Library recommendations

The project already has strong primitives for this; no new dependencies should be required.

| Concern | Recommendation | Rationale |
|---|---|---|
| Panel container + slide animation | Custom component using Motion (already in project) | Motion's `animate` + variants handle the slide cleanly. Compositor-only `transform` keeps WebKit happy. |
| Panel accessibility (focus trap, ESC to close, scrim, aria-modal) | Shadcn `Sheet` (Radix Dialog with slide variant) as the headless primitive | Already shadcn/Radix-native at 103 import sites per [library-shortlist.md](library-shortlist.md). Use the dialog primitive's a11y guarantees but wire `open` to TanStack Router's URL state, not local component state. |
| Row → panel-content morph | View Transitions API | Project's existing primitive per [view-transitions-rollout.md](view-transitions-rollout.md) (shipped 2026-05-24). Same `view-transition-name` pattern as the existing champion/match/Steam-library morphs. |
| Share-URL toast | Sonner | Already shipped, wired into TanStack Query cache. Reuse for "URL copied to clipboard". |
| Mobile drawer variant (future) | `vaul` (currently parked in [library-shortlist.md § vaul](library-shortlist.md)) | The shortlist already flags `vaul` for "mobile drawer for match detail." When this arc adds a mobile drawer variant, `vaul` is the natural fit. **Not in scope for the desktop-first ship.** |

**Not recommended:**

- **Motion `layoutId` instead of View Transitions for the morph.** Considered during brainstorm. `layoutId` works everywhere with no engine-gate, but VT is already the project's primitive — switching to `layoutId` for this surface fragments the morph strategy across two systems. Stick with VT, reuse the existing `isWebKit()` engine-gate pattern from [safari-vt-snapshot-cost.md](safari-vt-snapshot-cost.md) if WebKit chops.
- **A new modal/drawer library.** The combination of Motion + Radix Dialog + VT covers every panel concern; pulling in another library would be redundant.

---

## Chunks

Each chunk independently committable. Order is by candidate detail page; the architecture is established in chunk 1 and inherited by later chunks.

### Chunk 2.1 — Match-detail as panel (LoL)

The lead candidate. Establishes the pattern; later chunks copy it.

- Convert `/lol/$account/matches/$id` from full-route-change to slide-over panel.
- Parallel-route layout: `matches/route.tsx` renders list + panel outlet; `matches/$id.tsx` renders into the outlet.
- Open animation: row → panel-content morph (reuse existing match-card `view-transition-name` plumbing) + slide-in.
- Close: panel slides out, list scroll/state intact, no re-fetch.
- Cold-arrival flow: list + panel mount together, virtualizer scrolls to row, panel appears without morph or slide.
- Entry-mode sentinel: router state `from: 'list'` set by row click; panel reads sentinel.
- Share button in panel header → clipboard + Sonner toast.
- Breadcrumb + inline detail-tabs already established by [nav-condensation-arc.md § 1.1](nav-condensation-arc.md); panel just renders them as content.

**Files in scope (estimated):**
- New `apps/web/src/routes/lol/$accountSlug/matches/route.tsx` (layout with panel outlet).
- Refactor `apps/web/src/routes/lol/$accountSlug/matches/$matchId.tsx` to render into the outlet.
- Refactor `apps/web/src/lol/matches/match-list.tsx` click handler to set router state sentinel.
- New `apps/web/src/_shared/slide-panel.tsx` (or similar) — the panel container component, reusable across detail types.
- Move existing match-detail content into panel-content shape.

**Tests in scope (same commit):**
- Click-from-list test: navigates to match-detail, panel opens, row morph fires.
- Cold-arrival test: direct visit to `/matches/$id`, panel mounts in open state, list scrolls to row, no morph.
- Close-restore test: open panel, close, list scroll position preserved, no re-fetch.
- Deep-link sharing test: share button copies correct URL, toast renders.
- ESC closes panel (Radix Dialog a11y).
- Axe scan on panel-open state.

### Chunk 2.2 — Champion-detail as panel (LoL)

Same pattern, applied to champion detail.

- Champion list → champion-detail panel.
- Reuses the `SlidePanel` primitive from 2.1.
- Champion-detail content (already exists) moves into panel shape.

### Chunk 2.3 — Steam game-detail as panel

Same pattern, applied to Steam library.

- Steam library row click → game-detail panel.
- Tabs inside the panel: Overview / Achievements / Stats / etc.
- Coordinate with [microtrailer-hover-preview.md](microtrailer-hover-preview.md) — hover preview is a different surface (the library tile itself); panel open replaces the hover-preview state.
- Reuses the `SlidePanel` primitive.

### Chunk 2.4 — Mobile drawer variant (future)

Out of initial scope. When mobile-first work picks up, swap the desktop slide-over for `vaul`'s bottom-drawer presentation on small viewports. Same URL-as-state architecture; only the presentation differs.

---

## TanStack Start migration interaction

Per [tanstack-start-migration.md](tanstack-start-migration.md): the Start migration is committed direction but priority-slotted **after** MR3/MR4 + PN1–PN4 + TFT shape ship. This arc is **migration-neutral**, and arguably *improves* under Start:

- **URL-as-state is exactly the loader-friendly shape.** Every panel state is a real URL; Start loaders server-prime both the list and the panel queries on cold arrival.
- **Cold-arrival experience improves.** Today: list loads via `useQuery` on mount, then panel loads its detail data — two cascading client-side fetches. Under Start: SSR delivers list HTML + panel HTML together, hydrate runs, virtualizer scrolls to row. No client-side load flash on direct deep-link arrivals.
- **Parallel/nested route mechanics work identically in SPA and Start modes.** The `route.tsx` layout pattern is standard TanStack Router and migrates without change.
- **Morph behaviour unaffected.** The View Transitions API trigger happens on client-side navigation regardless of SSR — clicking a row still runs `startViewTransition()` exactly the same way. Cold arrivals don't morph in either mode (no "before" position).
- **Prerender:** match-list and Steam library are data-driven routes that hit the Node SSR process (not prerendered). No conflict.

**Net:** ship this arc in the current feature window; the migration will improve cold-arrival behaviour automatically once it lands.

---

## Hard guardrails

Inherited from [elevation-arcs.md](elevation-arcs.md) and [motion-backlog.md](motion-backlog.md):

- Slide animation is compositor-only (`transform: translateX(...)`); no `filter`, no `backdrop-filter` on the panel container's open animation. WebKit-safe.
- `prefers-reduced-motion`: replace, don't disable. Reduced-motion variant skips the slide-in animation (panel appears instantly) and skips the row→panel morph (instant content swap). The route-driven open/close still works; only the motion is replaced.
- Engine-gate the row→panel morph on WebKit if the snapshot cost reproduces ([safari-vt-snapshot-cost.md](safari-vt-snapshot-cost.md)) — fall back to a non-morph slide. Slide itself is compositor-only and safe.
- Tests in the same commit as code per [repo-conventions.md § Testing](../../repo-conventions.md).

---

## Open decisions

1. **Edge affordance for "list is behind this panel."** Three options: breadcrumb only, swipe-left edge handle, or both. Breadcrumb alone is the lowest-friction; edge handle is more discoverable but adds a visual element to the panel boundary. Default to breadcrumb only for the first ship of 2.1; revisit during the chunk if it feels underdone.
2. **Scrim behind the panel.** Full-width panel means the list is fully covered. A scrim (semi-transparent dim layer) over the list-behind has no visible effect since nothing's visible — skip it for desktop. Mobile drawer variant (2.4) will need a scrim because the drawer is partial-height.
3. **Browser back from inside the panel content.** History stack on click-from-list: `/matches` → `/matches/$id`. Browser back closes the panel (returns to `/matches`). Browser forward re-opens it. Verify this works cleanly with TanStack Router's route state; should be automatic but test explicitly in 2.1.
4. **Panel-to-panel navigation.** Going from match A's panel to match B's panel (e.g. via a "next match" affordance) is one route change. Decide: morph between two panel-content states (continuous), or close-then-open (discrete). Continuous is fancier but harder; default to discrete for first ship.
5. **Internal panel scroll restoration.** When a user closes and re-opens the same panel during a session, should the panel's internal scroll position restore? Probably no — the panel is content, not a stateful surface. Defer until users ask for it.

---

## Cross-references

- [nav-condensation-arc.md](nav-condensation-arc.md) — sibling arc; 1.1's inline-detail-tabs pattern is a prerequisite for the panel content shape.
- [view-transitions-rollout.md](view-transitions-rollout.md) — provides the existing VT primitive that the row→panel morph reuses.
- [section-shell-vt-migration.md](section-shell-vt-migration.md) — shipped pattern that established route-driven VT in the project.
- [safari-vt-snapshot-cost.md](safari-vt-snapshot-cost.md) — engine-gate precedent if WebKit needs a non-morph fallback.
- [microtrailer-hover-preview.md](microtrailer-hover-preview.md) — Steam library hover preview interacts with panel-open state; coordinate during 2.3.
- [library-shortlist.md](library-shortlist.md) — `vaul` (parked) is the future mobile-drawer pairing.
- [tanstack-start-migration.md](tanstack-start-migration.md) — confirmed migration-neutral; cold-arrival improves under Start.
- [elevation-arcs.md](elevation-arcs.md) — promote this arc to the index when chunk 2.1 starts.
