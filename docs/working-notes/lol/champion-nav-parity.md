# Champion list ↔ detail navigation parity — roadmap

**Status:** Shipped 2026-05-23 (commits `fe3de30`, `452c837`, `ae484a8`, `90b39b0`). Keep this note as the reference for the shape of `active-champion-context.tsx` ↔ `active-match-context.tsx` parity if/when a third surface (e.g. live-game participant cards) wants the same scaffold.

Read this when scoping the next champion-surface polish pass, or before touching `champion-table.tsx` / `routes/lol/$accountSlug/champions/$championKey.tsx`.

---

## Premise

`match-list → match-detail` carries an end-to-end navigation choreography that `champion-list → champion-detail` is missing despite the surfaces being structurally siblings. The gap is visible to anyone navigating both flows back-to-back: match → detail → back feels designed, champion → detail → back feels like a routing primitive.

What match has, that champion doesn't:

1. **Backward breadcrumb** — `MatchBreadcrumb` in [apps/web/src/routes/lol/$accountSlug/matches/$matchId.tsx:58](../../../apps/web/src/routes/lol/$accountSlug/matches/$matchId.tsx) renders a `ChevronLeft + "Matches"` link that re-records an origin rect with `direction: "backward"` so the hero animates back into the originating list row. Champion detail has no breadcrumb at all — back-nav is browser-only.
2. **Scroll-position restore** — `ActiveMatchProvider` ([apps/web/src/lol/matches/active-match-context.tsx](../../../apps/web/src/lol/matches/active-match-context.tsx)) holds a `scrollYRef`. `MatchRow` calls `saveListScroll()` on forward click; `MatchList` reads `readListScroll()` on return and scrolls to that position so the user lands where they left. Champion list re-mounts at scroll 0 on return.
3. **Origin-rect-driven hero morph** — separate from the shared `layoutId` morph (which Motion handles for free), the match flow also captures the *clicked row's* `getBoundingClientRect()` and feeds it to `MatchHero` so the detail hero animates *from that exact rect* on forward nav and *back to it* on return. Champion flow has the layoutId but no rect capture — the morph works on the way in (because Motion can read the source layout) but the return trip has nothing to morph *to* once the source list isn't mounted yet.
4. **`MORPH_SETTLE_MS` body delay** — `MatchDetailLayout` gates body content behind a settle timeout so the hero finishes morphing before the rest of the page lands. Champion detail renders everything together.

The shared element layoutId (`champ-card-${alias}`) on champion-table + champion-detail-hero already handles the *forward* morph in the happy path. The work below is mostly the **return trip** + scroll memory + breadcrumb affordance.

---

## Why now (not now-now, but on the docket)

- Pure polish, no data dependency — fits a single follow-up session once the more substantive arcs (match-depth Phase D, LP3) take priority.
- Code-reuse opportunity: 80% of the scaffold is already in `active-match-context.tsx`. A second use case suggests generalising to `active-card-context.tsx`, but that refactor is its own decision — see Chunk 1 below.

---

## What this is NOT

- **Not a redesign of the champion list or detail pages.** The information density already landed in the 2026-05-23 alignment commit (`b42df7c`). This arc adds choreography around the navigation, nothing else.
- **Not a Steam-side concern.** Steam library cards have a different visual treatment and a hover-card affordance instead of detail morph. Out of scope.

---

## Chunked plan

### Chunk 1 — Pick a context shape

Decision before any code: do we duplicate `ActiveMatchProvider` as `ActiveChampionProvider`, or generalise both into `ActiveCardProvider<TKey>` shared in `_shared/`?

Recommendation: **duplicate first, generalise after**. The match version carries match-specific concerns (`matchId` string vs. champion alias, different rect-consumer call sites) and a parallel implementation makes the diff between the two flows legible. Generalisation only after a third surface (e.g. live-game participant cards → detail) asks for the same shape.

Out of this chunk: file picked (`active-champion-context.tsx`), mount point picked (`$accountSlug.tsx` next to `ActiveMatchProvider`), test file created.

### Chunk 2 — Forward-nav capture in `champion-table.tsx`

On card click:
- `saveListScroll()` — read `mainScrollRef.current?.scrollTop`.
- `setOriginRect({ alias, rect: cardRef.current?.getBoundingClientRect(), direction: "forward" })`.
- `setActiveChampion(alias)`.

