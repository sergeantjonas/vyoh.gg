# Test coverage expansion — 2026-05-18

**Status:** Shipped — chunked plan for broadening test coverage across `packages/shared`, `apps/api`, and `apps/web` after the 2026-05-18 hygiene sweep landed T3–T5. C1 (instrumentation), S1 (scaffold), S2 (formatters), S3 (rank-history) shipped 2026-05-18; A1 (api img + remake boundary), W1 (web Steam), W2 (recap patch-verdict + top-insight), W3 (home chronotype) all shipped 2026-05-19. Shared at 100% line coverage; web grew from 100 → 127 tests (+27) across 14 → 20 files. S4 dropped (types-only); `orb-mark` skipped from W3 (pure animation chrome, no interactive state). API tests 386 → 415. Note can move to [archive/](../archive/) once acknowledged.

Follow-up to [project-hygiene-2026-05-18.md](./project-hygiene-2026-05-18.md), which closed the first wave of web component tests (T3 command palette + match-detail tab nav, T4 scroll restoration + splash provider, T5 jest-axe). Those addressed *highest-risk web surfaces*; this note scopes the broader push, including the structural gap the hygiene note didn't size: **`packages/shared` has zero tests**.

## Current state (file-level, 2026-05-18)

Post-S3 (2026-05-18). Coverage tooling installed (`@vitest/coverage-v8` in shared, api, web; v8 provider; `text-summary` reporter; `lines: 0` stub threshold). Root script `coverage:cc` runs all three packages.

| Package | Tests | Test files | Lines coverage | Functions coverage |
|---|---|---|---|---|
| `apps/api` | 386 | 46 | 54.33% (1612/2967) | 46.84% (290/619) |
| `apps/web` | 100 | 14 | 9.89% (578/5842) | 9.63% (165/1712) |
| `packages/shared` | 88 | 4 | 100% (150/150) | 100% (14/14) |

Pre-C1 baseline (file-level co-location, kept for reference): `apps/api` 46 test files / 93 sources (~50%); `apps/web` 12 / 264 (~4.5%); `packages/shared` 0 / 35 (1,218 LOC).

**Key observation:** the shared package hosts the domain primitives that both apps consume (`excludeRemakes`, formatters, chronotype derivers, aggregation helpers). A single bug in shared corrupts api stats *and* web display simultaneously — yet it has no safety net. This is the highest-leverage gap in the repo, not web breadth.

### Web sub-breakdown

| Area | Tests / Sources | Notes |
|---|---|---|
| `lol/_shared` | 2 / 30 | splash-backdrop, patch-version covered |
| `lol/matches` | 3 / 26 | match-list, use-matches, tab-nav |
| `lol/champions` | 2 / 16 | champion-pool-drift, champion-stats |
| `lol/trends` | 1 / 26 | trend-stats |
| `lol/profile` | 1 / 22 | detect-seasons |
| `lol/recap` | 0 / 7 | |
| `lol/patches` | 0 / 7 | |
| `steam/` | **0 / 43** | entire vertical untested |
| `home/` | 0 / 16 | derive logic lives in shared |
| `components/` | 2 / 28 | command-palette, accessibility |
| `routes/` | 0 / 26 | TanStack shells — low value |

### API sub-breakdown

Solid co-location across home, lol, steam, riot, identity, og, status. Untested directories with substance:

- [apps/api/src/img/](../../../apps/api/src/img/) — 6 files, 0 tests. `lol-image.service.ts`, `steam-image.service.ts`, `upstream.ts`, `img-prewarm.service.ts`.
- [apps/api/src/scripts/](../../../apps/api/src/scripts/) — 8 backfill scripts, 0 tests. One-shot ops; mostly skip, but `backfill-remake-flag.ts` encodes the 210s remake-vs-inting-surrender threshold called out in CLAUDE.md as load-bearing.

## Chunked plan (2026-05-18)

