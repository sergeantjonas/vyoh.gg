# Match-detail section nav — roadmap

**Status (2026-05-17):** MDN1–MDN4 shipped. MDN5 deferred until queued owner-data sections land.

Read this when starting the arc, when scoping where the next owner-data feature lands, or before adding any new section to `MatchDetailView` (so it goes into the right tab from day one).

---

## Premise

`/lol/$accountSlug/matches/$matchId` is already 7 sections tall and the post-Tier-1A ideation sweep ([lol-owner-data-features.md](lol-owner-data-features.md)) queues at least 6 more (spell casts, damage profile, CC/death time, multikills, all-10 damage stacked bar, full rune page) plus the Phase E composite S+/S/A grade. Continuing to stack them produces one very long page with no clear visual contract for where to look.

The fix is two-fold:

1. **Tabs at the page level.** The match-detail page introduces its own tab bar — three tabs, not a content dump. Different from the section-level tab bar (Matches / Champions / Trends / Live) which is hidden on this route today and stays hidden.
2. **Scrollspy inside any tab whose section count grows past ~3.** A second tier of navigation *within* a tab, not a second sticky chrome layer. Scrolls with content, highlights active section via IntersectionObserver.

This explicitly does **not** introduce a fourth sticky chrome layer. The prior sticky per-view controls slot was reverted on 2026-05-10 because three stacked sticky layers (global nav + account header + sticky sub-controls) was structurally too heavy on a 1080p viewport ([vnext-ideas.md:235](vnext-ideas.md)). Match-detail tabs must live *inside* the existing sticky envelope (with the `ChampionStickyStrip` past the hero), not as a new tier.

---

## What this is NOT

- **Not PG4.** The peer-route post-game artifact at `/lol/$accountSlug/post-game/$matchId` ([post-game-close-the-loop.md](post-game-close-the-loop.md)) remains a separate surface — the share-friendly per-game *read* with verdict + baseline deltas + narrative. Reachable from any match row via "Read this game →". The match-detail page tabs cover the structural breakdown of the game itself; PG4 covers the personal verdict layered on top. Don't duplicate PG4 content as a tab here.
- **Not a section-tab-bar replacement.** The section-level tab bar (handled by `SectionShell` in `_shared/section-layout/`) stays hidden on match detail. The new match-detail tab bar is its own primitive.

---

## Section inventory

### Currently rendered on `/lol/$accountSlug/matches/$matchId`

| # | Section | Source | Audience |
|---|---|---|---|
| 1 | `MatchHero` + `ChampionStickyStrip` | route wrapper | all |
| 2 | `MatchHeaderStrip` (team objectives / gold / soul / first-blood / first-tower) | `match-detail-view.tsx` | all |
| 3 | `TeamBlock` × 2 (blue / red side-by-side) | `match-detail-view.tsx` | all |
| 4 | `MatchBuildOrder` | `match-detail-view.tsx` | owner |
| 5 | `MatchGoldLead` | `match-detail-view.tsx` | all |
| 6 | `MatchEventTimelines` (+ map overlay modal) | `match-detail-view.tsx` | all |
| 7 | `MatchSkillOrder` | `match-detail-view.tsx` | owner |
| 8 | `MatchLanePhase` | `match-detail-view.tsx` | owner |

### Queued from [lol-owner-data-features.md](lol-owner-data-features.md)

| Section | Audience | Phase |
|---|---|---|
| Spell cast strip (Q/W/E/R + summoner casts) | owner | new |
| Damage profile (stacked dealt + received, owner row) | owner | new |
| CC time / time spent dead / longest survival | owner | new |
| Multikill badge strip | owner | new |
| All-10 damage dealt stacked bar | all | new |
| Full rune page panel | owner | Phase E |
| Composite S+/S/A score-of-game grade | owner | Phase E (design-gated) |

Future additions (spell-cast aggregations on Champion detail, etc.) don't land here — this list is match-detail page only.

---

## Tab grouping — Option A (locked)

Three tabs, owner-vs-everyone data-shape split. Hero stays *above* the tabs as always-visible page identity; tabs sit with the sticky champion strip past the hero.

### Recap *(default tab)*

Everything that reads "what happened, for all ten players." Lands here on direct navigation.

