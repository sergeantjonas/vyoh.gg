# Test coverage expansion — 2026-05-18

**Status:** Active — chunked plan for broadening test coverage across `packages/shared`, `apps/api`, and `apps/web` after the 2026-05-18 hygiene sweep landed T3–T5. Scope baked in; no chunks shipped yet.

Follow-up to [project-hygiene-2026-05-18.md](./project-hygiene-2026-05-18.md), which closed the first wave of web component tests (T3 command palette + match-detail tab nav, T4 scroll restoration + splash provider, T5 jest-axe). Those addressed *highest-risk web surfaces*; this note scopes the broader push, including the structural gap the hygiene note didn't size: **`packages/shared` has zero tests**.

## Current state (file-level, 2026-05-18)

No coverage tooling installed — no `@vitest/coverage-v8`, `c8`, or `istanbul` anywhere; no `test:coverage` scripts. Numbers below are file-level co-location, not line/branch coverage.

| Package | Tests | Non-test sources | Co-located | Coverage script? |
|---|---|---|---|---|
| `apps/api` | 46 | 93 | ~50% | no |
| `apps/web` | 12 | 264 | ~4.5% | no |
| `packages/shared` | **0** | 35 (1,218 LOC) | 0% | **no test script, no vitest config** |

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

### C1 — Coverage instrumentation (1 chunk)

Add `@vitest/coverage-v8` as a workspace devDep. Configure `coverage.provider = 'v8'` with `reporter: ['text-summary']` (Claude-friendly) and a stub threshold (e.g. `lines: 0` initially, raised as chunks land) in each `vitest.config.ts` (api, web, and the new shared config from S1 once it exists). Add a `coverage:cc` script at the workspace root: `pnpm -r test --coverage 2>&1 | head -400`.

No new tests in this chunk. Capture the baseline coverage numbers in this working note after the run.

Validate with `pnpm coverage:cc`; sanity-check that v8 coverage works under happy-dom (web).

### S1 — `packages/shared` test setup (1 chunk, micro)

Add `vitest` devDep + `test` / `test:watch` scripts to `packages/shared/package.json`. Create `packages/shared/vitest.config.ts` matching the api/web shape (node env; no JSX). Write one trivial test against `excludeRemakes` to prove the runner wires up. Update root `test:cc` if it doesn't already pick up shared via `pnpm -r test` (it does, via workspace recursion — but verify).

Validate with `pnpm --filter @vyoh/shared test` and `pnpm test:cc`.

### S2 — Shared invariants + formatters (1 chunk)

Files: `lol/exclude-remakes.ts`, `format.ts`, `lol/chronotype.ts`, `steam/chronotype.ts`. Pick edge cases that matter:

- `excludeRemakes`: empty array, all remakes, no remakes, mixed; verify the result is type-preserving on subtypes.
- `format.ts`: each of the 5 formatters (`formatDuration`, `formatHoursMinutes`, `formatPlaytime`, `formatGameTime`, `formatGold`) — at minimum a typical, a zero, a boundary (59m59s, 1h, 24h+), and a negative if accepted.
- chronotype derivers: hour bucketing in `Europe/Brussels` (per repo conventions), DST boundary if logic touches it, empty input.

~20-30 tests. High blast radius — both api and web consume these.

Validate with `pnpm test:cc` + `coverage:cc`; spot-check that shared coverage moves the needle in the summary output.

### S3 — Shared home aggregations (1 chunk)

Files: `home/first-played.ts`, `home/chronotype.ts`, `home/weekly-totals.ts`, `home/day-split.ts`, `home/session-lengths.ts`. Each is a pure derive function consuming structured input. Tests double as the executable spec for the corresponding home tile.

For each: empty input, single-event input, multi-event happy path, timezone-boundary case where relevant. Many of these derivers are already exercised indirectly by api specs (`home-chronotype.service.spec.ts` etc.) — that doesn't replace direct coverage, but use the api specs' fixtures as a starting point to avoid re-inventing test data.

Validate with `pnpm test:cc`.

### S4 — Shared LoL + Steam domain (1 chunk, may split)

Files: `lol/rank-history.ts` (151 LOC, biggest single file in shared), `lol/patch-changes.ts`, `lol/match-detail.ts`, `lol/live-game.ts`; `steam/achievements.ts`, `steam/owned-games.ts`, `steam/summary.ts`.

`rank-history.ts` deserves dedicated attention — it's the LP-forecast and rank-progression backbone. If context pressure builds, split as S4a (LoL files) / S4b (Steam files).

Validate with `pnpm test:cc` + `coverage:cc`; aim for shared lines coverage above 80% after S4.

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