Leverage-first ordering: shared first (one fix protects api + web), then api gaps, then web breadth. Coverage instrumentation lands first so every subsequent chunk has measurable signal.

### C1 — Coverage instrumentation (shipped 2026-05-18)

Added `@vitest/coverage-v8` as a devDep in `apps/api`, `apps/web`, and `packages/shared`. Configured `coverage.provider = 'v8'` with `reporter: ['text-summary']` and `thresholds: { lines: 0 }` in each `vitest.config.ts` / `vite.config.ts`. Added `coverage:cc` script at the workspace root: `pnpm -r test --coverage 2>&1 | head -400`. Baseline captured in **Current state** above. v8 coverage works under happy-dom (web reports cleanly; pre-existing happy-dom `AbortError` teardown noise unrelated to coverage).

### S1 — `packages/shared` test setup (shipped 2026-05-18)

Already partially in place pre-chunk (`vitest` devDep + `test` script + `vitest.config.ts` + an existing `match-query.test.ts`). This chunk filled the gaps: added `test:watch` script to `packages/shared/package.json` and an `excludeRemakes` test in `packages/shared/src/lol/exclude-remakes.test.ts` (5 cases: empty, all-remakes, none, mixed, subtype-preservation). Runner is proven; shared has 50 passing tests across 2 files.

### S2 — Shared invariants + formatters (shipped 2026-05-18)

Scope reduced from the original plan: `lol/exclude-remakes.ts` was already covered in S1, and both `lol/chronotype.ts` + `steam/chronotype.ts` are types-only (no runtime logic — derivers live in `apps/api`, not shared). S2 collapsed to `format.ts` only.

Added `packages/shared/src/format.test.ts` covering all 5 formatters with 20 cases:

- `formatDuration` — zero, single-digit pad, 59m59s boundary, no-rollover-at-60min, 24h+.
- `formatGameTime` — zero, mid-game typical, 59:59 boundary, no-rollover-at-60min, sub-second floor.
- `formatGold` — sub-1000 'g' suffix at 0/800/999, 1000 → "1.0k", typical k-range.
- `formatPlaytime` — sub-60min 'm' suffix, 60/89/90 rounding boundary, en-US thousands separator past 1000h.
- `formatHoursMinutes` — 0 and negative early-return, minutes-only, hour-boundary "Xh" form, combined "Xh Ym" form.

Shared coverage moved 56% → 67.3% lines, 36% → 71% functions. 70 tests across 3 files.

### S3 — Shared rank-history (shipped 2026-05-18)

Scope collapsed substantially from the original plan, both for S3 and S4. **All five `packages/shared/src/home/` files are types-only** (response shape declarations — the actual derivers live in `apps/api`, where they already have spec coverage). **All four S4 LoL files except `rank-history.ts` are types-only too** (`patch-changes.ts`, `match-detail.ts`, `live-game.ts`), and **all three S4 Steam files are types-only** (`achievements.ts`, `owned-games.ts`, `summary.ts`).

The original audit overstated `packages/shared` runtime — the package is mostly a contracts package, with runtime concentrated in `format.ts`, `lol/exclude-remakes.ts`, `lol/match-query.ts`, and `lol/rank-history.ts`. The first three were covered in S1+S2 (or pre-existed); the fourth shipped here.

Added `packages/shared/src/lol/rank-history.test.ts` covering all 3 runtime exports with 18 cases:

- `normalizeLp` — IRON IV anchor at 0, +100 per division, DIAMOND I at 2700, MASTER+ drops the rank offset, mixed-case input normalisation, unknown-tier fallback, ignored rank for MASTER+.
- `formatRank` — sub-MASTER includes division, MASTER+ omits it (Master/Grandmaster/Challenger), mixed-case normalisation, unknown-tier passthrough.
- `detectSeasons` — empty input, single-point ongoing season, continuous-play peak identification, split detection on large LP drop + >=7d gap, no-split on small drop with long gap, no-split on large drop with short gap (intra-season tilt), multi-season sequence with only last marked ongoing.