Test: clicking a card writes all three values to the context. Reference pattern: [match-row.test.tsx](../../../apps/web/src/lol/matches/match-row.test.tsx).

### Chunk 3 — Detail hero consumes origin rect

In `routes/lol/$accountSlug/champions/$championKey.tsx`:
- `useEffect(() => { const o = originRectRef.current; if (o?.direction === "forward") { ...animate from o.rect... } setOriginRect(null); }, [])` — RAF-delayed clear matching [match-hero.tsx:43-73](../../../apps/web/src/lol/matches/match-hero.tsx) so StrictMode's double-mount doesn't lose the origin.
- `data-champion-card={alias}` attribute on the hero element so the breadcrumb can rect-lookup it for the return trip.
- `bodyReady` gate via `MORPH_SETTLE_MS` before secondary panels render (per-game KDA tiles, sparkline, build sankey, etc.) — body fades in once the hero is settled.

Test: hero mounts with origin rect → animates from that rect; mounts without → animates from default.

### Chunk 4 — `ChampionBreadcrumb` component + backward-direction trigger

New component matching `MatchBreadcrumb` shape. On click:
- Look up the current hero's rect via `document.querySelector('[data-champion-card="${alias}"]')`.
- `setOriginRect({ alias, rect, direction: "backward" })`.
- TanStack `Link` to `/lol/$accountSlug/champions` (preserve search params per the match version).

The label and chevron should match the match breadcrumb visually so the affordance is recognisable across both flows.

Test: clicking the breadcrumb writes a backward origin rect with the hero's current bounding box.

### Chunk 5 — List scroll-restore + backward-morph consume on return

In `champion-table.tsx`:
- On mount, if `activeChampion` is set and `readListScroll() > 0`, scroll the main container to that position **before** the layout settles so the morph target lands in the right place.
- The destination row's `layoutId` already triggers Motion's morph; the rect-from-origin animation is bonus glide that smooths over Motion's measure step.

Reference pattern: [match-list.tsx:53](../../../apps/web/src/lol/matches/match-list.tsx) + the `morphEpoch` bump pattern documented in [motion-backlog.md:63](../cross-cutting/motion-backlog.md).

Test: navigating list → detail → back via breadcrumb lands at the scrolled-to position with the active card still rendered.

### Chunk 6 — Reduced-motion gate + parity audit

Two passes before close:
- `useReducedMotion()` short-circuits all rect-based animation but preserves the breadcrumb + scroll memory (those are not motion, they're navigation).
- A side-by-side check of the four match files vs. the four champion files (context, list, row, hero) so the parity holds: same hook signatures, same StrictMode-safe rect consumption, same RAF clear timing.

---

## Files in scope

- New: `apps/web/src/lol/champions/active-champion-context.tsx` + test
- New: `apps/web/src/lol/champions/champion-breadcrumb.tsx` + test
- Modified: `apps/web/src/lol/champions/champion-table.tsx` + test (forward capture + scroll restore)
- Modified: `apps/web/src/routes/lol/$accountSlug/champions/$championKey.tsx` (rect consume + body settle + breadcrumb mount)
- Modified: `apps/web/src/routes/lol/$accountSlug.tsx` (mount the new provider)

All test files in the same commit as their code per the standing rule.

---

## Reference files in the match flow

The match version is the source of truth — read these together when picking the arc up:

- [apps/web/src/lol/matches/active-match-context.tsx](../../../apps/web/src/lol/matches/active-match-context.tsx) — 73 lines, full provider shape
- [apps/web/src/lol/matches/match-hero.tsx](../../../apps/web/src/lol/matches/match-hero.tsx) — origin-rect consumer + RAF clear pattern
- [apps/web/src/lol/matches/match-row.tsx](../../../apps/web/src/lol/matches/match-row.tsx) — forward-nav capture
- [apps/web/src/lol/matches/match-list.tsx](../../../apps/web/src/lol/matches/match-list.tsx) — scroll restore on return
- [apps/web/src/routes/lol/$accountSlug/matches/$matchId.tsx:58](../../../apps/web/src/routes/lol/$accountSlug/matches/$matchId.tsx) — `MatchBreadcrumb`
