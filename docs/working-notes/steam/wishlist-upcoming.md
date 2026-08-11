# Steam wishlist — upcoming-releases reframe

**Status:** Original arc (chunks 0–6) complete. **A follow-on arc is in progress as of 2026-08-11** — the Upcoming view was wishlist-sourced, so pre-ordering a game deleted it from the calendar; it now covers owned-but-unreleased titles too and lives on its own `/steam/upcoming` route. Chunks 0–3 are done: **the reported defect is closed** (pre-orders reach the calendar, the imminent hero and the profile chip) and **the route split has landed** (`/steam/wishlist` is the list alone, its tabs retired, `?tab=upcoming` redirected). Chunk 4 (guard + hero-meta) remains and is plumbing rather than the bug. See § Follow-on arc for the data precondition, the naming decision, and the per-chunk decisions. The rest of this note describes the original arc as shipped — note that § Route shape's tab model is superseded by the split.

Chunk 6: the surface is reachable from ⌘K via `parseWishlistQuery()` (`@vyoh/shared`) — `wishlist upcoming`/`wishlist all` route to the two views (the tabs at the time, the two routes since the split), `wishlist <name>` finds a wishlisted game by name and deep-links to its row. See the chunk plan row 6 and [command-palette.md](../cross-cutting/command-palette.md) Phase H. Chunk 5: the `Wishlist` profile `FactCard` now leads with a forward-looking fact via `pickWishlistFact()` ([apps/web/src/steam/wishlist/wishlist-fact.ts](../../../apps/web/src/steam/wishlist/wishlist-fact.ts)) — tier 1 imminent (≤30d, "Next up: {Game}, in {N} days"), tier 2 dated (≤90d, "Coming {Month D}: {Game}"), tier 4 oldest-TBA fallback ("Still waiting on {Game}"), with the count demoted to the quiet top-right indicator and the focal game's key art as evidence. **Tier 3 (cluster signal, "N launches in {Month}") was omitted as unreachable dead code:** a 2026-06-12 gate over the live wishlist measured a max near-month day-precise density of 4 against the ≥5 threshold (and the upper bound, counting every dated item as day-precise, was also 4). A personal-scale wishlist never clusters 5 day-precise releases into one near month, so the branch would be dead code guarded by a test that never exercises the real path. The picker returns null when nothing forward-looking qualifies; the chip then keeps its prior backlog-age framing on the oldest entry. Chunk 0: root cause diagnosed, findings in § Data precondition, open question closed. Chunk 1: precision model shipped — `ReleasePrecision` enum + `classifyReleasePrecision()` in `@vyoh/shared` (computed on read, no DB), tested against the chunk-0 finding set; the diagnosed `format.ts` display bug is fixed (day-precise titles now render their concrete date instead of collapsing to "Coming <year>"). Chunk 2: `/steam/wishlist` is now a tabbed surface (`Upcoming` / `All`) driven by a `?tab=` search param — path unchanged, palette-ready, back-restore preserved. Chunk 3: the `Upcoming` view is real and is now the **default tab** (a no-tab `?appid` deep-link from the profile chip still routes to `All`, where the row highlight lives). Shipped in 4 sub-commits — date-bucketing helpers in `apps/web/src/steam/wishlist/upcoming/bucketing.ts` (Brussels-today vs UTC-civil-release frames, `groupUpcoming`, `pickCalendarAnchor`), the invisible-grid art-forward month calendar with busy-day tint + per-week overload chips + ghosted-past tiles, the quarter/year bands + TBA pool, and the panel composition + calendar/band skeleton. Art direction decided 2026-06-11 (see § Art direction): the imminent hero is a bare chapter with a backdrop lease, not a frosted card; the calendar is an invisible grid with art-forward occupied days. Chunk 4: the imminent hero is real — a bare subject chapter for the nearest day-precise release within 60 days, leasing the page-wide Steam backdrop to the game's hero art, with the days-until count as the lone count-up beat and accent/platforms/ESRB/blurb streamed from an on-read enrichment endpoint (`GET /steam/wishlist/:appid/hero-meta`, projected per request from `getStoreItemsFull` + a Vibrant accent pass because wishlist titles are unowned and carry no enrichment row). The hero is skip-gated; when nothing qualifies the page still leads with the calendar.

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