- `MatchHeaderStrip` (objectives / gold / soul / first-blood / first-tower)
- `TeamBlock` × 2
- All-10 damage stacked bar *(queued)*
- Multikill badge strip *(queued — visually loud, fits the "headline" read)*

### Your game

Owner-deep panels. The Tier-1A data retention conclusion ("owner participant keeps the full Riot payload, non-owner stays lean") materializes most visibly here. Largest tab — likely scrollspy target.

- Spell cast strip *(queued)*
- Damage profile (dealt + received) *(queued)*
- CC time / time spent dead / longest survival *(queued)*
- Full rune page panel *(queued, Phase E)*
- `MatchSkillOrder`
- `MatchBuildOrder`
- `MatchLanePhase`

### Timeline

Chronological evolution of the game. Reads from `MatchTimelineCache` projections.

- `MatchGoldLead`
- `MatchEventTimelines` (+ map overlay modal trigger)

### Why this split

- Maps to the Tier-1A data shape (all-ten lean vs. owner-full) we just locked in.
- Keeps Recap glance-readable: header strip + team blocks + a single damage panel.
- Concentrates the queued growth in "Your game" — most queued additions are owner-only, and scrollspy gives "Your game" room to grow without re-fragmenting tabs.
- Timeline is small but coherent — gold lead chart + event feed + map overlay all share a temporal frame.

### Iteration triggers

Revisit the grouping if any of these become true:

- "Your game" grows past ~7 stacked sections even with scrollspy → split runes/build into its own tab.
- "Recap" gains 3+ new always-visible sections → consider adding scrollspy there too.
- A queued addition has no clean home (e.g. a comparison view that's owner-vs-team rather than owner-only or all-10) → may indicate a fourth tab.

---

## Scrollspy approach

Only inside tabs whose section count exceeds 3. At plan time, that's **"Your game" only**; Recap and Timeline are fine without.

### Mechanics (as shipped)

- Scroll-listener on `mainScrollRef` (same pattern as `useHeroScrolledPast`) — not IntersectionObserver, which was the original plan. Scroll-listener is simpler and handles tall sections reliably.
- Active section = the last one whose top edge is ≤ the sticky-chrome threshold (`[data-champion-strip]` bottom when visible, else `[data-account-header]` bottom + 80px fallback). Implemented in `apps/web/src/lol/matches/use-scrollspy.ts`.
- Sub-nav is a **sticky sidebar** on the right of the content column (`position: sticky; align-self: flex-start; top: calc(var(--account-header-h, 64px) + 88px)`). The original plan called for a non-sticky horizontal bar scrolling with content, but that proved useless — it disappeared before you could use it.
- Sidebar is **gated on actual scrollability**: `ResizeObserver` on the scroll container checks `scrollHeight > clientHeight` after the tab mounts. Sidebar only renders when there is content to scroll through.
- Sidebar is hidden on mobile (`hidden sm:flex`).
- Click on a sub-nav label → programmatic `scrollEl.scrollTo()` offset by the sticky-chrome threshold.

### Reduced motion

- `useReducedMotion()` passes `behavior: "auto"` to `scrollTo` instead of `"smooth"`.
- Active-section highlight is a plain color/weight swap — no spring, no underline animation.

### Why the sidebar is sticky (deviation from original plan)

The original spec said "scrolls with content, not a sticky third tier." In practice, a non-sticky horizontal nav above the sections scrolls out of view as soon as you start reading, making it useless. A sticky sidebar within the content column is the right pattern — it is not a new sticky chrome tier (it doesn't span the full viewport width and sits inside the `max-w-4xl` content area), so the three-layer constraint isn't violated.

---

## Layout placement

```
[ ← Matches  ·  Match {matchId}              ]   ← breadcrumb row (above hero)
[ MatchHero                                   ]   ← collapses to ChampionStickyStrip on scroll
[ Recap | Your game | Timeline                ]   ← match-detail tab bar (sticks with champion strip)
[ Active tab content          | scrollspy nav ]   ← Your game: two-column; sidebar sticky on right
[   ...sections...            | Build         ]
[                             | Skills        ]
[                             | Lane phase    ]
```

### Sticky envelope

Past the hero, the sticky chrome is one envelope:

1. Global nav (top)
2. Account header (`--account-header-h`)
3. `ChampionStickyStrip` + match-detail tab bar (single sticky band at `--account-header-h`)

No new sticky layer is introduced. The champion strip and the tab bar share the band — design decision: visually a single row, with the tab labels to the right of the K/D/A line, or stacked as two thin lines if the row gets too dense. Decide during Chunk 3.

### Breadcrumb migration

Currently `< Matches` replaces the section tab bar slot via `isMatchDetail` in `AccountLayout` (see [section-layout-extraction.md](section-layout-extraction.md)). Moves to a slim row above the hero: `← Matches · Match {matchId}` or just `← Matches`. The section-tab-bar slot stays hidden on this route (the new match-detail tab bar is page-owned, not section-shell-owned).

---

## URL state

- Tab state in URL fragment: `?tab=your-game`, `?tab=timeline`. Default `recap` (omitted from URL).
- Scrollspy sub-nav state is *not* URL-persisted by default — too noisy on history. If deep-linkable section anchors prove useful (e.g. "open rune page panel directly"), add `#section-id` as a v2.
- TanStack Router search params, not hash, for tab state — consistent with the rest of the app and avoids hash-vs-route-hash conflicts.

---

## Phasing — chunks

Each chunk is independently committable and live-verifiable.

### Chunk MDN1 — breadcrumb migration + tab primitive shell ✓

- Moved breadcrumb above the hero. Introduced `<MatchDetailTabs>` in `match-detail-tabs.tsx` with spring underline indicator. All content still under Recap; other tabs inert placeholder.

### Chunk MDN2 — content split ✓

- Sections split per inventory. `?tab=` search param via TanStack Router `validateSearch`. Default recap omitted from URL. All three tabs render real content.

### Chunk MDN3 — sticky behaviour ✓

- Tab bar sticks inside `ChampionStickyStrip` past the hero. Two-row strip layout (champion info row + compact tab row). In-page tabs use `visibility: hidden` when strip is active to preserve layout space. Separate `layoutId` values prevent cross-instance Motion animations.

### Chunk MDN4 — scrollspy in "Your game" ✓

- `useScrollspy` hook in `use-scrollspy.ts` — scroll-listener, `refFor` factory, `navigateTo` with smooth/auto.
- Sticky sidebar alongside content (see Scrollspy approach above for deviation from original spec).
- Sidebar gated on `scrollHeight > clientHeight` with `ResizeObserver`.
- Reduced motion: `behavior: "auto"` on scroll, static color swap on active item.

### Chunk MDN5 (soft, post-additions) — re-evaluate

After the queued owner-data additions ship (spell casts / damage profile / CC time / multikills / rune page), reassess whether the tab grouping still holds and whether Recap needs scrollspy too.

---

## Open decisions

1. **Champion strip + tab bar — single row or two rows.** Single row (tabs to the right of K/D/A) is denser; two thin rows reads cleaner past the hero. Decide in Chunk MDN3 once both elements exist.
2. **All-10 damage stacked bar placement.** Currently slotted into Recap. Alternative: a sub-section of "Your game" alongside the owner damage profile. Lean Recap — it's an all-ten comparison, fits the team-block narrative.
3. **`MatchLanePhase` placement.** Currently slotted into "Your game" (owner-only narrative). Alternative: Timeline (chronological). Lean Your game — the narrative framing is owner-deep, not a chart.
4. **Deep-linkable section anchors.** Defer to v2 unless a concrete use case shows up.
5. **Tab labels.** "Your game" reads slightly clinical — alternatives: "You", "Your read", "Your stats". Decide during Chunk MDN1; not blocking.

---

## Status

- **2026-05-17** — arc scoped, Option A locked, working note written. Promoted to [open-work.md](open-work.md). Not started.

---

## Connections

- [lol-owner-data-features.md](lol-owner-data-features.md) — the queued sections that motivate this arc; every new section there names its target tab here.
- [post-game-close-the-loop.md](post-game-close-the-loop.md) — PG4 peer route, the separate surface this arc explicitly does not duplicate.
- [match-depth-roadmap.md](match-depth-roadmap.md) — Phase E remainders (full rune page, composite S+ grade) land under "Your game" when picked up.
- [section-layout-extraction.md](section-layout-extraction.md) — `SectionShell` primitive whose section-tab-bar slot stays hidden on this route.
- [vnext-ideas.md](vnext-ideas.md) line 235 — sticky per-view controls revert, the precedent for "no fourth sticky layer."
