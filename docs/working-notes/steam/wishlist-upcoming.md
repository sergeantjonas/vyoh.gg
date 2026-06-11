# Steam wishlist — upcoming-releases reframe

**Status:** Chunks 0–5 complete (chunks 0–4 2026-06-11, chunk 5 2026-06-12). Chunk 5: the `Wishlist` profile `FactCard` now leads with a forward-looking fact via `pickWishlistFact()` ([apps/web/src/steam/wishlist/wishlist-fact.ts](../../../apps/web/src/steam/wishlist/wishlist-fact.ts)) — tier 1 imminent (≤30d, "Next up: {Game}, in {N} days"), tier 2 dated (≤90d, "Coming {Month D}: {Game}"), tier 4 oldest-TBA fallback ("Still waiting on {Game}"), with the count demoted to the quiet top-right indicator and the focal game's key art as evidence. **Tier 3 (cluster signal, "N launches in {Month}") was omitted as unreachable dead code:** a 2026-06-12 gate over the live wishlist measured a max near-month day-precise density of 4 against the ≥5 threshold (and the upper bound, counting every dated item as day-precise, was also 4). A personal-scale wishlist never clusters 5 day-precise releases into one near month, so the branch would be dead code guarded by a test that never exercises the real path. The picker returns null when nothing forward-looking qualifies; the chip then keeps its prior backlog-age framing on the oldest entry. Chunk 0: root cause diagnosed, findings in § Data precondition, open question closed. Chunk 1: precision model shipped — `ReleasePrecision` enum + `classifyReleasePrecision()` in `@vyoh/shared` (computed on read, no DB), tested against the chunk-0 finding set; the diagnosed `format.ts` display bug is fixed (day-precise titles now render their concrete date instead of collapsing to "Coming <year>"). Chunk 2: `/steam/wishlist` is now a tabbed surface (`Upcoming` / `All`) driven by a `?tab=` search param — path unchanged, palette-ready, back-restore preserved. Chunk 3: the `Upcoming` view is real and is now the **default tab** (a no-tab `?appid` deep-link from the profile chip still routes to `All`, where the row highlight lives). Shipped in 4 sub-commits — date-bucketing helpers in `apps/web/src/steam/wishlist/upcoming/bucketing.ts` (Brussels-today vs UTC-civil-release frames, `groupUpcoming`, `pickCalendarAnchor`), the invisible-grid art-forward month calendar with busy-day tint + per-week overload chips + ghosted-past tiles, the quarter/year bands + TBA pool, and the panel composition + calendar/band skeleton. Art direction decided 2026-06-11 (see § Art direction): the imminent hero is a bare chapter with a backdrop lease, not a frosted card; the calendar is an invisible grid with art-forward occupied days. Chunk 4: the imminent hero is real — a bare subject chapter for the nearest day-precise release within 60 days, leasing the page-wide Steam backdrop to the game's hero art, with the days-until count as the lone count-up beat and accent/platforms/ESRB/blurb streamed from an on-read enrichment endpoint (`GET /steam/wishlist/:appid/hero-meta`, projected per request from `getStoreItemsFull` + a Vibrant accent pass because wishlist titles are unowned and carry no enrichment row). The hero is skip-gated; when nothing qualifies the page still leads with the calendar.

Read this when: touching `/steam/wishlist`, the `Wishlist` profile `FactCard`, or any wishlist-shaped data model in [apps/api/src/steam/](../../../apps/api/src/steam/). Read it **before** scoping any other "what's coming up" surface — this convention sets the precision-tier model the rest of the app should reuse.

Related:
- [steam-integration.md](steam-integration.md) — current Steam stack overview.
- [api-surface-survey.md](api-surface-survey.md) — what Steam's wishlist endpoint actually returns.
- [subject-chapter-design-spec.md](../cross-cutting/subject-chapter-design-spec.md) — read before scoping the imminent-hero chunk (chunk 4).
- [command-palette.md](../cross-cutting/command-palette.md) — palette grammar extension lands in chunk 6.

---

## Problem framing

Two problems, same surface:

1. **The current wishlist row list is doing weak editorial work.** It's an alphabetical/recency list of "everything I might buy" — a shape Steam's own UI already does well, with no editorial reason for vyoh to render it.
2. **The owner uses the wishlist as a personal planning tool** for tracking upcoming releases (Q4 is genuinely crowded). The current surface gives zero affordance for "what comes out when" — no temporal sort, no calendar, no overload signal.