> The two bullets above are the original plan, and the tab shape they describe is no longer the app's. The follow-on arc split them onto two routes on 2026-08-11 — read the paragraph below, not the plan.

**Superseded 2026-08-11 by the follow-on arc's chunk 3: the tabs are two routes.** The calendar lives at `/steam/upcoming` and `/steam/wishlist` is the list alone; both sit in the Steam tab strip, and `?tab=upcoming` redirects. What the tab shape bought — a stable path, so the section-root scroll reset never fired on a view switch — is genuinely gone, and switching views now resets scroll to top. That is the right behaviour for two layouts that share no vertical structure, and the `?appid` deep-link it was protecting turned out not to depend on it (see § Chunk 3 decisions).

The record of the tab shape, which held from 2026-06-11 to 2026-08-11: a `?tab=upcoming|all` search param validated in the route, with an `isWishlistTab` guard and a manual-activation WAI-ARIA tablist (arrow keys rove focus, Enter/click navigates) in `wishlist-tabs.tsx`, tested for ARIA roles + roving + axe. The row list lives in [`wishlist-all-panel.tsx`](../../../apps/web/src/steam/wishlist/wishlist-all-panel.tsx) and the calendar in [`upcoming-panel.tsx`](../../../apps/web/src/steam/upcoming/upcoming-panel.tsx), neither rewritten by the split — the calendar's whole surface moved out of `steam/wishlist/` to `steam/upcoming/` as a follow-up rename, so the folder tree matches the routes.

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