Shared coverage moved 67.3% → 100% lines, 71% → 100% functions. 88 tests across 4 files. **`packages/shared` is now fully covered.** No remaining shared-package work in the test-coverage arc — S4 dropped. Threshold tightening (e.g. `lines: 95` in shared `vitest.config.ts`) is a follow-up edit when convenient.

### A1 — API `img/` services + remake-threshold predicate (shipped 2026-05-19)

Added three new specs covering the testable surface of `apps/api/src/img/`:

- `upstream.spec.ts` — `fetchUpstream` (2xx → Buffer, non-2xx → `UpstreamError` with status, network reject → `UpstreamError` preserving cause), `fetchUpstreamChain` (first-wins, fallback-on-404, last-error-when-all-fail). 6 cases. Skips `transcodeToWebp` — requires real image bytes + sharp; not productive to mock.
- `lol-image.service.spec.ts` — `champion` for all 3 variants (square/card/backdrop URL + params + blur), `Strawberry_` Swarm-alias stripping, `item` (DDragon URL pinned to patch), `roleIconUrl`, `rune` + `spell` (CDragon `iconPath` lookup happy + unknown-id throws). 10 cases.
- `steam-image.service.spec.ts` — `composeAssetUrls` chain via the 4 enrichment-backed methods: `capsule` (legacy-only vs hashed+legacy with `?t=` cache-buster), `libraryCapsule` (300px portrait), `hero` (1280px), `logo` (never emits `?t=` because it passes `null` for timestamp), `backdrop` (cross-host fallback chain to `storepagebackground`, with `?t=` on both URLs when timestamp present), `achievement` + `achievementGray` (happy path + `NotFoundException` when row missing). 12 cases.

Added one boundary case to the existing `match-mapper.spec.ts`: exact-210s with `gameEndedInEarlySurrender: true` → NOT a remake. The predicate is `< 210` (strict), so 210s on the dot is a Season 2 2026 inting-surrender, not a remake. Picks up the CLAUDE.md "load-bearing threshold" call-out without extracting the literal — the existing 180s/900s tests already cover both sides; this just nails the inflection point.

Deferred: `img-prewarm.service.ts` is a boot-time loop with timers, env-flag gating, two upstream JSON fetches, and HTTP self-calls. Testing it would need fake timers, env-stubbing, two fetch mocks, and a stubbed Nest HTTP context — low ROI for a service whose value is mostly configurational (which routes to walk). Revisit only if a behavior change introduces real risk (e.g. retry logic, dedup).

API tests: 386 → 415 (+29). Validate with `pnpm verify:cc`.

### W1 — Web Steam vertical (shipped 2026-05-19)

Three new specs covering the most interactive Steam-game surfaces (all colocated under `apps/web/src/steam/game/`):

- `achievement-panel.test.tsx` — 6 cases: schema-less returns null, in-flight schema renders placeholder, ratio + row rendering, `PREVIEW_COUNT` truncation + "Show N more" expand, "Locked only" toggle hides unlocked + masks hidden-locked with `???`, search input visibility threshold (≥30 achievements) + `displayName` filter.
- `game-unlock-timeline.test.tsx` — 4 cases: returns null while pending, returns null on empty months, singular/plural footer copy, `MIN_BARS` padding (3 real months → 12 rendered bars with leading zero buckets backfilled).
- `last-progressed-card.test.tsx` — 6 cases covering 4 verdict branches in `computeVerdict` (100% complete, Stuck at X/Y, Launching but not progressing, schema-less last-launched) plus two early-return cases (game not in owned list, no timestamps at all). Uses `vi.useFakeTimers()` + `setSystemTime` to anchor "now" so `relativeTimeAgo` / `compactAgo` are deterministic.