The reframe: `/steam/wishlist` becomes an **upcoming-releases editorial** by default, with the row list demoted to a secondary tab. The wishlist *is* the upcoming pipeline; the row list was always the wrong primary.

## Data precondition — chunk 0 findings (2026-06-11)

**Root cause: #3 (precision mislabelled), display-only bug in `format.ts`.** Both hypotheses 1 and 2 were ruled out by live probing:

1. **Cache TTL** — not the cause. The 1h wishlist TTL and 24h name cache are both in-memory only (no DB persistence for release metadata). A fresh `IStoreBrowseService/GetItems` call today returns correct day-precise Unix timestamps for both flagged games. The in-memory nameCache expires regularly; stale cached data isn't the root cause.
2. **Wrong endpoint** — not the cause. `IStoreBrowseService/GetItems` returns `steam_release_date` as a Unix timestamp even when `is_coming_soon=true`. Beast of Reincarnation = `1785776400` (Aug 3, 2026); CONTROL Resonant = `1790258400` (Sep 24, 2026). No `appdetails` enrichment is needed.
3. **Precision mislabelled — confirmed.** `apps/web/src/steam/wishlist/format.ts:formatWishlistReleaseLabel` forces year-only display for ALL `coming_soon=true` items: `Coming ${year}`. The assumption in the comment ("Steam's steam_release_date is usually a placeholder for coming-soon titles") is only partially true — Dec 31 placeholders exist, but specific non-placeholder dates are equally common.

**Locale already pinned.** Both `getStoreItems` and `getStoreItemsFull` already pass `language: "english", country_code: "US"`. No action needed.

**No `appdetails`, no BullMQ fork.** The data is in `IStoreBrowseService/GetItems`. The rate-limit concern does not apply.

**Precision tier detection algorithm** (for chunk 1 to implement):

| Condition | Tier |
|---|---|
| `coming_soon=false` | already released — outside Upcoming scope |
| `coming_soon=true`, `releaseDate=null` | `tba` |
| `coming_soon=true`, `releaseDate` = Dec 31 of year (UTC) | `year` |
| `coming_soon=true`, `releaseDate` = Mar 31 / Jun 30 / Sep 30 (UTC) | `quarter` |
| `coming_soon=true`, `releaseDate` = any other date | `day` |

No `month` tier examples exist in the current 36-item wishlist. If Steam uses first-of-month or last-of-month timestamps for "November 2026" style dates, add a `month` detection rule when a concrete example surfaces. For now, unclassified non-Dec-31 dates fall to `day`. The tier enum in chunk 1 should still include `month` for future completeness.

**Current wishlist snapshot (probed 2026-06-11, 36 items):**

- `day` (7): Beast of Reincarnation (Aug 3, 2026), CONTROL Resonant (Sep 24, 2026), SILENT HILL: Townfall (Sep 24, 2026), The Blood of Dawnwalker (Sep 2, 2026), Onimusha: Way of the Sword (Sep 25, 2026), Phantom Blade Zero (Oct 29, 2026), Tomb Raider: Legacy of Atlantis (Feb 12, 2027)
- `year` (3): ILL (2027), Mortal Shell II (2026), Resident Evil Veronica (2027)
- `tba` (3): Lords of the Fallen II, Tides of Annihilation, 1666: Amsterdam
- already released (23): everything else including 007 First Light (released May 26, 2026)

**Persist vs compute on read: compute on read.** Precision tier is a pure function of `(releaseDate, comingSoon)` — no DB schema change needed. The `SteamWishlistItem` type already carries both fields with the right semantics (see `packages/shared/src/steam/wishlist.ts`).

**Refresh cadence:** Keep the existing 24h name TTL. Date changes (firming up or slipping) propagate within 24h. This is acceptable for a personal upcoming-releases planner.

**Demotion path** (`day` → `tba`): natural. When the nameCache TTL expires and the game is re-fetched, `storeItemToCacheEntry` recomputes from the fresh `steam_release_date`. If Steam has cleared the date, `releaseDate` becomes null and the precision tier demotes to `tba` automatically. No explicit invalidation logic needed.