Per the [one-glass rule](../../repo-conventions-web.md#tile-background-one-level-of-glass-between-background-and-content) and the [compositional chrome rule](../../repo-conventions-web.md#page-composition-chrome-belongs-at-the-lowest-level-that-visually-groups-heterogeneous-content), applied top to bottom:

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
| 6 | ~~**Command palette grammar.**~~ **Done 2026-06-12.** `parseWishlistQuery()` in [packages/shared/src/steam/wishlist-query.ts](../../../packages/shared/src/steam/wishlist-query.ts) — a separate verb (head keyword `wishlist`) parallel to `parsePaletteVerb`/`parseSteamLibraryQuery`: `wishlist upcoming` / `wishlist all` route to `/steam/wishlist?tab=…` (pure navigation, works from any scope), bare `wishlist` offers both tabs, and `wishlist <name>` finds a wishlisted game by name (reads the `["steam","wishlist"]` query cache per the cache-hit-before-fetch invariant) and deep-links to `?tab=all&appid=<id>` where the row highlight lives. The verb folds into `showVerbDestinationsOnly` so it collapses the other groups; `showGlobalLol` was re-scoped to `paletteVerb` so it doesn't leak the Patches entry into wishlist mode. 6 parser unit tests + 6 dialog integration tests; [command-palette.md](../cross-cutting/command-palette.md) chunk list updated (Phase H). | `packages/shared/src/steam/wishlist-query.ts`, `apps/web/src/components/command-palette-dialog.tsx`, tests |

## Follow-on arc: owned-but-unreleased (2026-08-11)

**Problem.** Buying a wishlisted game before it launches deletes it from the wishlist, and the Upcoming view is wishlist-sourced, so the release disappears from the calendar at the moment the owner commits to it. Reported against Mortal Shell II (appid 2584270): pre-ordered, releasing 2026-08-20, invisible. It is not just a missing row — at the time of reporting it was the **nearest** release of any kind (next wishlist item is 2026-08-25), so the imminent hero was showing the wrong game and the genuinely-next launch had no surface at all.

**Data precondition — verified live 2026-08-11 against the owner's account:**

- Pre-purchases stay in `IPlayerService/GetOwnedGames` — Mortal Shell II is present with `playtime_forever: 0`, `rtime_last_played: 0`.
- `IStoreBrowseService/GetItems` still reports it unreleased: `is_coming_soon: true` + `steam_release_date`. That is the same `(releaseDate, comingSoon)` pair `classifyReleasePrecision()` already consumes, so it lands in the `day` tier with no new precision rules.
- The set is tiny and stays tiny: **1 of 195** owned games was coming-soon. This is a merge, not a second pipeline.
- **Upstream omits `is_coming_soon` for released titles** rather than sending `false` (protobuf default; 1 key present across 195 owned apps). So `comingSoon` rests at null, `comingSoon = true` is the only meaningful query, and `IS NULL` can never stand in for "needs refresh" the way `logoPath IS NULL` does.

**Naming.** Owner chose a **two-route split** (2026-08-11): `/steam/upcoming` owns the calendar and is no longer wishlist-only; `/steam/wishlist` keeps the plain list and retires its tabs. The tab pair was always two questions wearing one route — "what's landing?" vs "what do I want?" — and burying the forward-looking surface under a route named for a data source the owner keeps buying out of is the reported bug one level up.

| # | Chunk | Scope |
|---|---|---|
| 0 | ~~**Persist `comingSoon`.**~~ **Done 2026-08-11.** `comingSoon Boolean?` on `SteamGameEnrichment` + `projectEnrichment` carrying `release.is_coming_soon`. Persisted rather than derived from `releaseDate`: a pre-order can be coming-soon with no date at all, and Steam holds the flag past the target date until its launch sweep. Also fixed a latent poller defect (below) and gave coming-soon rows a 1-day refresh age instead of the 30-day one, since announced dates slip right up to launch and the calendar is built on their accuracy. | `apps/api/prisma/schema.prisma` + migration, `apps/api/src/steam/enrichment.{service,poller}.ts`, tests |
| 1 | ~~**`GET /steam/upcoming`.**~~ **Done 2026-08-11.** `SteamUpcomingItem` / `SteamUpcoming` in [`packages/shared/src/steam/upcoming.ts`](../../../packages/shared/src/steam/upcoming.ts) carrying `source: "wishlist" \| "owned"`; the merge lives in a new `SteamUpcomingService` rather than on `SteamService`, since it spans the wishlist TTL cache and Prisma and chunk 4's membership guard wants the same seam. Wishlist side filters to `comingSoon`, owned side reads coming-soon enrichment rows narrowed to `removedAt: null` library rows, owned wins on collision. Field names mirror `SteamWishlistItem` so `classifyReleasePrecision` and the chunk-2 renderers take either item unchanged — pinned by a shared test. | `packages/shared/src/steam/upcoming.ts`, `apps/api/src/steam/upcoming.service.ts`, `steam.{controller,module}.ts`, tests |
| 2 | ~~**Upcoming panel on the merged shape.**~~ **Done 2026-08-11.** `useSteamUpcoming` in [`apps/web/src/steam/use-upcoming.ts`](../../../apps/web/src/steam/use-upcoming.ts); bucketing / calendar / bands / TBA pool retyped to `SteamUpcomingItem`; provenance via `isPreOrdered()` + [`pre-ordered-mark.tsx`](../../../apps/web/src/steam/upcoming/pre-ordered-mark.tsx) (pill over capsule art, inline note on the TBA chips, both inside the accessible name); imminent hero's eyebrow reads "Next up — already yours" for a pre-order. Route loader now primes both queries. **The profile chip was the same bug and is fixed here too** (below). **The reported defect is closed as of this chunk** — Mortal Shell II reaches the calendar and the hero. | `apps/web/src/steam/use-upcoming.ts`, `wishlist/upcoming/*`, `wishlist-chip.tsx`, `routes/steam/wishlist.tsx`, tests |
| 3 | ~~**Route split.**~~ **Done 2026-08-11.** [`routes/steam/upcoming.tsx`](../../../apps/web/src/routes/steam/upcoming.tsx) owns the calendar and primes only `/steam/upcoming`; `/steam/wishlist` is the list alone, its tablist deleted. Legacy `?tab=upcoming` forwards via `beforeLoad` + `redirect({ replace: true })`; `?tab=all` is dropped in `validateSearch` because it already named this route. `upcoming` joins the tab strip after Wishlist (`STEAM_TAB_SEGMENTS`, `CalendarClock`), the sitemap, and the palette — `parseWishlistQuery` now resolves a `target` and takes `upcoming` as a head keyword, with both pre-split phrasings still landing. The chip's fact links to the timeline for either provenance. | `routes/steam/{upcoming,wishlist}.tsx`, `steam/tabs.ts`, `routes/steam.tsx`, `packages/shared/src/steam/wishlist-query.ts`, `command-palette-dialog.tsx`, `lib/sitemap.ts`, `tools/perf-probe/src/scenarios.ts`, tests |
| 4 | **Guard + hero-meta.** `isWishlisted()` → membership in the upcoming set (still a closed appid set, so the attacker-supplied-appid guard holds); owned titles read their existing enrichment row instead of the per-request Vibrant projection. | `apps/api/src/steam/{steam,wishlist-hero}.service.ts`, tests |

### Chunk 1 decisions

- **A wishlist upstream failure fails the whole route** rather than degrading to owned-only. Steam going down would leave the calendar empty even though the pre-orders come from our own DB, which is the worse-looking failure — but a silently partial calendar on a surface whose entire job is "don't lose track of a release" is the worse *actual* one, and `/steam/wishlist` already propagates. Revisit alongside a payload-level partial flag if the wishlist call ever proves flaky; don't add the degradation without a UI indicator.
- **`dateAdded` for owned titles is `SteamOwnedGame.firstSeenAt`.** There is no purchase timestamp in `GetOwnedGames`, and the daily sync sees a new title within a day, so first sighting is the pre-order date to within that day. It exists only to order the TBA pile, which has no release date to sort on — precision beyond a day buys nothing there.
- **Owned TBA pre-orders are handled but unobserved.** Only the dated case exists on the live account (Mortal Shell II), so "owned + coming-soon + no `steam_release_date`" is covered by a unit test and by the decision to persist the flag rather than derive it, not by a live sighting. If a pre-order ever shows up missing from the TBA pool, that's the shape to check first.

### Chunk 2 decisions

- **The profile Wishlist chip carried the same bug, and the retype is what surfaced it.** Its "Next up: {Game}, in {N} days" fact ran through `groupUpcoming` over wishlist items, so a pre-order could never be the release it named — the exact wrong-game failure from the original report, on a second surface. `pickWishlistFact` now takes `SteamUpcomingItem[]` and the chip reads both queries: the wishlist for its count and fallback list (the card is titled Wishlist, and a pre-order is deliberately not one of its games), the upcoming set for the leading fact. The upcoming query's pending/error states are deliberately *not* wired into the card's — the fact is an enhancement and the card is legible without it.
- **A pre-ordered fact links to the Upcoming view, not `?appid`.** `?appid` scrolls the list to a wishlist row and highlights it; a pre-order has no such row, so the existing deep-link would have landed on nothing. Chunk 3 took this further and sent *both* provenances to the timeline — the fact is a release-date claim, and the route it names now exists. This is the one behaviour the router mock in `wishlist-chip.test.tsx` had to grow a `data-search` serialization to assert — `search` is an object and React drops it off a plain `<a>`.
- **`comingSoon` is still checked in `groupUpcoming` even though the endpoint filters on it.** Redundant by construction, kept because it is what makes the tiering total: every branch is reached by precision, and a released row reaching a calendar cell is a worse failure than a wasted comparison.
- **The provenance mark is chrome, not accent.** The calendar cells and bands already carry accent and capsule art, so a per-tile accent colour would compete with the art it sits on. It reads as a neutral pill, and the word — not the check glyph — carries the meaning into the accessible name.

### Chunk 3 decisions

- **The retired `?tab=` param survives validation in exactly one shape.** `validateSearch` keeps `tab` only when it reads `"upcoming"`, which is the one value `beforeLoad` forwards; everything else is dropped, so the route never carries a search key nothing reads. `?tab=all` is deliberately *not* redirected — it named this route's own list, and forwarding it would be a redirect to the current page.
- **`beforeLoad` must be declared above `loader` in the route options object.** TanStack threads the loader's context type through the beforeLoad return constraint, and in the other order the constraint collapses to `never` ("Promise<void> is not assignable to never"). The error names neither the cause nor the fix, hence the comment at the call site.
- **The `?appid` deep-link is undisturbed, and that was checked rather than assumed.** `useScrollResetOnNav` keys on pathname alone and returns early when `prev === pathname`, so search-param-only navigation never reset scroll before the split and still doesn't; the chip's `/steam` → `/steam/wishlist?appid=N` hop reset before and still does, with the panel's rAF `scrollIntoView` landing after. No new skip-pair is needed: the two routes are siblings, not a list↔detail pair. The one real change is that switching between the list and the timeline now resets scroll to top, which is correct for a route change — the two layouts share no vertical structure.
- **The split fixes a skeleton-convention violation for free.** While both views shared a route, its single `pendingComponent` was the row-list skeleton — including on the Upcoming default tab, where six list rows stood in for a calendar. Each route now brings the skeleton that matches its layout, pinned in `route-contracts.test.ts` by asserting the two are not the same component.
- **The perf-probe scenario had to move in the same change.** `wishlist-upcoming` navigated to `/steam/wishlist` and relied on Upcoming being the default tab; left alone it would have measured the row list against the calendar's ≤52-layer budget and read as a large improvement. The handle keeps its name so the baseline stays comparable — same shape as `steam-library` measuring `/steam`.
- **The app now has no `role="tablist"` surface.** Deleting `wishlist-tabs.tsx` took the only one, and it was the exemplar the testing convention pointed at for ARIA tab roles and roving focus. [repo-conventions.md](../../repo-conventions.md) now cites `library-controls.test.tsx` for selected state on a custom control and says outright that a new tablist needs the APG pattern read fresh rather than copied.

### Latent defect found in chunk 0: enrichment poller fired monthly

`SteamEnrichmentPoller` was on `@Cron("30 4 1 * *")` — 04:30 on the 1st — while its own header comment argued explicitly *against* a fire-on-the-1st schedule ("that month is an age rather than a fire on the 1st … a monthly cron is the one where a single miss costs the most") and its batch-cap comment did the arithmetic for a **daily** drain (`~227 candidates / 30 ≈ 8 a day`). The code contradicted its documented intent. Corrected to `30 4 * * *`, which is what both comments and the sibling `achievement-schema.poller.ts` describe.

This mattered beyond hygiene: release dates for unreleased titles slip constantly, so a monthly refresh meant the calendar could show a stale date for up to 30 days — on the one surface whose entire value is date accuracy.

### Operational note: backfill scripts must run from the SWC build

`src/scripts/backfill-steam-enrichment.ts` run under `tsx` fails with every injected dependency `undefined` (`Cannot read properties of undefined (reading 'steamOwnedGame')`, and the same shape from three untouched pollers at boot). Cause is esbuild not emitting `design:paramtypes`, which Nest constructor injection requires — not a defect in the script. Run `pnpm build && node dist/src/scripts/<name>.js` instead. Applies to every `NestFactory.createApplicationContext` script in `src/scripts/`.

A backfill was required here because the poller's due-rule is age-based: without it, existing rows would not have re-pulled for 30 days and the new column would have stayed null. 225/228 rows persisted; 12 coming-soon rows resulted (11 wishlist + 1 owned), matching the live probe exactly.

## Open questions

- **Past-but-still-wishlisted items in the Upcoming view.** ~~Owner to decide before chunk 3.~~ **Decided 2026-06-11:** ghost them — visible but desaturated, "released N days ago". Fits the self-portrait framing ("still unbought" is identity). Chunk 3 implements the "ghosted past" tile recipe.
