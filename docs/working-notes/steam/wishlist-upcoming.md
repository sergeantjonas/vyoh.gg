# Steam wishlist — upcoming-releases reframe

**Status:** Chunk 0 complete (2026-06-11). Root cause diagnosed, findings written in § Data precondition, open question closed. Chunk 1 is unblocked. Art direction decided 2026-06-11 (see § Art direction): the imminent hero is a bare chapter with a backdrop lease, not a frosted card; the calendar is an invisible grid with art-forward occupied days.

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

Shared type lives in `packages/shared/src/steam/`. Parser converts the upstream string into `(precision, parsedDate?)`. Persisted or computed on read — decided in chunk 0 based on the freshness investigation.

## Route shape

`/steam/wishlist` becomes a tabbed surface. Tabs reachable via command palette per the [extending-the-palette convention](../../repo-conventions.md#extend-the-command-palette-when-adding-filterable-surfaces).

- **Upcoming** (default) — the editorial composition below.
- **All** — the current row list, unchanged. Browsing affordance for "show me everything wishlisted regardless of date."

Path stays `/steam/wishlist` — no new route, so scroll-restore + section-root reset wiring in [routes/steam.tsx](../../../apps/web/src/routes/steam.tsx) keeps working unchanged.

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
3. Cluster signal → "8 launches in October" if a near month is dense (≥5 day-precise items). **Verify the threshold is reachable with real post-chunk-0 data before building this branch** — given current staleness, ≥5 day-precise items in one month may never fire, and an unreachable tier is dead code with a test.
4. Fallback → oldest TBA item framed as "Still waiting on {Game}". A real piece of identity, not a count.

Tile links into `/steam/wishlist` (which is now the upcoming view by default).

Matches the pattern other Steam profile chips already follow (Trophy Case, Most Played, etc. — each carries one editorial fact, not a count).

## Chunk plan

Each chunk is independently committable and fits in one context window. Chunk 0 gates the rest; if it surfaces an irrecoverable data limitation, chunks 3–4 still work but bands degrade to coarser-than-designed.

| # | Chunk | Scope |
|---|---|---|
| 0 | ~~**Diagnose wishlist date freshness.**~~ **Done 2026-06-11.** Root cause: precision mislabelled in `format.ts` (display-only). API data is correct; no `appdetails` enrichment; no BullMQ fork; locale already pinned; compute-on-read. Full findings in § Data precondition. | `apps/api/src/steam/*` (read-only), `curl` probes |
| 1 | **Precision tier model.** Define `WishlistEntry.releasePrecision: 'day' \| 'month' \| 'quarter' \| 'year' \| 'tba'` in `@vyoh/shared` and the corresponding parsed date fields. Implement the parser (locale pinned per chunk 0). Persist or compute on read per chunk 0's decision; demotion invalidates stale parsed dates. Tests against the chunk-0 finding set. | `packages/shared/src/steam/`, `apps/api/src/steam/wishlist*`, tests |
| 2 | **Route shape + tab scaffolding.** Reframe `/steam/wishlist` to a tabbed layout (`Upcoming` default, `All` secondary). Move existing row list under `All`. Both tabs render placeholders for chunk 3. Verify scroll-restore + back-restore still work. | `apps/web/src/routes/steam/wishlist*`, palette grammar entries for `wishlist upcoming` / `wishlist all` |
| 3 | **Calendar + quarter bands + year bands + TBA pool.** Build the month calendar, quarter bands, year bands, TBA pool per § Art direction (invisible grid, capsule tiles, masthead month headers, glass assignment table). Per-week overload chips + quarter density chips. Sparse-state rule for quiet months. Skeleton mirroring the calendar/band layout in the same change (per the [skeleton convention](../../repo-conventions.md#skeleton-loaders-must-mirror-the-layout-they-replace) — a calendar skeleton is nontrivial, budget for it). Date-bucketing logic uses `Europe/Brussels` day boundaries; tests cover bucketing + sparse states. | `apps/web/src/steam/wishlist/upcoming/`, tests for date-bucketing logic |
| 4 | **Imminent hero.** Bare-chapter treatment for the nearest day-precise release per § Art direction: backdrop lease via `useRefCountedClaim`, accent + shadow tiers + `paint-order: stroke`, days-until count-up as the single animated beat. Read [subject-chapter-design-spec.md](../cross-cutting/subject-chapter-design-spec.md) before scoping the visual vocabulary. **Perf-probe gate:** `/steam/wishlist` isn't a baselined scenario — add one and record a budget row in [repo-conventions.md](../../repo-conventions.md) once chunks 3+4 have landed their layer-promoting CSS (frosted calendar wrapper, backdrop lease, Motion entrances). | `apps/web/src/steam/wishlist/upcoming/imminent-hero.tsx`, tests, `tools/perf-probe` scenario |
| 5 | **Profile tile reframe.** Replace count with forward-looking fact picker. Verify tier-3's ≥5 threshold is reachable with real data first (see § Profile tile reframe). Tests for each tier's fallback path. | `apps/web/src/steam/profile/wishlist-fact-card.tsx` (or equivalent — confirm exact path in chunk 2), tests |
| 6 | **Command palette grammar.** Add `wishlist upcoming`, `wishlist all`, "find wishlisted game by name" grammar so the surface is reachable from ⌘K. Update [command-palette.md](../cross-cutting/command-palette.md) chunk list. | shared palette grammar, palette UI |

## Open questions

- **Past-but-still-wishlisted items in the Upcoming view.** ~~Owner to decide before chunk 3.~~ **Decided 2026-06-11:** ghost them — visible but desaturated, "released N days ago". Fits the self-portrait framing ("still unbought" is identity). Chunk 3 implements the "ghosted past" tile recipe.