**Chapter 0 verdict: unblocked.** The editorial design's precision tiers are reachable with the current data pipeline. The only code change is in the precision parser (chunk 1) — the API layer and caching are correct.

## Precision tier model

Wishlist entries fall into tiers by date precision. Each tier wants a different surface shape:

| Tier | Example upstream string | Surface |
|---|---|---|
| `day` | "Nov 13, 2026" | Calendar cell + imminent hero candidate |
| `month` | "November 2026" | Quarter band, sorted by month within |
| `quarter` | "Q4 2026" | Quarter band |
| `year` | "2027" | Year band |
| `tba` | "Coming soon", "TBA", "When it's done" | TBA pool |

Shared type lives in `packages/shared/src/steam/`. **Shipped chunk 1:** `ReleasePrecision` enum + `classifyReleasePrecision(item)` in [`packages/shared/src/steam/wishlist.ts`](../../../packages/shared/src/steam/wishlist.ts) — a pure function of `(releaseDate, comingSoon)`, analysed in UTC, computed on read (no DB persistence; demotion re-derives on the next fetch). Returns `null` for already-released titles. Per-tier date *bucketing* helpers (quarter index, year, calendar day) are deferred to chunk 3 where they're consumed — YAGNI until the calendar/bands exist.

## Route shape

