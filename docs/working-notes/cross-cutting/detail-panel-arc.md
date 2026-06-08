# Detail panel arc

**Status:** Active — Chunks 2.1 + 2.2 (LoL match-detail + champion-detail as panel overlays) shipped 2026-06-07; architecture corrected same day after the initial ship had three structural defects. Post-ship polish (2026-06-08): tile-recipe sweep landed "one level of glass" rule across the LoL panel internals — see [docs/repo-conventions.md § Tile background](../../repo-conventions.md), `CardShell.frosted` prop and its plumbing through `ConclusionCard` / `FactCard`. Same arc also addressed the [ancestor-opacity / backdrop-filter pop](../../../memory/feedback_ancestor_opacity_suppresses_backdrop_filter.md), the [Firefox VT snapshot bug](../../../memory/project_safari_vt_bypass.md) (Mozilla 1657997 — engine-gated VT off on FF), the `view-entry` scroll-driven-animation vignette in CardShell, and bumped HD splash preloads to `fetchPriority="high"`. Final shape: `SlidePanel` ([apps/web/src/_shared/slide-panel.tsx](../../../apps/web/src/_shared/slide-panel.tsx)) is a **right-aligned, non-modal, `max-w-4xl` slide-over** — the list peeks out on the left as ambient context, the section strip + global nav stay clickable above. Detail sub-nav (Recap / Your game / Review / Timeline + `‹ Matches` breadcrumb) lives **inside the panel header** — the Model 3 section-strip swap in `$accountSlug.tsx` retired so the strip always shows Profile/Matches/Champions/Trends/Live. Parent layouts ([matches.tsx](../../../apps/web/src/routes/lol/$accountSlug/matches.tsx), [champions.tsx](../../../apps/web/src/routes/lol/$accountSlug/champions.tsx)) keep lists mounted; cold-arrival sentinel via `useActiveMatch` / `useActiveChampion` written from URL on panel mount so existing list scroll-restore + row decoration still fire. Row→hero VT morph + rect-morph fallback preserved untouched. **Next:** Chunk 2.3 (Steam game-detail — route restructure required). Full sub-chunk plan in Chunk 2.3 below.

Detail pages (match detail, champion detail, Steam game detail, future detail surfaces) move from full route-change page swaps to **right-aligned, content-column-width, non-modal slide-over panels with URL-as-state**. The list stays mounted underneath with scroll, virtualizer offset, and filter state preserved; the row→hero morph (VT or rect-morph fallback) handles the entrance animation in concert with a Motion `translateX` slide-in (skipped on cold arrival per the arc — "the panel just *is*, in its open state").

**Architecture corrections (post-initial-ship, same day 2026-06-07).** Three things in the initial plan/implementation were wrong:

1. **Not full-bleed.** The arc proposal called for full-bleed; in practice site content is `max-w-4xl mx-auto` (~896 px) and full-bleed just creates dead margin + obscures the list completely. Final shape: right-aligned `w-full max-w-4xl` so the list peeks out on the left, signalling its presence as the surface the panel overlays.
2. **Not modal.** `modal={true}` (Radix default) traps focus and disables pointer events on everything outside the dialog. With the section strip + global nav above the panel + the list peeking on the left, that meant three live surfaces were dead. `modal={false}` drops both; Radix still fires `onEscapeKeyDown` + `onPointerDownOutside` so ESC + clicking the visible list still close the panel via `onOpenChange`.
3. **Sub-nav had to move into the panel.** The Model 3 design (section strip swaps to detail sub-tabs Recap/Your game/Review/Timeline + `‹ Matches` breadcrumb when on a match-detail page) was correct for the route-page-swap era but breaks once the panel is non-modal: clicking the sub-tabs while a panel is open races Radix's outside-click handler (sub-tabs are outside the dialog → onPointerDownOutside → close → URL goes to `/matches` instead of `/your-game`). The arc spec already called for sub-nav as inline content at the top of the panel — implementing that fully (in the panel header alongside the breadcrumb + share button) removes the race entirely. Strip stays at the top-level (Profile/Matches/Champions/Trends/Live) at all times.

