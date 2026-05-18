# Test coverage expansion — 2026-05-18

**Status:** Active — chunked plan for broadening test coverage across `packages/shared`, `apps/api`, and `apps/web` after the 2026-05-18 hygiene sweep landed T3–T5. C1 (instrumentation), S1 (scaffold), S2 (formatters), S3 (rank-history) shipped 2026-05-18. Shared is at 100% line coverage; only api + web work (A1, W1–W3) remains. S4 dropped — its files were all types-only.

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

### A1 — API `img/` services + remake-threshold predicate (1 chunk)

Files: `apps/api/src/img/upstream.ts` (transform / cache headers), `apps/api/src/img/lol-image.service.ts`, `apps/api/src/img/steam-image.service.ts`, `apps/api/src/img/img-prewarm.service.ts`. Mirror the existing api spec pattern (NestJS testing module, mocked HTTP).

Add one focused test against the 210s remake-vs-inting-surrender predicate in `apps/api/src/scripts/backfill-remake-flag.ts` — extract the predicate if currently inline, since CLAUDE.md flags this threshold as load-bearing.

Skip `prisma/` (boilerplate) and the rest of `scripts/` (one-off ops).

Validate with `pnpm --filter @vyoh/api test` then `pnpm verify:cc`.

### W1 — Web Steam vertical (1 chunk)

2–3 tests on the steam surfaces with real component-local logic (skip view-only tiles — their derive logic is covered by S4):

- `apps/web/src/steam/game/achievement-panel.tsx` (351 LOC) — sort/filter/section state, search input.
- `apps/web/src/steam/game/game-unlock-timeline.tsx` (127 LOC) — bucketing into time ranges.
- `apps/web/src/steam/game/last-progressed-card.tsx` (180 LOC) — recent-unlocks rendering and grouping.

Reuse the testing patterns from `match-list.test.tsx` (component + happy-dom + minimal mocks).

Validate with `pnpm --filter @vyoh/web test` then `pnpm verify:cc`.

### W2 — Web LoL untested cohorts (1 chunk)

Pick 2–3 surfaces in `lol/recap/` (7 files) and `lol/patches/` (7 files) that carry hooks/state, skip purely presentational components. Candidates to triage during the chunk:

- `lol/recap/` — recap surfaces tend to wrap aggregations; pick one with local interactive state.
- `lol/patches/` — patch-list or patch-detail with filtering.

Read each candidate first; if it's a thin view-only wrapper around a shared derive function, skip and pick the next.

Validate with `pnpm verify:cc`.

### W3 — Web home tile interaction (1 chunk)

Only the tiles with non-trivial *interactive* state (most derive logic is in shared, covered by S3):

- `apps/web/src/home/orb-mark.tsx` (365 LOC) — gesture/motion behavior, hover/select state.
- `apps/web/src/home/tile-chronotype.tsx` (196 LOC) — hour selection, range highlighting.

Skip the use-`*` hooks (thin TanStack Query wrappers) and the smaller tiles (`tile-build-badge`, `tile-signature-game`, `tile-last-match`) unless reading reveals logic worth covering.

Validate with `pnpm verify:cc`.

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