`/steam/wishlist` becomes a tabbed surface. Tabs reachable via command palette per the [extending-the-palette convention](../../repo-conventions.md#extend-the-command-palette-when-adding-filterable-surfaces).

- **Upcoming** (default *end state*) — the editorial composition below.
- **All** — the current row list, unchanged. Browsing affordance for "show me everything wishlisted regardless of date."

Path stays `/steam/wishlist` — no new route, so scroll-restore + section-root reset wiring in [routes/steam.tsx](../../../apps/web/src/routes/steam.tsx) keeps working unchanged.

**Shipped chunk 2.** The tab is a `?tab=upcoming|all` search param (validated in the route; `isWishlistTab` guard + `WishlistTabs` tablist live in [`apps/web/src/steam/wishlist/wishlist-tabs.tsx`](../../../apps/web/src/steam/wishlist/wishlist-tabs.tsx)). Search-param tabs (not sub-routes) keep the path stable, so the section-root `useScrollResetOnNav` — keyed on pathname — does *not* fire on tab switch, and the `?appid` deep-link back-restore is unaffected. The tablist is a manual-activation WAI-ARIA pattern (arrow keys rove focus, Enter/click navigates), tested for ARIA roles + roving + axe. The existing row list moved unchanged into [`wishlist-all-panel.tsx`](../../../apps/web/src/steam/wishlist/wishlist-all-panel.tsx); `Upcoming` renders an honest interim placeholder ([`wishlist-upcoming-panel.tsx`](../../../apps/web/src/steam/wishlist/wishlist-upcoming-panel.tsx)) until chunk 3. **The default-tab is `all` until chunk 3** (see Status header) — chunk 3 flips it to `upcoming` in the same change that makes the Upcoming view real.

## Art direction

Decided 2026-06-11, before chunk 3, so the calendar doesn't ship as the one dashboard-shaped surface on an otherwise editorial site.

The page's organizing visual idea: **temporal certainty maps to visual prominence.** The more precisely dated a release, the larger and more art-directed its treatment — day-precise gets the chapter hero, month/quarter get capsule rows, year gets a compact grid, TBA gets the smallest, most typographic tier. The page reads as a gradient from "cover story" down to "the watching pile", not as five stacked widgets.

### Hero is a chapter, not a card

An earlier draft prescribed "full-bleed style, frosted recipe" — that contradicts the subject-chapter spec's most load-bearing rule (*bare wrapper, no card chrome, typographic statement does the work*). Resolved in favour of the chapter treatment:

- **Bare wrapper.** No `rounded border bg-card/*` around the hero. Children sit on the art directly.
- **Backdrop lease.** The hero leases the page backdrop via `useRefCountedClaim` (see [[project_backdrop_primitives]]), swapping the Steam profile backdrop for the game's SGDB hero art while the hero is in view. This is the graphically strongest option and reuses the most mature machinery in the app — the page gets a cover story, not a wide tile.
- **Accent** from the game's `dominantHex` (already in the pipeline). Accent-tinted text uses `paint-order: stroke` + the shadow tiers per the [subject-chapter spec](../cross-cutting/subject-chapter-design-spec.md) — that spec's typography/color/cascade sections apply wholesale.
- **Days-until is the masthead number** — `CountUp` gated on visibility, the chapter's single count-up beat.

### Calendar: invisible grid, art-forward days

The calendar is the surface most at risk of reading as dashboard vocabulary. A bordered lattice of boxes fails the chapter spec's "count visible card borders" test 60 times over. Rules:

- **Empty cells are nearly invisible** — a faint day numeral on the page background. No borders, no boxes. Hairline week-row separators or pure whitespace do the structure.
- **Occupied days are art-forward.** Steam capsule art (231×87) is the thumbnail shape — instantly recognizable, releases read as the figure, the grid as ground. Title via `TooltipPrimitive` on hover per convention.
- **Month header is an editorial masthead**, not a toolbar label. The eyebrow + masthead baseline-row pattern from the chapter spec transfers directly: large month name with `JUNE · 4 LAUNCHES` in tracked uppercase on the same baseline row. This single typographic move keeps the calendar in the chapters' register.
- **Busy-day tint is a neutral alpha lift** (`bg-foreground/5`-ish), NOT a hue. The accent token belongs to the hero's game on this page; the chapter spec's "no further semantic color subdivision" rule applies.
- **Today marker: restrained** — a ring or underline on the numeral, not a filled cell.

### Band size ramp

- **Quarter bands** — horizontal capsule rows, each band headed by a `SectionTitle`-tier divider carrying a density chip ("Q4 2026 · 11 titles"). The density chip is load-bearing: it keeps the crowding story visible during the ~8 months of the year when the crowded quarter isn't inside the calendar window.
- **Year bands** — smaller capsule grid.
- **TBA pool** — smallest tier, text-first chips rather than art. "The watching pile" reads well as typography.

### Glass and chrome assignment

Per the [one-glass rule](../../repo-conventions.md#tile-background-one-level-of-glass-between-background-and-content) and the [compositional chrome rule](../../repo-conventions.md#page-composition-chrome-belongs-at-the-lowest-level-that-visually-groups-heterogeneous-content), applied top to bottom:

| Surface | Treatment |
|---|---|
| Hero | Bare (chapter rules — no chrome, backdrop lease) |
| Calendar wrapper | Frosted (`bg-card/60 backdrop-blur-sm`) — its children are bare inline cells, so the wrapper carries the chrome |
| Day cells / capsule tiles inside calendar | Bare — inside the frosted wrapper, one glass crossing only |
| Quarter/year band wrappers | Bare `<section>` + `SectionTitle` — children carry their own visual weight |
| Capsule tiles in bands | Opaque art with `rounded border` + dark hover (`hover:bg-black/25` per chapter spec); no frosting — they're images, not glass candidates |
| TBA chips | Frosted compact chips — bare text directly over the Steam backdrop needs the glass |

### Motion beats

Cascade top → bottom; don't bunch tweens (chapter-spec rejected-experiment: 15 simultaneous count-ups reads as chaos).

1. Hero reveal cascade (eyebrow → masthead → meta), days-until count-up after the masthead settles — the page's only count-up.
2. Calendar tiles stagger in on a short per-tile delay.
3. Band tiles static — secondary strips don't animate.

## Upcoming view composition

Top to bottom:

### 1. Imminent hero

Single subject-chapter treatment of the nearest `day`-precise release. Uses the game's hero art (SGDB fallback chain already covers this — see [[project_steamgriddb_fallback]]), days-until as the editorial headline number, platform pills, ESRB chip, short description, per-game accent color. Visual treatment per § Art direction: bare chapter with backdrop lease, not a frosted card.

**Days-until uses `Europe/Brussels` day boundaries**, not UTC — an off-by-one on the headline number is the most visible possible bug on this page.

**Skipped entirely** if nothing day-precise is within ~60 days — the page leads with the calendar instead. No degraded placeholder.

### 2. Month calendar

Primary tool surface. Two-month window by default (current + next), prev/next month navigation. Visual language per § Art direction: invisible grid, art-forward occupied days, masthead month headers.

- Each day-cell can hold multiple releases as small capsule tiles.
- Days with 3+ releases get the neutral "busy day" alpha lift.
- Today is highlighted (restrained marker).
- Per-week gutter chip: "3 launches this week" when ≥3. The overload signal — visualises the Q4 crowding instead of just laying it out.
- Past-but-still-wishlisted releases: see open question at the bottom.

**Sparse-state rule** (symmetric with the hero's skip rule — no degraded placeholder): a month with zero dated releases is not rendered as an empty grid. If the default two-month window holds fewer than 2 dated items, collapse the calendar to the nearest month that has any and let the quarter bands lead the remaining vertical space. The overload features (busy-day tint, week chips) are seasonal by design — they earn their place in crowded months and must cost nothing visually in quiet ones.

No virtualisation — bounded to ~60 day-cells per render, per the [virtualize-only-when-N-exceeds-100 convention](../../repo-conventions.md#virtualize-only-when-the-list-can-exceed-100-items-and-grows-via-paged-loading).

### 3. Quarter bands

Month- and quarter-precise items beyond the calendar window. One band per quarter ("Q4 2026", "Q1 2027"), games as a denser horizontal row of capsule tiles, each band header carrying its density chip ("· 11 titles"). Bands sorted chronologically. `month`-precision items sort within their quarter band by month.

### 4. Year bands

`year`-precision items grouped by year ("2027", "2028"), compact capsule grid.

### 5. TBA pool

`tba`-precision items. Smallest tier, text-first frosted chips; visually the "watching this" pile. No temporal sort — alphabetical or recency, decide in chunk 3.

## Profile tile reframe

The current `Wishlist` `FactCard` on the Steam profile swaps the count for a single forward-looking fact, picked in this order:

1. Day-precise release within 30 days → "Next up: {Game}, in {N} days" + key art.
2. Day-precise release within 90 days → same, framed as "Coming {Month D}".
3. ~~Cluster signal → "8 launches in October" if a near month is dense (≥5 day-precise items).~~ **Omitted (chunk 5, 2026-06-12) — unreachable dead code.** The 2026-06-12 data gate measured a max near-month day-precise density of 4 against the ≥5 threshold (upper-bound count also 4). A personal-scale wishlist never clusters 5 day-precise releases into one near month, so this branch would be dead code guarded by a test that never exercises the real path. Re-add only if a real dataset ever crosses the threshold.
4. Fallback → oldest TBA item framed as "Still waiting on {Game}". A real piece of identity, not a count.

Tile links into `/steam/wishlist` (which is now the upcoming view by default).

Matches the pattern other Steam profile chips already follow (Trophy Case, Most Played, etc. — each carries one editorial fact, not a count).

## Chunk plan

Each chunk is independently committable and fits in one context window. Chunk 0 gates the rest; if it surfaces an irrecoverable data limitation, chunks 3–4 still work but bands degrade to coarser-than-designed.

| # | Chunk | Scope |
|---|---|---|
| 0 | ~~**Diagnose wishlist date freshness.**~~ **Done 2026-06-11.** Root cause: precision mislabelled in `format.ts` (display-only). API data is correct; no `appdetails` enrichment; no BullMQ fork; locale already pinned; compute-on-read. Full findings in § Data precondition. | `apps/api/src/steam/*` (read-only), `curl` probes |
| 1 | ~~**Precision tier model.**~~ **Done 2026-06-11.** `ReleasePrecision = 'day' \| 'month' \| 'quarter' \| 'year' \| 'tba'` + `classifyReleasePrecision()` in `@vyoh/shared`, computed on read (no DB / no API change — chunk 0 confirmed the data is already correct). `format.ts` display bug fixed in the same change. Tests in `wishlist.test.ts` cover the chunk-0 finding set. `month` tier reserved (no placeholder example yet); date-bucketing helpers deferred to chunk 3. | `packages/shared/src/steam/`, `apps/web/src/steam/wishlist/format.ts`, tests |
| 2 | ~~**Route shape + tab scaffolding.**~~ **Done 2026-06-11.** `/steam/wishlist` is tabbed via `?tab=` search param (path unchanged → scroll/back-restore intact). Row list moved to `wishlist-all-panel.tsx`; `Upcoming` is an interim placeholder. **Default stays `all` until chunk 3** (no placeholder-as-default on a live surface); chunk 3 flips it. ARIA tablist (manual activation) tested + axe-scanned. Palette grammar entries deferred to chunk 6 (the dedicated palette chunk). | `apps/web/src/routes/steam/wishlist.tsx`, `apps/web/src/steam/wishlist/wishlist-{tabs,all-panel,upcoming-panel}.tsx`, tests |
| 3 | ~~**Calendar + quarter bands + year bands + TBA pool.**~~ **Done 2026-06-11.** All four surfaces shipped in `apps/web/src/steam/wishlist/upcoming/` per § Art direction (invisible grid, art-forward capsule tiles via shared `WishlistCapsule`, masthead month headers, glass assignment table). Per-week overload chips + quarter/year density chips (shared `BandHeader`). Sparse-state handled by `pickCalendarAnchor` (shifts the window to the nearest month with day-releases; calendar omitted entirely when there are none). Ghosted-past tiles via the `isPast`/`ghost` path (open-question decision). Calendar/band-mirroring `UpcomingSkeleton`. Bucketing uses Brussels-today vs UTC-civil-release frames; tests cover bucketing, anchor/sparse selection, calendar rendering (busy/today/week-chip/ghost/nav), bands, and panel states. **Default tab flipped to `upcoming`** in the same chunk. `month`-tier still reserved (no upstream example). | `apps/web/src/steam/wishlist/upcoming/`, tests for date-bucketing logic |
| 4 | ~~**Imminent hero.**~~ **Done 2026-06-11.** Bare subject-chapter for the nearest day-precise release within 60 days (`pickImminentRelease`), leasing the page-wide Steam backdrop via `useSteamGameBackdrop`, accent + shadow tiers + `paint-order: stroke` per the subject-chapter spec, days-until as the lone count-up beat. **Owner chose full api+web enrichment** (vs a web-only neutral-accent hero): the wishlist payload carries no accent/platforms/ESRB/blurb, and the candidates are unowned (no enrichment row), so a new `GET /steam/wishlist/:appid/hero-meta` endpoint projects them per request from `getStoreItemsFull` + a Vibrant accent pass over the resolved hero art, TTL-cached (`SteamWishlistHeroService`). Hero streams the enriched chrome in over the item-derived name + days-until, so it's legible on first paint. Skip-gated (no candidate → calendar leads). **Perf-probe:** `wishlist-upcoming` scenario added + baselined (46 layers / ~90 ms / 0 dropped / 1 long task); budget row recorded in [repo-conventions.md](../../repo-conventions.md). | `apps/api/src/steam/wishlist-hero.service.ts`, `packages/shared/src/steam/wishlist.ts`, `apps/web/src/steam/wishlist/upcoming/{imminent-hero,use-wishlist-hero-meta}.tsx`, `tools/perf-probe`, tests |
| 5 | ~~**Profile tile reframe.**~~ **Done 2026-06-12.** `pickWishlistFact()` in [apps/web/src/steam/wishlist/wishlist-fact.ts](../../../apps/web/src/steam/wishlist/wishlist-fact.ts) (reuses `groupUpcoming` buckets) drives the `Wishlist` chip's verdict: tier 1 imminent (≤30d) / tier 2 dated (≤90d) / tier 4 oldest-TBA fallback, formatted by `formatWishlistFact()` in `format.ts`; the chip (`apps/web/src/steam/wishlist-chip.tsx`, **not** a `profile/` path) keeps the count as the indicator and shows the focal game's key art, falling back to the prior oldest-entry framing when the picker returns null. **Tier 3 omitted as unreachable dead code** — the 2026-06-12 data gate measured max near-month density 4 vs the ≥5 threshold. Tests cover every tier + the null fallback + the cluster-omission guard. | `apps/web/src/steam/wishlist-chip.tsx`, `apps/web/src/steam/wishlist/{wishlist-fact,format}.ts`, tests |
| 6 | **Command palette grammar.** Add `wishlist upcoming`, `wishlist all`, "find wishlisted game by name" grammar so the surface is reachable from ⌘K. Update [command-palette.md](../cross-cutting/command-palette.md) chunk list. | shared palette grammar, palette UI |

## Open questions

- **Past-but-still-wishlisted items in the Upcoming view.** ~~Owner to decide before chunk 3.~~ **Decided 2026-06-11:** ghost them — visible but desaturated, "released N days ago". Fits the self-portrait framing ("still unbought" is identity). Chunk 3 implements the "ghosted past" tile recipe.