Pattern: `vi.mock` each fetch-hook directly (`./use-game-achievements`, `./use-game-unlock-timeline`, `@/steam/use-owned-games`), bypass `QueryClient` entirely. `TooltipPrimitive.Provider` wraps the trees that use Radix tooltips; `MotionConfig reducedMotion="always"` for the card that wraps in `CardShell` (motion/react).

`computeVerdict` was *not* exported for testing — branchy logic verified through the component as rendered text. Trade-off: heavier setup (two hooks + fake timers) than a pure-function unit test, but no source modification, and the assertions track user-visible verdict copy rather than implementation detail.

Web test totals: 100 → 116 tests (+16) across 14 → 17 files. Validated with `pnpm verify:cc` (4/4 packages green; happy-dom `AbortError` teardown noise is pre-existing).

### W2 — Web LoL recap surfaces (shipped 2026-05-19)

Two new specs covering the two recap surfaces with the densest branchy derive logic. Both tested through the rendered component (no source export added) — verdict assertions track user-visible copy rather than implementation detail.

- `apps/web/src/lol/recap/recap-patch-verdict.test.tsx` — 3 cases: empty placeholder when fewer than two qualifying patches, best/worst pick across two patches with the year-shaped display label (API major + 10), remake exclusion drops a borderline bucket below the 5-game threshold.
- `apps/web/src/lol/recap/recap-top-insight.test.tsx` — 3 cases: empty placeholder on `[]`, streak insight when a 4+ win run exists and other categories are sub-threshold, tilt insight when after-win and after-loss WR diverge by ≥8pp.

`lol/patches/profile-patch-notice.tsx` was triaged out — its core paths are localStorage dismissal + champion-name lookup, requiring a heavier router/champions provider scaffold than the recap surfaces, with less behavioral payoff per test.

### W3 — Web home tile interaction (shipped 2026-05-19)

One new spec; `orb-mark.tsx` triaged out after LSP read showed it's pure animation chrome (SPARKLES, WISPS, halo pulses) with zero interactive state — no behavior to assert beyond "the JSX renders," which the existing axe scan + routing tests already cover transitively.

- `apps/web/src/home/tile-chronotype.test.tsx` — 5 cases: loading placeholder (`isPending`), no-data placeholder (`data === undefined && !isPending`), default Both headline + combined footer copy with the resolved tz label, headline/footer noun swap when toggling Both → LoL → Steam, `aria-pressed` reflects the active toggle.

Final web totals: 100 → 127 tests (+27) across 14 → 20 files. Validated with `pnpm verify:cc` (4/4 packages green).

### H1 — Web pure-function harvest (shipped 2026-05-19)

First chunk of a follow-on "increase coverage" arc focused on direct unit tests of pure functions (no component rendering). Two originally proposed targets (`patch-version.ts`, `command-palette-recents.ts`) were already covered; the chunk landed eight new specs instead:

- `apps/web/src/lol/profile/use-habits-stats.test.ts` — 11 cases across `computeHourDayStats`, `computeTiltStats`, `computeGameLengthStats`, `computePoolStats`, `computeHabitsStats` (Mon-first day mapping, remake exclusion, tilt-pair sort/exclude semantics, 25/35-min bucket boundaries, 30-day pool window).
- `apps/web/src/lol/champions/champion-detail-stats.test.ts` — 9 cases across `computeChampionDetail` + `buildWinRateSeries` (perfect-KDA branch, dominant-role pick, MIDDLE fallback, chronological matchHistory).
- `apps/web/src/lol/matches/use-lp-delta.test.ts` — 5 cases on `computeLpDeltaMap` (missing-half skip, cross-tier promo, MASTER+ no-division branch).
- `apps/web/src/lol/_shared/analytics/role-baselines.test.ts` — 6 cases on `isRole`, `aggregateByRole`, `primaryRole` (remake + non-positional drops).
- `apps/web/src/lol/_shared/queue/queue-color.test.ts` — 4 cases (anchor map, stable hash for unknown queues).
- `apps/web/src/lol/champions/patch-drift.test.ts` — 9 cases covering every gate (MIN_PATCH_GAMES, MIN_CURRENT_CHAMP_GAMES, MIN_PREVIOUS_CHAMP_GAMES, MIN_RELATIVE_CHANGE, MIN_PP_CHANGE) + up/down direction + remake exclusion.
- `apps/web/src/lol/champions/weakest-matchup.test.ts` — 4 cases on `buildWeakestMatchup` (sample-size gate, baseline-vs-eligible delta semantics).
- `apps/web/src/lol/profile/pregame-composite.test.ts` — 5 cases covering all three confidence bands (empty/low/directional/cleared) and signed-band formatting.