Sister notes: [view-transitions-rollout.md](../archive/view-transitions-rollout.md) (the morph reuses the project's existing VT primitive), [section-shell-vt-migration.md](section-shell-vt-migration.md) (shipped pattern that informed this design), [safari-vt-snapshot-cost.md](safari-vt-snapshot-cost.md) (engine-gate precedent for WebKit fallback).

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

The breadcrumb at the top of the panel content (already established in [nav-condensation-arc.md § 1.1](../archive/nav-condensation-arc.md)) is the explicit "the list is behind this panel" signal that compensates.

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

Inherits from [nav-condensation-arc.md § 1.1](../archive/nav-condensation-arc.md):

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
| Row → panel-content morph | View Transitions API | Project's existing primitive per [view-transitions-rollout.md](../archive/view-transitions-rollout.md) (shipped 2026-05-24). Same `view-transition-name` pattern as the existing champion/match/Steam-library morphs. |
| Share-URL toast | Sonner | Already shipped, wired into TanStack Query cache. Reuse for "URL copied to clipboard". |
| Mobile drawer variant (future) | `vaul` (currently parked in [library-shortlist.md § vaul](library-shortlist.md)) | The shortlist already flags `vaul` for "mobile drawer for match detail." When this arc adds a mobile drawer variant, `vaul` is the natural fit. **Not in scope for the desktop-first ship.** |

**Not recommended:**

- **Motion `layoutId` instead of View Transitions for the morph.** Considered during brainstorm. `layoutId` works everywhere with no engine-gate, but VT is already the project's primitive — switching to `layoutId` for this surface fragments the morph strategy across two systems. Stick with VT, reuse the existing `isWebKit()` engine-gate pattern from [safari-vt-snapshot-cost.md](safari-vt-snapshot-cost.md) if WebKit chops.
- **A new modal/drawer library.** The combination of Motion + Radix Dialog + VT covers every panel concern; pulling in another library would be redundant.

---

## Chunks

Each chunk independently committable. Order is by candidate detail page; the architecture is established in chunk 1 and inherited by later chunks.

### Chunk 2.1 — Match-detail as panel (LoL) ✅ SHIPPED 2026-06-07

The lead candidate. Establishes the pattern; later chunks copy it.

- Convert `/lol/$account/matches/$id` from full-route-change to slide-over panel.
- Parallel-route layout: `matches/route.tsx` renders list + panel outlet; `matches/$id.tsx` renders into the outlet.
- Open animation: row → panel-content morph (reuse existing match-card `view-transition-name` plumbing) + slide-in.
- Close: panel slides out, list scroll/state intact, no re-fetch.
- Cold-arrival flow: list + panel mount together, virtualizer scrolls to row, panel appears without morph or slide.
- Entry-mode sentinel: router state `from: 'list'` set by row click; panel reads sentinel.
- Share button in panel header → clipboard + Sonner toast.
- Breadcrumb + inline detail-tabs already established by [nav-condensation-arc.md § 1.1](../archive/nav-condensation-arc.md); panel just renders them as content.

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

### Chunk 2.2 — Champion-detail as panel (LoL) — ✅ SHIPPED 2026-06-07

Same pattern, applied to champion detail.

- Parent layout [champions.tsx](../../../apps/web/src/routes/lol/$accountSlug/champions.tsx) lifted from old `champions/index.tsx`; owns role filter + sort + aggregated stats + `ChampionTable`. `validateSearch` for `role` moved up to the parent so the search param is shared with the detail child.
- `champions/index.tsx` is now a null stub.
- `champions/$championKey.tsx` wraps its existing detail body in `<SlidePanel>` with share button → clipboard + toast, close → `/lol/$accountSlug/champions`, cold-arrival sentinel via `useActiveChampion().setActiveChampion(championKey)`, `skipSlideInRef` captured at mount so cold deep-links don't slide.
- Existing row→hero VT morph + rect-morph fallback in `champion-table.tsx` preserved untouched. `restoredScrollY` pin loop + `setActiveChampion` pre-navigate also untouched.
- No new tests beyond the SlidePanel primitive tests shipped in 2.1 — the restructure is purely compositional; existing `champion-table.test.tsx` + `active-champion-context.test.tsx` already cover the sentinel + scroll-restore wiring.

### Chunk 2.3 — Steam game-detail as panel — ✅ SHIPPED 2026-06-09

**Shipped commits (in landing order):**

- `1a2a3d87` feat: convert steam game-detail to slide panel (2.3a + 2.3b bundled — restructure + SlidePanel wrap)
- `12fb7d27` feat: rect-flip identity morph fallback for firefox (cross-cutting carry-over from the arc: Firefox no longer loses the Profile↔tab avatar morph; LoL + Steam drivers share `_shared/identity-morph-flip.ts`)
- `25a429d4` feat: cold-arrival scroll-to-row + hd prefetch for steam panel (2.3c)
- `c6ff89db` fix: suppress library hovercard while detail panel is open (2.3d)
- `35bfa6cf` feat: frosted variant on steam panel-internal tiles (2.3f)

**Deferred:** 2.3e — panel-route tests + Safari probe. Existing tests cover the routing, sentinel context, hover-gate, and identity-morph drivers (including the new rect-FLIP fallback). The new `GamePanelHero` component lacks a dedicated test; the morph mechanics were verified end-to-end with a Firefox Playwright probe (transform + Animation samples) but no automated test was added. Owner can request a follow-up commit if the panel hero needs unit coverage.

**Hard-won lessons that fed the repo:**

- Panel-internal `useLayoutEffect` belongs in a **child** component, not the parent. Radix `DialogPrimitive.Content` defers child mount through `@radix-ui/react-presence` even with `open=true`; a parent's mount-only effect runs before the panel children are in the DOM, leaving refs null. LoL's `MatchHero` is the established pattern; Steam now mirrors it via `GamePanelHero`. See the `12fb7d27` commit body for the analogous concern in the identity-morph drivers (effect lives in the helper module, not the parent route).
- `getNavigationType` is VT-gated and returns false on Firefox. Anything that uses it for classification AND needs to run on Firefox (the rect-FLIP fallbacks here) needs to either bypass it or replicate the small section-specific guards inline.
- `prefetchSteamGameBackdrop` was missing `fetchPriority="high"`; matched to the LoL pattern in 2.3c.

**Original sub-chunks (now archived):** 2.3a (route restructure), 2.3b (SlidePanel wrap), 2.3c (library list integration), 2.3d (hover-preview gating), 2.3e (tests — deferred), 2.3f (one-level-of-glass).

---

#### Original plan (preserved for reference)

Inherits the architecture established in 2.1/2.2; the LoL frosted-tile + "one level of glass" convention ([docs/repo-conventions.md § Tile background](../../repo-conventions.md)) is in place and Steam tiles should pass `frosted` to their `CardShell` uses at the in-panel call sites.

**Premise:** Steam library row click → game-detail panel. Same `SlidePanel` primitive as the LoL chunks (right-aligned `max-w-4xl`, non-modal, library peeks out on the left as ambient context). Current state to migrate: [routes/steam/game.$appid.tsx](../../../apps/web/src/routes/steam/game.$appid.tsx) is a full route page with its own header/back chrome; library lives at [routes/steam/library.tsx](../../../apps/web/src/routes/steam/library.tsx) (virtualized, [library-list-virtual.tsx](../../../apps/web/src/steam/library/library-list-virtual.tsx) + [library-grid-virtual.tsx](../../../apps/web/src/steam/library/library-grid-virtual.tsx)).

**Sub-chunks (each independently committable):**

- **2.3a — Route restructure.** Convert the steam route into a parent layout pattern (mirror LoL `$accountSlug.tsx`): library list stays mounted via `<Outlet />`, `game.$appid.tsx` becomes a child route rendering over it. May need to introduce `steam/library.tsx` as the parent that hosts the list + outlet, with current library-tab content moved into an index child. Compare against the LoL pattern in [routes/lol/$accountSlug.tsx](../../../apps/web/src/routes/lol/$accountSlug.tsx) for the load-bearing shape (section strip stays mounted, panel children render in their own scope).
- **2.3b — Wrap game-detail in `SlidePanel`.** Pass `chromeBackdropUrl` = Steam game hero/screenshot. Sticky header carrying back-arrow + game name + share/close. If sub-tabs (Overview / Achievements / Stats) exist, mount them in the panel header like match-detail did. Wire `useActiveGame` sentinel + cold-arrival writing from URL on panel mount so existing list scroll-restore + row decoration still fire.
- **2.3c — Library list integration.** Cold-arrival `scrollToIndex` via the existing virtualizer when the URL points at a specific appId. List ↔ detail back-restore via the `useScrollResetOnNav` skip-pair pattern (extend `ScrollResetSkip` union if needed — see [docs/repo-conventions.md § Scroll-to-top is layered between root and section roots](../../repo-conventions.md#scroll-to-top-is-layered-between-root-and-section-roots)). Hover prefetch + `fetchPriority="high"` on the Steam game hero (mirrors the LoL pattern in [match-row.tsx](../../../apps/web/src/lol/matches/match-row.tsx) and [champion-table.tsx](../../../apps/web/src/lol/champions/champion-table.tsx) — see [memory: ancestor-opacity-suppresses-backdrop-filter](../../../memory/feedback_ancestor_opacity_suppresses_backdrop_filter.md) for the related "don't animate opacity on ancestors of frosted descendants" rule that applies to the panel body).
- **2.3d — Hover-preview gating.** Coordinate with [microtrailer-hover-preview.md](microtrailer-hover-preview.md). Suppress library hover preview when the panel is open (mirror the `MatchListRowPopover` pattern that gates on `useActiveMatch` — see [match-list-row-popover.tsx](../../../apps/web/src/lol/matches/match-list-row-popover.tsx) for the canonical `open={false}` approach that keeps the trigger subtree mounted to avoid the click-race).
- **2.3e — Tests in same commit per chunk.** Same standing bar as the LoL chunks. Cover: panel-mount, cold-arrival sentinel, scroll-restore skip-pair, hover-preview gate, Steam-specific WebKit VT bypass (already in place via [navigation-type.ts](../../../apps/web/src/lib/navigation-type.ts), should keep working — verify with a Safari probe before claiming done).
- **2.3f — Apply "one level of glass" to Steam game-detail tiles.** Per [docs/repo-conventions.md § Tile background: one level of glass between background and content](../../repo-conventions.md). The Steam game-detail FactCard consumers (in [apps/web/src/steam/game/](../../../apps/web/src/steam/game/)) become in-panel and should pass `frosted={true}` to their `FactCard` / `CardShell` calls. Same pattern as champion-detail just shipped — `frosted` prop on `CardShell`, plumbed through `FactCard` via `...rest` (already in place from the LoL sweep), set explicitly at panel call sites.

**Architectural carry-overs from 2.1/2.2:**

- Right-aligned, max-w-4xl, non-modal, `modal={false}` Radix Dialog (panel doesn't trap focus; visible list on left stays clickable).
- Panel chrome is solid `bg-card` + baked `chromeBackdropUrl` (CSS background-image) — NOT a frosted live `backdrop-filter` layer. The "one level of glass" rule treats the in-panel tiles as the first glass layer.
- VT row→hero morph + rect-morph fallback preserved (rect-morph already wired for non-VT browsers including Firefox after the [Mozilla Bug 1657997 gate](../../../apps/web/src/lib/view-transition-nav.ts)).
- Opacity animations on ancestors of frosted descendants are forbidden ([memory: ancestor-opacity-suppresses-backdrop-filter](../../../memory/feedback_ancestor_opacity_suppresses_backdrop_filter.md)). Y-only entrance animations for any wrapper above a frosted tile.
- Steam library tiles use `bg-card/50` (transparent, page-grounded). Inside the new panel they remain transparent — the panel-internals get frosted via the `CardShell.frosted` prop only.

**Out of scope for 2.3:**

- Mobile drawer variant (deferred to 2.4).
- Restructuring the Steam library list itself.
- Adding new tabs to game-detail; this chunk is presentation only, the existing tabs (if any) port as-is.

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

- [nav-condensation-arc.md](../archive/nav-condensation-arc.md) — sibling arc; 1.1's inline-detail-tabs pattern is a prerequisite for the panel content shape.
- [view-transitions-rollout.md](../archive/view-transitions-rollout.md) — provides the existing VT primitive that the row→panel morph reuses.
- [section-shell-vt-migration.md](section-shell-vt-migration.md) — shipped pattern that established route-driven VT in the project.
- [safari-vt-snapshot-cost.md](safari-vt-snapshot-cost.md) — engine-gate precedent if WebKit needs a non-morph fallback.
- [microtrailer-hover-preview.md](microtrailer-hover-preview.md) — Steam library hover preview interacts with panel-open state; coordinate during 2.3.
- [library-shortlist.md](library-shortlist.md) — `vaul` (parked) is the future mobile-drawer pairing.
- [tanstack-start-migration.md](tanstack-start-migration.md) — confirmed migration-neutral; cold-arrival improves under Start.
- [elevation-arcs.md](elevation-arcs.md) — promote this arc to the index when chunk 2.1 starts.