Web lines coverage **13% → 17.23%** (+4.23pp); web threshold bumped 13 → 16 to ratchet the floor.

### H2 — Champion alias/URL helpers + new-match notice hook (shipped 2026-05-19)

Four pure-function modules covered after triaging out targets that already had complete tests (`champion-pool-drift.tsx`, `use-matches.ts`) or were too DOM-coupled to harvest cheaply (`useScrollspy` with `getBoundingClientRect`, `champion-table.tsx` and `match-row.tsx` which need full component-render scaffolding):

- `apps/web/src/lol/champions/champion-direction.test.ts` — `shouldFlipChampion` (FACING_RIGHT set, default flip, Swarm-prefix normalization).
- `apps/web/src/lol/_shared/assets/champion-icon.test.ts` — 7 URL builders + `normalizeChampionAlias` (proxy path, lowercasing, every champion variant).
- `apps/web/src/lol/_shared/assets/champion-theme.test.ts` — `championTheme` (known champion shape, Strawberry-prefix lookup, fallback).
- `apps/web/src/lol/profile/use-new-match-notice.test.ts` — `useNewMatchNotice` hook with fake timers (initial-transition suppression, 6s TTL, idempotent matchId, undefined reset).

Web lines coverage **17.23% → 17.56%** (+0.33pp — modest, the remaining pure helpers were small).

### H3 — Lib utilities + command-palette matcher (shipped 2026-05-19)

Five pure-function modules:

- `apps/web/src/lib/http-error.test.ts` — `HttpError` (explicit message + generic fallback, `instanceof Error`).
- `apps/web/src/lib/utils.test.ts` — `cn()` (clsx + tailwind-merge semantics).
- `apps/web/src/lib/use-perf-flag.test.ts` — `usePerfFlag` (URL param activates + persists, localStorage round-trip).
- `apps/web/src/lib/web-vitals.test.ts` — pub/sub bus with mocked `web-vitals` module (broadcast, late-subscriber replay, unsubscribe, single-init guarantee, console reporter).
- `apps/web/src/components/command-palette-matcher.test.ts` — 16 cases on `matchesQuery` covering every filter branch (outcome, withChampions, vsChampions, queues, roles, patches, since/until, kdaGt/Lt strict inequality, freeText haystack).

Web lines coverage **17.56% → 18.45%** (+0.89pp); web threshold bumped 16 → 18.

### H4 — API service-layer pure functions (shipped 2026-05-19)

Pivoted from web to API for the bigger LOC blocks:

- `apps/api/src/lol/match-projection.spec.ts` — 10 cases on `projectMatchForStorage` (owner vs non-owner branch, perks-tree shrinking to keystone-only, killParticipation preservation/elision, multi-owner duos).
- `apps/api/src/riot/riot.error.spec.ts` — `RiotError` + `RateLimiterTimeoutError` (synthesized message + `regional:family` path).
- `apps/api/src/lol/account-params.dto.spec.ts` — class-validator coverage (platform whitelist, unicode names, 3–32 length, allowed-char regex, 3–5 alphanumeric tagLine + `ChampionAccountParamsDto` inheritance).
- `apps/api/src/og/og-params.dto.spec.ts` — slug + matchId regex.

API lines coverage **54.33% → 57.56%** (+3.23pp); api threshold bumped 55 → 57.

**Aggregate after H1–H4:** web 13% → 18.45% lines (+5.45pp across 22 new test files / ~95 new cases); api 54.33% → 57.56% lines (+3.23pp across 4 new files); shared still 100%.

### H5 — Steam chip component sweep (shipped 2026-05-19)

First component-render chunk after the pure-function harvest exhausted. Six Steam chip components (`apps/web/src/steam/**.tsx`), each at 56–162 LOC, tested via `vi.mock(hook)` + the `<a>` Link mock established in [match-list.test.tsx](../../../apps/web/src/lol/matches/match-list.test.tsx):

- `apps/web/src/steam/library-composition-chip.test.tsx` — 5 cases (loading, error, first-poll empty, untouched-prescription, every-title-opened branch).
- `apps/web/src/steam/owned-games-chip.test.tsx` — 5 cases (loading, error, nothing-played, singular `title`, plural `titles`).
- `apps/web/src/steam/platform-mix-chip.test.tsx` — 5 cases covering every branch of `secondaryBreakdown` (loading, error, no-data, dominant + sorted rest, single-platform fallback).
- `apps/web/src/steam/wishlist-chip.test.tsx` — 7 cases (loading, error, empty, oldest-with-name, oldest-no-name, PREVIEW_LIMIT cap, placeholder for null name in preview).
- `apps/web/src/steam/recent-unlocks-chip.test.tsx` — 4 cases anchored at `2026-05-19T12:00:00Z` so the `Intl.RelativeTimeFormat` rendering stays deterministic.
- `apps/web/src/steam/now-playing-chip.test.tsx` — 5 cases (loading, error, offline persona + LFG label, in-game `InGameHeroCard` rendering).

Web lines coverage **18.45% → 20.38%** (+1.93pp — biggest single-chunk lift since H1); web threshold bumped 18 → 20. Steam vertical test count: 3 → 9 files.

## Sequencing

1. **C1** first so every subsequent chunk has measurable signal in `coverage:cc` output.
2. **S1** immediately after so shared work isn't blocked on plumbing.
3. **S2 → S3 → S4** in order — each is independently committable and the coverage signal compounds.
4. **A1** can interleave anywhere after C1 (independent of shared).
5. **W1 → W2 → W3** last, after the shared coverage means the web tests can focus on component-local behavior, not re-testing derive logic.

Budget: 9 chunks, roughly 3–5 sessions with `/compact` between chunks if context grows. Each S-chunk fits comfortably in one window; W1 and S4 are the largest. Prompt for `/compact` after S3 (mid-shared) and after A1 (vertical handoff to web).

## Decisions baked in

- **Coverage reporter is `text-summary`, not `text` or `html`.** Claude-friendly output (a few lines per file), no large diff in stdout that compresses prior context. HTML reports can be added later if the owner wants a visual drill-down — out of scope for the initial sweep.
- **Coverage thresholds start at 0 and rise as chunks land.** No hard gate in CI yet — instrumentation lands first; threshold tightening is a separate, opportunistic edit (e.g. when S4 ships, set shared's `lines` threshold to whatever it actually hit minus 5pp).
- **Routes are not in scope.** TanStack Router shells provide little testable surface; the wiring is exercised by integration tests and visual smoke.
- **Backfill scripts mostly skipped.** One-shot operational code; not worth maintaining tests against. Exception: the remake-threshold predicate in A1, because CLAUDE.md elevates it.
- **No e2e in this plan.** Playwright/Cypress is a separate decision; this plan stays in vitest unit/component-test scope.

## Out of scope

- Visual regression testing (Percy / Chromatic).
- End-to-end browser tests.
- API integration tests against a real Postgres (current Prisma mock pattern is sufficient).
- `tools/champion-assets` — separate workspace, not currently tested, not load-bearing for runtime.
