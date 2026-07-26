**Status:** Active — action plan derived from [state-review-2026-07-25.md](state-review-2026-07-25.md). Produced 2026-07-25 by a 20-agent sweep (7 investigations, each adversarially verified, plus a completeness critic). Corrections from the critic and from a main-thread re-verification are folded in and marked **[corrected]**.

## Sequencing rationale

The CI gate fix (F-1) turns CI red the instant it lands — all three packages currently fail their own coverage thresholds, and `pnpm -r` bails at `packages/shared` so today's green is doubly fake. The ci-gate investigation argued for landing F-1 first "so the red run is the checklist"; reject that. The full deficit table is already measured (shared +14 lines, api +9 functions, web +134/+61/+213), so the red run buys no diagnostic value, and if "Lint, format, typecheck, and test" is a required status check it blocks every merge for the duration of the web coverage work (multiple sessions). **Land all coverage chunks first (3–8), then F-1 (chunk 9) as the commit that makes CI honest and green in the same push.** Verify coverage locally in the meantime with `pnpm -r --no-bail test --coverage` — `test:cc`/`verify:cc` carry no `--coverage` and will report green regardless.

Chunk 1 is a prerequisite for everything: `apps/web/src/routeTree.gen.ts` goes dirty (209+/209−) and will ride along on any `git add -A`. Every chunk below stages explicit paths.

**[corrected]** The plan originally said the file "is dirty in the tree", implying leftover uncommitted work. It was **clean at `eb5ac211`** — running the dev server, tests, or a build regenerates it under the bumped `@tanstack/router-plugin`, which orders imports differently from whatever generated the committed copy. So the committed version is stale relative to the current plugin, and *anyone* who runs `pnpm dev` or `pnpm test` after the 2026-07-25 dependency commits gets a dirty tree. That makes chunk 1 more worth doing, not less — but the cause is the plugin bump, not abandoned work. Pure-reorder verified in the main thread: `git show HEAD:… | sort` is byte-identical to `sort` of the worktree copy.

## Chunks

### 1. `chore: regenerate the route tree after the router plugin bump`

- **Scope** — `apps/web/src/routeTree.gen.ts`
- **What changes** — Commit the 209/209 import-reordering regeneration currently in the tree. Verified pure reorder: `git show HEAD:apps/web/src/routeTree.gen.ts | sort` is byte-identical to `sort` of the worktree copy. Deterministic across re-runs; traces to the recent dependency-bump commits. Committing it stops it re-dirtying on every `pnpm test` / dev-server start.
- **Validation** — `pnpm run check:cc` (biome.json:10 ignores `**/*.gen.ts`, so this is a no-op pass), `pnpm run typecheck:cc`.
- **Note updates** — none.
- **Effort** — 5 min. Trivial.
- **Blocked by** — nothing.

### 2. `docs: track the state review and index it in open-work`

- **Scope** — `docs/working-notes/cross-cutting/state-review-2026-07-25.md`, `docs/working-notes/open-work.md`
- **What changes** — `git add` the untracked review note. **[corrected — already done]** The bundle figures were corrected in the review itself on 2026-07-25 (see its "Unit correction" section); this chunk no longer needs to touch them. The plan's proposed 229.53 kB was itself slightly off. The real cause was **binary vs decimal kB**, not the gzip level: `size-limit` reports and parses decimal kB (`bytes / 1000`). Measured in the main thread — entry chunk 133,482 B = 133.48 decimal kB (matches its printed 133.78 kB; residual is `__BUILD_TIME__` drift) vs 130.35 binary kB (does not match). All 21 initial chunks at per-file gzip -9 = **229,347 B = 229.35 kB decimal**, against a 210 kB limit. Overshoot is **19.35 kB**. Add an index line under open-work.md `### Cross-cutting` (after the TanStack Start line at :54) naming the arc and its next action; the note's own :3 claims "Blocking items are tracked into open-work.md separately", currently false (`ugrep -n 'state-review' docs/working-notes/open-work.md` → no hits).
- **Validation** — `ugrep -n 'state-review' docs/working-notes/open-work.md` returns the new line. No lint gate: Biome 1.9.4 has no Markdown support (`npx biome check README.md` → `Checked 0 files`).
- **Note updates** — this chunk *is* the note housekeeping; every later chunk ticks its finding row here.
- **Effort** — 15 min.
- **Blocked by** — nothing.

### 3. `test: cover the untested shared pure functions`

- **Scope** — new `packages/shared/src/lol/champion-of-year.test.ts`, new `packages/shared/src/steam/owned-games.test.ts`, new `packages/shared/src/lol/match-stats.test.ts`, `packages/shared/src/format.test.ts`, `packages/shared/src/lol/rank-history.test.ts`, `packages/shared/src/lol/champion-of-year.ts`, `packages/shared/vitest.config.ts`
- **What changes** —
  - `champion-of-year.ts:22-23`: replace `for (const m of matches) { if (m.remake) continue;` with `for (const m of excludeRemakes(matches)) {` + `import { excludeRemakes } from "./exclude-remakes.ts";`. Required by the "Centralise domain invariants" convention; also removes 2 uncovered statements / 1 uncovered line / 2 branch paths from the denominators.
  - `champion-of-year.test.ts` (9 uncovered lines, 2 fns, 9 reachable branch paths — the `list[0] ?? null` right path at :44 is unreachable, do not chase it): empty→null; two Ahri + one Yasuo aggregate; a remake row contributing no kills/games; win+loss → `wins===1`; Yasuo 3 games beats Ahri 2. Copy the `fixture()` builder idiom from `champion-recap.test.ts:12-44` — duplicate per file, that is house style (`pregame-signals.test.ts:17-48` does the same).
  - `rank-history.test.ts`: new `describe("formatRankTitle")` after `describe("formatRank")` — `("DIAMOND","II")→"Diamond II"`, `("MASTER","I")→"Master"` + `("CHALLENGER","I")→"Challenger"` (tierIndex ≥ 7), `("platinum","iv")→"Platinum IV"`, `("UNRANKED","I")→"UNRANKED I"` (hits both `??` right paths in one call). Add the import at :2-8.
  - `format.test.ts`: `describe("formatPlaytimeFromSeconds")` near :183 — 1800→`"30m"`, 3600→`"1.0h"`, 261360→`"72.6h"`, 0→`"0m"`, 3599→`"60m"`. Import between `formatPlaytime` and `formatPlaytimeVerbose` at :2-14.
  - `match-stats.test.ts`: `describe("computeStreak")` — `[]`→null; all-remake→null; three losses→`{type:"loss",count:3}`; two wins then a loss→`{type:"win",count:2}` (this is what covers the `break` at :76, the file's only uncovered line). Note `computeStreak` sorts descending.
  - `owned-games.test.ts`: `isSteamGameAppType(0)===true`, `(null)`/`(undefined)===true`, `(6)===false`. The file's entire coverage footprint is 1 statement / 1 line / 1 fn / 2 branches at :174 — everything above :173 is type declarations, so it reports 0%.
  - `vitest.config.ts:12-13`: the comment claims "Floor is well below current (100% lines)". Replace with the real post-fix state (lines 99.49% vs a 99 floor, 4 lines of slack) and note CI enforces via `pnpm -r test --coverage`, so a package-local `pnpm test` passing proves nothing.
- **Projection** (denominators verified stable — a single-test-file coverage run produces byte-identical per-file denominators to the full run): statements 1157/1195 = 96.82%, branches 768/848 = 90.57%, functions 166/167 = 99.40%, lines 966/971 = 99.49%. All four clear.
- **Validation** — `pnpm --filter @vyoh/shared test --coverage` (must show 0 ERROR lines), `pnpm run typecheck:cc`, `pnpm run check:cc`.
- **Note updates** — tick F-2 (shared) in `state-review-2026-07-25.md` + the open-work line.
- **Effort** — 60–90 min. One context window.
- **Blocked by** — nothing (chunk 1 for a clean tree).

### 4. `fix: drop the unreachable champion-recap context branch`

- **Scope** — `packages/shared/src/lol/champion-recap.ts`, `packages/shared/src/lol/champion-recap.test.ts`
- **What changes** — Delete `champion-recap.ts:459-466`. The guard `if (primary !== "aggressive" && peaks.aboveFiveKillsRate >= 0.5)` can never be true: `pickPrimaryVerdict`'s first check at :346 is `if (peaks.aboveFiveKillsRate > 0.45) return "aggressive"`, and `verdictParagraph` derives `primary` at :313 and passes the same `recap` into `contextClause` at :327. Deleting removes 3 statement-bearing lines (459 is covered, 460/461 are not) and 4 branch paths (2 covered). Add three `verdictParagraph` cases inside the existing describe at :236, all built via `deriveChampionRecap("Ahri", matches, NOW)` per file idiom (NOW = `2026-06-01T12:00:00Z` at :10):
  - **measured** (`:354`): 4 non-remake matches, kills 3, deaths ≥ 1, 2W/2L, `teamGoldDiffAt15: 100`. The existing suite only ever reaches "aggressive" and "struggling".
  - **perfect-KDA context** (`:468`): exactly 2 matches with `deaths: 0`, no ≥3 streak. Once :459-466 is gone `aboveFiveKillsRate` is irrelevant here — do not constrain it.
  - **quiet-for-N-days** (`:489`): ≥3 matches at ~`2026-05-10` with **mixed** outcomes so `computeStreak` returns null or count < 2 — three all-wins or all-losses get intercepted at :442/:449 before :488 ever runs.
- **Result** — lines 969/969 = 100%, branches 768/846 = 90.78%.
- **Validation** — `pnpm --filter @vyoh/shared test --coverage`, `pnpm run typecheck:cc`, `pnpm run check:cc`.
- **Note updates** — none beyond the state-review row if you want the headroom recorded.
- **Effort** — 45–60 min; the three fixtures must thread past every earlier guard. One context window.
- **Blocked by** — 3. Requires the open decision on :459 (see Open decisions).

### 5. `test: cover the lol controller champion delegates`

- **Scope** — `apps/api/src/lol/lol.controller.endpoints.spec.ts`
- **What changes** — `lol.controller.ts` carries 14 of the package's 67 uncovered functions (across 26 files) against a 9-function requirement; it alone clears the threshold. Extend the existing plain-constructor `makeController()` factory (`:8-39` — do NOT switch to `Test.createTestingModule`, that is `lol.controller.spec.ts`'s idiom):
  - Add stubs `getSquads, getCarryProfile, getObjectiveFirsts, getObjectiveParticipation, getAramProfile, getDamageProfile, getChampionRuneDiversity, getChampionLanePhase, getChampionRecap` on `analytics`, `getLifetimeNarrative` on `narrative`. The factory at `:29-38` returns only `{ controller, lol, analytics }` — widen it to return `baseline` and `narrative` too.
  - Five params-based methods assert 4 args: `("euw1","Vyoh","EUW",100)`.
  - **`getDamageProfile` asserts 5**: `lol.controller.ts:178` forwards `(region, gameName, tagLine, undefined, count)` → `toHaveBeenCalledWith("euw1","Vyoh","EUW",undefined,100)`.
  - Three champion-scoped take `(championParams, 100)` and assert 5 args; **`getChampionRecap` takes params only** (`lol.controller.ts:260-262` declares no `count`) → `toHaveBeenCalledWith("euw1","Vyoh","EUW","ahri")`. `getNarrativeLifetime` params-only, 3 args. `getBaseline` needs `{...params, championAlias:"Ahri", role:"MIDDLE"}` (role is typed `string`; class-validator does not run in a direct controller unit test).
  - One `getChampionExtras(championParams, "420,440")` asserting `(...,"ahri",[420,440])` — covers the `:244` truthy branch plus both arrow callbacks at `:247`/`:248`.
- **Justification for the assertions** (not the one the investigation gave — dropping the `undefined` at :178 *is* a compile error, TS2345): `region`, `gameName`, `tagLine` are all `string`, so any reordering among them is invisible to the compiler and only `toHaveBeenCalledWith` catches it.
- **Projection** — functions 912 → 926 of 979 = 94.59% (floor 921); statements 5046 → 5060 = 92.40%, which widens the thin 8-statement margin to 22.
- **Validation** — `pnpm --filter @vyoh/api test --coverage` (read the summary the run prints; do not read `coverage/coverage-final.json` afterwards — a parallel `pnpm -r test` will overwrite it), `pnpm run typecheck:cc`, `pnpm run check:cc`.
- **Note updates** — tick F-2 (api) in `state-review-2026-07-25.md` + the open-work line.
- **Effort** — 30 min, ~90 lines, mechanical. One context window.
- **Blocked by** — nothing.

### 6. `test: cover the untested react-query hook wrappers`

**[corrected] Split into 6a and 6b.** The critic flagged this as two chunks: six files, fifteen hook modules, three structurally different harness shapes, plus three "strays" with different guard arities. Split at the seam the chunk already draws:
- **6a — extend the existing tables** (`use-profile-hooks.test.tsx` rows, `use-steam-game-hooks.test.tsx` row, and *building* the `cases[]` table in `use-champion-extras.test.tsx` + lane-phase/rune-diversity). ~28 functions; near-zero design work once the third table exists.
- **6b — new files for the strays** (`use-damage-profile`, `use-match-baseline`, `use-account-from-slug`, `use-wishlist-hero-meta`, `use-home-today`, `use-home-lifetime-totals`). Six new files, ~15 functions.

Neither half alone clears a threshold, but nothing does until chunk 8 anyway, so the split costs nothing. Everything below applies across both halves.

- **Scope** — `apps/web/src/lol/profile/use-profile-hooks.test.tsx`, `apps/web/src/lol/champions/use-champion-extras.test.tsx`, `apps/web/src/steam/game/use-steam-game-hooks.test.tsx`, new `apps/web/src/lol/_shared/use-damage-profile.test.tsx` (strays aggregator), new `apps/web/src/steam/wishlist/upcoming/use-wishlist-hero-meta.test.tsx`, new `apps/web/src/home/use-home-totals.test.ts`
- **What changes** — 15 structurally identical hook files at 0%, worth **283 lines / 43 functions / 361 statements**. Four assertions cover each: undefined-account no-fetch guard; success + URL assertion; `{message}` error surfacing; non-JSON `HTTP <status>` fallback.
  - `use-profile-hooks.test.tsx` is genuinely table-driven (`cases[]` + four `it.each` blocks) — add rows for `use-aram-profile` (default `count=200`, so URL ends `/aram-profile?count=200`), `use-carry-profile`, `use-objective-firsts`, `use-objective-participation`, `use-squads` (`count=100`), `use-narrative-lifetime` (**no count param — no query string**).
  - `use-champion-extras.test.tsx` is **not** table-driven (single describe, individual `it` blocks, already mocks `use-account-from-slug` and wraps in `SeriousQueuesProvider`). Build the `cases[]` table there in the same change, then add lane-phase and rune-diversity. Both guard on `account !== undefined && championKey.length > 0` — assert the no-fetch case twice (undefined account; empty championKey).
  - `use-steam-game-hooks.test.tsx` (table-driven) — add `use-game-description`.
  - Strays aggregator: `use-damage-profile`, `use-match-baseline` (needs its own unmocked file — `match-review.test.tsx:29-31` mocks it wholesale; three-way guard `!!account && !!championAlias && !!role` needs three no-fetch cases; URL is a template literal with `encodeURIComponent`, so use values that need encoding), `use-account-from-slug` (0% for the same reason — ~20 files `vi.mock` it).
  - `use-wishlist-hero-meta` exports a queryOptions factory too: assert `queryKey` deep-equals `["steam","wishlist",appid,"hero-meta"]` with no React at all, plus the hook. Best fns-per-line in the set (4 fns / 13 lines).
  - `use-home-today` + `use-home-lifetime-totals`: parameterless, copy `use-home-weekly-totals.test.ts` wholesale and swap the endpoint.
- **House style** — `renderHook` + `waitFor`, local `makeWrapper()` with `new QueryClient({ defaultOptions: { queries: { retry: false } } })`, `vi.stubGlobal("fetch", vi.fn())` in `beforeEach` / `vi.unstubAllGlobals()` in `afterEach`, assert on `String(vi.mocked(fetch).mock.calls[0]?.[0])`.
- **Validation** — `pnpm --filter @vyoh/web test --coverage`; read the **covered/total counts**, not percentages. Targets after all three web chunks: lines ≥ 15039, functions ≥ 2158, statements ≥ 21135.
- **Note updates** — none yet (web is not green until chunk 8).
- **Effort** — 2–3 h. One context window; the table rows are near-zero design work once `use-champion-extras.test.tsx` has its table.
- **Blocked by** — nothing.

### 7. `test: cover the navigation classifier and unused menu primitives`

- **Scope** — new `apps/web/src/lib/navigation-type.test.ts`, new `apps/web/src/components/ui/select.test.tsx`, new `apps/web/src/components/ui/navigation-menu.test.tsx`, `apps/web/src/lib/view-transition-nav.test.ts`
- **What changes** — 15 functions / ~86 lines / ~184 statements, all with proven mechanisms.
  - **navigation-type** (7 fns, 52 lines, 74 stmts): only `getNavigationType` is exported; drive the five private helpers through it. `from === undefined` → false (:76); same pathname → false (:77); `supportsViewTransitions()` mocked false → false (:84). Then: `/lol/vyoh/matches` → `/lol/vyoh/trends` (lolTabIndex both sides); `/steam/library` → `/steam/achievements` (steamTabIndex — `isWebKit()` is false under happy-dom since `navigator.vendor === ""`, so the branch is reachable without mocking; add one case mocking it true for the WebKit bypass); `/lol/vyoh/matches` → `/lol/vyoh/matches/EUW1_123` **expects `false`**, not a classification — the union at :18-23 has no list-detail member; `/lol/` (with trailing slash) to reach the `return seg || null` null arm at :47 — `/lol` returns at :45; `/patches` → `/patches/26-3` for the *terminal* `cross-section` return (`/steam` → `/lol/vyoh` hits the early one); `/lol/vyoh/nonsense` for the `indexOf` −1 arm.
  - **select.tsx** (3 fns, 17 lines, 61 stmts): Radix Select pre-renders content when closed (7 of 10 fns already covered from trigger-only tests), so no open needed. Render a `SelectGroup` wrapping `SelectLabel` + two `SelectItem`s with a `SelectSeparator`.
  - **navigation-menu.tsx** (2 fns, 14 lines, 46 stmts): render `<NavigationMenuViewport />` and `<NavigationMenuIndicator />` explicitly.
  - **view-transition-nav.test.ts**: add `useViewTransitionNavigate` only (3 fns) — `renderHook` with `@tanstack/react-router` mocked (the 49-file house idiom), invoke the callback, assert delegation, once with VT supported and once with `supportsViewTransitions()` stubbed false.
- **Do not attempt in this chunk**: `installViewTransitionLifecycleLogger` (8 fns) is module-private at `view-transition-nav.ts:86`, reachable only via a DEV + `localStorage["vt-debug"]==="1"` module-load side effect with a one-shot `doc.__vtLoggerInstalled` guard; and `dropdown-menu.tsx` (12 fns) — `matches-breadcrumb.test.tsx:64` documents "Radix DropdownMenu doesn't open in happy-dom". Both are Deferred.
- **Validation** — `pnpm --filter @vyoh/web test --coverage`, `pnpm run typecheck:cc`, `pnpm run check:cc`.
- **Note updates** — none yet.
- **Effort** — 90 min. One context window.
- **Blocked by** — nothing.

### 8. `test: cover the lightbox, screenshot strip and match list`

- **Scope** — `apps/web/src/home/recap/screenshot-lightbox.test.tsx`, `apps/web/src/steam/game/game-screenshot-strip.test.tsx`, `apps/web/src/lol/matches/match-list.test.tsx`
- **What changes** — 23 functions off ~48 uncovered lines, all three harnesses already exist (169L / 554L / 301L). `screenshot-lightbox.tsx` is 98.5% covered but carries 6 uncovered functions for 1 uncovered line — best fns-per-effort in the package. This chunk exists specifically to close the **functions** threshold, which is the binding constraint (needs +61; hooks give 43, chunk 7 gives 15, this gives 23 → 81 covered functions, 20 of margin).
- **Web go/no-go after this chunk** — statements ≥ 21135, functions ≥ 2158, lines ≥ 15039. Projection with all three chunks: functions 2178/2509 = 86.81%, lines ~15243, statements ~21560. Branches passes throughout (207 slack; denominators are fixed, verified — a single-test-file run and the full 330-file run give byte-identical totals).
- **Validation** — `pnpm --filter @vyoh/web test --coverage` must print **zero** ERROR lines. Then `pnpm -r --no-bail test --coverage` — all three packages must be clean before chunk 9.
- **Note updates** — tick F-2 (web) in `state-review-2026-07-25.md` + the open-work line, now that all three packages pass.
- **Effort** — 2 h. One context window.
- **Blocked by** — 6, 7 (all three needed for the functions threshold).

### 9. `ci: enable pipefail so the coverage gate can actually fail`

- **Scope** — `.github/workflows/ci.yml`, `package.json`
- **What changes** —
  - **[corrected — added]** Root `package.json` `coverage:cc` is `pnpm -r test --coverage 2>&1 | head -400` and carries **both** defects this chunk fixes in CI: no `--no-bail` (bails at `packages/shared`, never reaching api or web) and `head -400` truncation (in a full run web's ERROR lines land at output lines 762–764, so the very failures being cleared are discarded). Since the sequencing rationale tells you to verify coverage locally throughout chunks 3–8, this is the first script you will reach for. Fix it here: add `--no-bail`, raise or drop the `head` cap.
  - `:32-33` → add `shell: bash` and `--no-bail`:
    ```yaml
    - name: Test with coverage
      shell: bash
      run: pnpm -r --no-bail test --coverage 2>&1 | tee coverage-output.log
    ```
    Default shell is `bash -e {0}`; explicit `shell: bash` is `bash --noprofile --norc -eo pipefail {0}`. Verified: identical command exits 0 under `-e`, 1 under `-eo pipefail`; `tee` still writes the file either way. `--no-bail` stops `ERR_PNPM_RECURSIVE_FAIL` aborting at the first package, so all three lcov files exist for the Codecov step at `:51` (which is otherwise silently uploading 1 of 3 declared files under `fail_ci_if_error: false`).
  - `:35-44` summary step: add `shell: bash`, guard on `[ -s coverage-output.log ]` with an else-branch, and add `ERROR: Coverage` to the grep alternatives (today it matches 0 of the 8 threshold lines). The current form fails under `set -e` when an earlier step skipped the test step — and loses the closing ``` fence, rendering an unclosed code block. Keep `test:  %` in the pattern: it is the only alternative matching the `% Coverage report from v8` per-package header.
- **Leave alone** — Codecov `fail_ci_if_error: false` at `:53`; the audit job; workflow-level `defaults`.
- **Validation** — locally: `bash --noprofile --norc -eo pipefail -c 'pnpm -r --no-bail test --coverage 2>&1 | tee /dev/null'` must exit 0 after chunks 3–8. Also confirm the other three gates are green so the first real run is unambiguous: `pnpm ci:check`, `pnpm typecheck`, `pnpm audit --prod --audit-level=high` (all exit 0 today).
- **Note updates** — tick F-1 in `state-review-2026-07-25.md` + the open-work line.
- **Effort** — 15 min.
- **Blocked by** — 3, 4, 5, 6, 7, 8. **If landed before those, CI goes red on main and every open PR.** Land it after, or accept the red.

### 10. `fix: measure true initial JS in the size budget`

- **Scope** — `apps/web/.size-limit.cjs`, `docs/working-notes/cross-cutting/perf-baseline.md`
- **What changes** — Replace the whole file. The `main bundle (initial JS)` entry globs only `dist/assets/index-*.js` = 133.78 kB against a 210 kB limit, while `dist/index.html` loads 21 JS chunks on first paint (1 entry `<script type="module">` at `:36` + 20 `<link rel="modulepreload">` at `:37-56`).
  - **Derive the list at run time** from `dist/index.html` — do not hand-write globs. Prefix globs over-count (`dist/assets/dist-*.js` matches 5 emitted chunks, only 3 preloaded = 10.94 kB of phantom bytes) and content hashes change every build.
  - Guard against partial misses, not just zero: count `rel="modulepreload"` occurrences and throw if `paths.length !== preloadCount + 1`. A path listed in the HTML but absent on disk is silently dropped by size-limit (verified: a ghost path yields no warning, exit 0). A `paths.length < 5` floor does not catch this.
  - **Biome-canonical form required** (verified against `biome.json` lineWidth 90 / trailingCommas es5): no trailing comma after the string argument in either `throw new Error(...)`, and `const isPreload = tag.startsWith("<link") && /\brel="modulepreload"/.test(tag);` on one line. Verify with `pnpm check:cc`, never `biome check --stdin-file-path` (stdin mode exits 1 for any input, including the current clean file).
  - Keep the recharts entry byte-identical: `dist/assets/CategoricalChart-*.js`, 85 kB, one match at 68.25 kB.
  - Keep the exact measured number out of the config comment (`__BUILD_TIME__`/`__BUILD_COMMIT__` are baked in at `apps/web/vite.config.ts:61-67`, so every build shifts bytes) — write `~230 kB` there and put the precise figure in perf-baseline.md. Do not assert what the initial payload was in May; that was never measured.
  - `perf-baseline.md:10` has three errors: wrong file (`apps/web/package.json`, actually `.size-limit.cjs`), wrong main limit (200, actually 210), wrong recharts actual (76, actually 68.25). Rename the `:14` heading "Main bundle baseline" → "Initial JS baseline" (that name is the conflation that caused this), mark `:16`/`:18` as entry-chunk-only, add a 2026-07-25 row, fix `:39` (77 kB / 245 kB → 68.25 / 230.08), and add one line that the budget is JS-only — `index-*.css` is 30.95 kB gzip and render-blocking.
- **Validation** — `pnpm --filter @vyoh/web build && pnpm --filter @vyoh/web size`; expect ~229–230 kB, not ~133 kB (a ~133 reading means the HTML parse matched only the entry). Cross-check `ugrep -c 'rel="modulepreload"' apps/web/dist/index.html` = 20. Then `pnpm run check:cc`.
- **Note updates** — `perf-baseline.md` (in scope above), tick F-3 in `state-review-2026-07-25.md` + the open-work line.
- **Effort** — 45 min. One context window.
- **Blocked by** — nothing technically; requires the limit decision (see Open decisions).

### 11. `fix: route the remaining remake filters through the helper`

- **Scope** — `packages/shared/src/lol/pregame-signals.ts`, `packages/shared/src/lol/pregame-signals.test.ts`, `apps/web/src/lol/profile/profile-post-game.tsx`, `apps/web/src/lol/profile/profile-post-game.test.tsx`
- **What changes** —
  - `pregame-signals.ts:78-80`: `matches.filter((m) => !m.remake && …)` → `excludeRemakes(matches).filter((m) => …)`. `excludeRemakes` already imported at `:1` and used correctly by the three siblings at `:25/:35/:54`. Byte-identical to the shipped twin at `profile-pregame-ritual.tsx:227-229`; Biome fixpoint verified.
  - `pregame-signals.test.ts` (append after the case ending at `:224`): the uniform all-remake assertion is **vacuous** — it returns `"neutral"` with or without the filter. Use discriminating fixtures instead: (1) 4× `{champion:"Ahri", win:true}` + 6× `{champion:"Lux", win:false, remake:true}` → `"neutral"`, control with flags cleared returns `"warning"`; (2) 4× `{champion:"Ahri", win:true, remake:true}` + 2× `{champion:"Lux", win:false, remake:true}` → `"neutral"`, control returns `"positive"`. The Lux `win` value is load-bearing — if the remakes are wins, fixture (1) does not discriminate.
  - `profile-post-game.tsx:321-322`: `[...matches].sort(…)` + `.find((m) => !m.remake)` → `excludeRemakes(matches).sort(…)` + `ordered[0]`. `excludeRemakes` imported at `:15`; it returns a fresh array so the in-place sort is safe; `ordered` is referenced only at `:322`; `[0]` is `MatchSummary | undefined` under `noUncheckedIndexedAccess`, same as `.find()`, and `if (!last) return null` at `:323` still narrows.
  - `profile-post-game.tsx:42` — **real bug, changes rendered output.** `buildOutcomeSignal` computes the streak over unfiltered `history`; remakes carry a `win` boolean. Measured: a remake LOSS at the head of two real losses reports streak 3 instead of 2; a remake WIN at the head collapses the streak to 0 and makes `beforeStreak` the remake itself, so the "broke a N-game run" text at `:57-63` is derived from a remake. Fix with the Biome-stable wrap (the one-line form is 95 chars, over lineWidth 90):
    ```ts
    const ordered = excludeRemakes(history).sort((a, b) =>
      b.playedAt.localeCompare(a.playedAt)
    );
    ```
  - Tests go in the **existing** `profile-post-game.test.tsx` (357 lines, 22 passing, `fakeMatch` factory at `:34`), next to the streak cases at `:119-140`. These are **red-then-green**: today the remake-between-losses fixture renders "3-game loss streak now.", after the fix "back-to-back losses.". Add the head-remake-is-a-win case too. None of the 22 existing fixtures mixes a remake into a multi-match history, so they should stay green — confirm, don't assume. Expect 24 passing.
- **Validation** — `pnpm --filter @vyoh/shared test --coverage`, `pnpm --filter @vyoh/web test --coverage`, `pnpm run typecheck:cc`, `pnpm run check:cc`. Eyeball `/lol/$accountSlug` Post-game after a remake. **[corrected]** `--coverage` on both: once chunk 9 lands the gate is live and shared has only 4 lines of slack.
- **Note updates** — tick F-5 (partial) in `state-review-2026-07-25.md` + the open-work line.
- **Effort** — 50 min. One context window.
- **Blocked by** — nothing. Requires the `history` decision (see Open decisions).

### 12. `test: harden the remake lint to a whole-file scan`

- **Scope** — `apps/api/src/conventions.spec.ts`
- **What changes** — The lint is blind because `matchLines()` at `:53-62` tests **one line at a time**, not because of the regex (`:69` already has `\s*` after `\.filter\(`). Running the current regex line-by-line over all three scan roots yields 0 hits. Replace the body of the remake `it()` at `:68-74` with a whole-text `collect` (mirror the `title=` lint at `:84-97`, including the `biome-ignore` for the exec loop), constructing the regex **inside** the per-file callback so the `g` flag's `lastIndex` cannot leak between files. Leave `matchLines` untouched — the header-recipe lint at `:142` still uses it. Leave `REMAKE_ALLOWLIST` at `:13-15` and the `expect` at `:75-78` untouched.
  ```js
  const methods = "filter|find|findLast|findIndex|findLastIndex|some|every|reduce|reduceRight|flatMap";
  new RegExp(String.raw`\.(?:${methods})\(\s*(?:\([^()]{0,80}\)|[A-Za-z_$][\w$]*)\s*=>[^;{}]{0,200}?!\s*[A-Za-z_$][\w$]*\.remake\b`, "g")
  ```
  The `[^;{}]` gap is load-bearing: it spans newlines but stops at a statement boundary, so a `.map()` early in a file cannot cross-pair with an unrelated JSX `{!match.remake && …}` later. Do **not** "simplify" it to `[\s\S]`. Copy the 9 must-NOT-flag strings in as literal fixtures with inline `expect(regex.test(fixture)).toBe(false)` so the next editor has a guard rail.
- **Extend the doc comment at `:65-67`** to record: why it is whole-text now; and that it is a **backstop only** — it cannot see `if (m.remake) continue` loop guards (11 live sites), block-bodied arrows, `m.remake === false`, destructured params, or a helper that never types the token. `buildOutcomeSignal`'s streak bug (chunk 11) is exactly that last case.
- **Validation** — `pnpm --filter @vyoh/api test src/conventions.spec.ts` — must be 4/4. Verified: with chunk 11's fixes applied, hits are `[]`; without them, this one `it()` fails with exactly the 2 expected hits.
- **Note updates** — tick F-5 in `state-review-2026-07-25.md` + the open-work line.
- **Effort** — 25 min.
- **Blocked by** — **11.** Landing this first makes `test:cc` red on main.

### 13. `refactor: extract champion-scoped analytics into its own service` — **LANDED 2026-07-26**

- **Scope** — new `apps/api/src/lol/lol-champion-analytics.service.ts`, new `apps/api/src/lol/lol-champion-analytics.service.spec.ts`, `apps/api/src/lol/lol-analytics.service.ts`, `apps/api/src/lol/lol-analytics.service.spec.ts`, `apps/api/src/lol/lol.controller.ts`, `apps/api/src/lol/lol.controller.spec.ts`, `apps/api/src/lol/lol.controller.endpoints.spec.ts`, `apps/api/src/lol/lol.module.ts`, `CLAUDE.md`, `docs/working-notes/parked.md`, `docs/working-notes/cross-cutting/project-hygiene-2026-05-31.md`
- **What changes** — 1443L file, watch trigger at ~1250L fired. Move the five methods whose route lives under `champions/:championKey/`.

**[corrected] The original line map was wrong and would have cut mid-method.** Re-derived in the main thread against the current 1443-line file: `constructor` **140** (not 143), `getChampionExtras` **146**, `getChampionRecap` **203** (not 194), `getDuos` 266, `getChampionBuildFlow` **1133** (not 1128), `getChampionRuneDiversity` **1217** (not 1212), `getChampionLanePhase` **1282** (not 1275), `getPregameCalibration` 1381. ~~The prescribed `:146-261` would have left a dangling tail of `getChampionRecap` (which runs to ~265), and `:1128-1380` would have started inside `getDamageProfile`'s tail.~~

**[corrected again, at implementation]** That last sentence was wrong, and the original `:146-261` / `:1128-1380` were right. Both "tails" it warns about are doc comments belonging to the *next* method, not method bodies. Verified line by line against the pre-split file:

| Line | Content |
|---|---|
| 260 | `}` — end of `getChampionRecap` |
| 261 | blank |
| 262–265 | `// Duo detection. …` — `getDuos`' comment, must stay |
| 1126 | `}` — end of `getDamageProfile` |
| 1127 | blank |
| 1128–1132 | `// Champion build-flow: …` — must move |

Deleting `146–265` would have stripped `getDuos`' doc comment; deleting `1133–1380` would have orphaned the build-flow comment onto `getPregameCalibration`. The **method** line numbers in the paragraph above are correct and were confirmed by `documentSymbol`; only the range conclusion drawn from them was not. Lesson: a method's start line minus one is not its predecessor's end line whenever a doc comment sits between them.

Correct contiguous deletion ranges: **`:146-265`** (extras + recap) and **`:1133-1380`** (buildFlow + runeDiversity + lanePhase). Re-derive once more before cutting — earlier chunks do not touch this file, but confirm rather than trust. The seam is clean: it takes the file's **only** `LolService` coupling (`this.lol.` at exactly :153 and :209), **all** of `matchTimelineCache` (:1160, :1319), and calls **none** of the private helpers (`loadOwnerMatchCache`, `ownerTeammates`, `qualifiesAsRecurring`, `hasSameSessionPair`, `subsetsOfAtLeast2`, `calibrationCache`).
  - Delete `:146-261`, `:1128-1380`, **`:36-40`** (include the preceding blank line — deleting only :37-40 leaves consecutive blanks and `check:cc` fails), ctor line `:143`, and nine dead imports (`ChampionBuildFlowEntry`, `ChampionExtras`, `ChampionLanePhase`, `ChampionRecap`, `ChampionRuneDiversityEntry`, `deriveChampionRecap`, `RiotMatchTimeline` :28, `LolService` :29, `frameAtMinute`/`resolveParticipantId` :31). **Keep `MatchSummary` (:14)** — still used at `:1437`. Duplicate `queueTypeName`, `excludeRemakes`, `ForbiddenException`, `PrismaService`, `IdentityService` into both files.
  - Controller: **append** the new param last (so the positional `new LolController(...)` at `lol.controller.endpoints.spec.ts:30-35` only gains an argument), retarget `:186, :200, :214, :250, :263` to `this.championAnalytics.`. Leave `:228` (`getChampionDamageProfile` → `this.analytics.getDamageProfile`) — that method is dual-scope and stays. Note in the commit message that the champion route family is now served by two services.
  - Add `{ provide: LolChampionAnalyticsService, useValue: {} }` to **both** provider arrays in `lol.controller.spec.ts` (`:20` and `:47`) or `compile()` throws.
  - Spec split at describe boundaries — 3 contiguous cuts (`:46-247`, `:837-1136`, `:1244-1472`), 21 tests moving, 44 staying. Prune the remaining harness: drop `import type { LolService }` (:6), the `lol` stub (:40-42), the `resolveSummoner` opt, the third ctor arg (:43), `matchTimelineCache` (:15, :26). The new spec's `match.findFirst` stub is dead — drop it.
  - **Keep the move byte-identical.** Two pre-existing defects inside the moved code must NOT be fixed here (file both as follow-ups): `getChampionExtras`/`getChampionRecap` are the only two of 16 methods with no `isLolAccountAllowed` check (no Nest guards exist anywhere in `apps/api/src`); and `getChampionExtras` applies **no remake filter at all** (where clause `:157-162` has no `remake: false`, body never calls `excludeRemakes`) — a third F-5 failure class.
  - Result ≈ 1059L remainder + ~400L new. Under 1250, ~190 lines of headroom, watch stays live.
- **Validation** — `pnpm run typecheck:cc` (catches over-pruning only — no `noUnusedLocals`, and Biome 1.9's `noUnusedImports` is not in `recommended`, so `ugrep -c` each of the nine pruned symbols against the remainder to prove under-pruning is clean). Then **[corrected]** `pnpm --filter @vyoh/api test src/lol/lol-analytics.service.spec.ts src/lol/lol-champion-analytics.service.spec.ts src/lol/lol.controller.spec.ts src/lol/lol.controller.endpoints.spec.ts` — expect 93. (The original `cd apps/api && npx vitest run` is off house style and `cd` in a compound call trips this environment's tool discipline.) Add `pnpm --filter @vyoh/api test --coverage` too — this chunk adds an `@Injectable` constructor, i.e. +1 to the function denominator, and api functions carry only 5 of margin after chunk 5. Then `pnpm run check:cc`. Diff-review `lol.controller.ts`: no decorator, path, DTO, `@Query` pipe, or return-type edits.
- **Note updates** — `parked.md:59` (stale counts: says 833L, and `lol-static-sync.service.ts` is 1076L not 1031L; record the trigger fired and was actioned, plus the new counts); `project-hygiene-2026-05-31.md:73, :200, :207` (the `:207` sketch's `CalibrationService` half is insufficient — 1443 − ~75 = ~1368, still over trigger; the `MatchupService` half is what this commit does); `CLAUDE.md:25` add `lol-champion-analytics.service.ts` to the remake-filter reference list; tick F-4 in the state review + open-work line.
- **Effort** — 2 h. One context window (mechanical move + 4 note edits).
- **Blocked by** — 5 (avoids re-baselining coverage twice; the move itself is coverage-neutral but changes lcov paths).

### 14. `docs: repair stale paths in the auto-loaded docs`

- **Scope** — `README.md`, `CLAUDE.md`, `docs/repo-conventions.md`, `docs/case-studies/README.md`, `docs/working-notes/open-work.md`
- **What changes** —
  - `repo-conventions.md:207` — `steam/game.$appid.tsx` → `steam/library/$appid.tsx` (renamed in `1a2a3d87`). Also correct the recipe in the same sentence: children are `rounded-lg border` + frosted `bg-card/60 backdrop-blur-sm` by default (`game-about-block.tsx:127,148-149`; `$appid.tsx:296` passes `frosted`), not `bg-card/50`. The Identity-band sentence stays — `$appid.tsx:208` is still `rounded-lg border bg-card/50 p-4`.
  - `repo-conventions.md:344` — `match-detail-tab-nav.test.tsx` does not exist. Substitute `apps/web/src/steam/wishlist/wishlist-tabs.test.tsx` (asserts `getByRole("tab")`/`("tablist")`, `aria-selected`/`aria-controls`/`tabindex` at `:83-87`, arrow-key roving at `:100`, axe at `:113`). **Do not** substitute `match-detail-tabs.test.ts` — it is pure route→tab-id logic with zero ARIA assertions.
  - `CLAUDE.md:21` — `lol/_shared/splash-backdrop.tsx` → `lol/_shared/assets/splash-backdrop.tsx`.
  - `CLAUDE.md:25` — not a broken link; an attribution defect. Add `packages/shared/src/lol/remake.ts` (`REMAKE_DURATION_S = 210` at `:9`, `isRemakeMatch()` at `:11`) as source of truth, keep the three consumers, and correct the third path to `apps/api/src/scripts/backfill-remake-flag.ts`.
  - `README.md:14` — drop `patches` from the account-scoped list (no such route; removed per `patches-as-global-surface.md:3`), add the global `/lol/patches` + `/lol/patches/$version`.
  - `README.md:17` — `/steam/game/$appid` → `/steam/library/$appid` (old URL 404s, no redirect exists).
  - `README.md:33`, `README.md:54`, `CLAUDE.md:14` — pnpm 10 → 11 (`package.json:4` is `pnpm@11.1.1`). Node 22 / Biome 1.9 / TypeScript 6 claims are all current — leave them.
  - `README.md:101` + `open-work.md:68` — 19 case studies → 21.
  - **[corrected — added]** `README.md:79` states CI runs `pnpm -r test --coverage`. Chunk 9 changes that command to `pnpm -r --no-bail test --coverage`. It is a public-facing accuracy claim in a file this chunk already opens — fix it here so it does not become the next sweep's F-8.
  - `README.md:29` + `README.md:46-47` — add `tools/perf-probe` (`@vyoh/tools-perf-probe`, Playwright compositor/paint probe behind the per-route budgets). The tree edit changes `└── champion-assets/` to `├──` and adds a `└── perf-probe/` sibling; `tools/` is the last top-level entry so its own glyph is unchanged.
  - `docs/case-studies/README.md` — insert the missing inventory row for `nav-hover-dropdown-primitive-choice.md` between `:21` and `:22` (alphabetical), title from its H1: "Picking the right Radix primitive for a hover-and-click nav dropdown". Satisfies the rule the file states at its own `:38`.
- **Validation** — no `check:cc` gate (Biome has no Markdown support). Instead: `ugrep -n 'pnpm 10 workspaces|pnpm 10,' README.md CLAUDE.md` → zero (do **not** grep bare `pnpm 10` over `docs/` — `frontend-2026-gaps.md:423` correctly says "catalogs supported since pnpm 10"); `ls docs/case-studies/*.md | ugrep -v README | wc -l` = the inventory row count = 21; re-resolve every markdown link in the five files.
- **Note updates** — tick F-6, F-8, F-11 in `state-review-2026-07-25.md` + the open-work line. Add a separate open-work item: commit `8e486fdf` deleted `match-detail-tab-nav.test.tsx` **and** the ARIA tab semantics together — `match-detail-tabs.tsx` renders no `role`/`aria-*` today, and `wishlist-tabs.tsx` is the only `role="tab"` left in apps/web. Decide whether that is intentional.
- **Effort** — 40 min.
- **Blocked by** — 2 (needs the open-work index line to exist).

### 15. `docs: point the steam notes at the current game-detail route`

- **Scope** — `docs/working-notes/steam/api-surface-survey.md`, `docs/working-notes/steam/game-detail-enrichment.md`, `docs/working-notes/steam/steam-integration.md`, `docs/working-notes/cross-cutting/frontend-2026-gaps.md`
- **What changes** — 67 stale references across 19 files; fix only the Active/Index notes making live or forward-looking claims.
  - `api-surface-survey.md` (Status: Active) — all 8 hits (`:21, :35, :80, :89, :99, :117, :165, :169`), forward-looking render targets for unshipped chunks.
  - `game-detail-enrichment.md` (Status: Index, header itself carries the dead path) — `:3, :5, :34, :68`.
  - `steam-integration.md` (Status: Active, canonical) — **two disjoint edit sets, never a file-wide replace.** Regex-form (`$appid`, 18 hits): fix **only `:94`**; leave `:199, :213, :242, :272, :280, :335, :341, :351, :369, :374, :377, :384, :398, :406, :414, :434, :437` (dated shipped-chunk records with SHAs). Colon-form (`:appid`, 7 hits): fix `:22, :132, :333`; leave `:194, :257, :315`. `:22` also says "mirroring `/champion/:name`" — that route never existed (actual `/lol/$accountSlug/champions/$championKey`).
  - `frontend-2026-gaps.md` (Status: Active) — `:360, :583, :829` are unshipped plans; `:383` is an audit snapshot where the fact holds and only the filename is stale.
- **Trap** — `/steam/game/:appid` is a **live API path**. `steam.controller.ts:41` `@Controller("steam")` exposes `game/:appid/{achievements,description,screenshots,unlock-timeline,recap}`. `library-card-enrichment.md:171,:218` and `steam-integration.md:257` are correct and must not be touched. (`steam-integration.md:315` references a `/media` endpoint that no longer exists — leave it, it is a superseded historical record, but the "still-valid" justification for leaving it is false.)
- **Leave alone** — all 11 archive/shipped notes, plus `landing-showcase-arc.md:41` (shipped-then-rescoped record).
- **Validation** — `ugrep -rc 'steam/game\.\$appid|/steam/game/\$appid' --include='*.md' README.md CLAUDE.md docs/` should go **71 lines / 20 files → 52 lines / 15 files** (simulated). The five files that must reach **zero** are `README.md`, `repo-conventions.md`, `api-surface-survey.md`, `game-detail-enrichment.md`, `frontend-2026-gaps.md`; `steam-integration.md` should still read 17. Then `ugrep -rn '/steam/game/:appid' --include='*.md' .` — every surviving hit must be an API path.
- **Note updates** — tick F-7 in `state-review-2026-07-25.md` + the open-work line.
- **Effort** — 30 min.
- **Blocked by** — 14 (same verification grep spans both).

### 16. Drop the two superseded stashes — **task step, not a commit** [corrected]

- **Scope** — git stash only (no files)
- **What changes** — `git stash drop 'stash@{1}'` **first**, then `git stash drop 'stash@{0}'` (dropping 0 first makes `stash@{1}` nonexistent). Neither has a 3rd-parent untracked commit (`git rev-parse -q --verify 'stash@{N}^3'` → rc=1 both), so the shown patches are complete. Both are fully superseded: stash@{0} and stash@{1}'s routeTree hunks are byte-identical and register an account-scoped `/lol/$accountSlug/patches` route that `patches-as-global-surface.md:3` records as **deliberately removed**; stash@{1}'s only other content is the `ChangeKindGlyph` extraction, already shipped byte-identically at `apps/web/src/lol/patches/change-kind-glyph.tsx:7-24` with its own test, plus a Patches TABS entry the same decision removed (`$accountSlug.tsx:53-57` now has 4 entries).
- **Validation** — `git stash list` → empty.
- **Note updates** — tick F-9 in `state-review-2026-07-25.md`.
- **Effort** — 2 min. Not a commit; fold the note tick into whichever commit lands alongside.
- **Blocked by** — nothing.

### 17. `chore: drop the inert scroll-snap class and its stale rationale`

- **Scope** — `apps/web/src/routes/index.tsx`, `apps/web/src/routes/__root.tsx`, `apps/web/src/home/recap/use-chapter-nudge.ts`
- **What changes** — `[scroll-snap-align:start]` at `routes/index.tsx:61` is the last stale vertical-snap class in the app. No `scroll-snap-type` exists on `<main>` (`__root.tsx:192`), the wrapper (`:194`), the page (`index.tsx:48`), in any CSS file, or in `index.html`. The only live snap is the horizontal thumbnail rail at `screenshot-lightbox.tsx:112,166` — leave it.
  - Remove the class. Remove the 4-line rationale at `index.tsx:57-60` ("under `scroll-snap-type: y mandatory`").
  - `__root.tsx:188-191` — delete the trailing sentence "Stale [scroll-snap-align] / [scroll-snap-stop] classes still live on a few chapters…". **Keep `:182-187`** (the persistent-frame rationale), still true and load-bearing.
  - **[corrected] Deliberately left alone:** `self-portrait-recap-arc.md:367` ("the fade runs concurrent with the browser's native scroll-snap motion") and `r13-exit-dissolve.md:36` ("Scroll-snap untouched…") both assert a mechanism that will no longer exist anywhere. Both are historical notes recording past state, so leaving them is correct — but state it rather than being silent, the way chunk 15 lists its exclusions.
  - `use-chapter-nudge.ts:50-57` — the paragraph asserts the chapter snap is "delegated to CSS `scroll-snap-type: y proximity` on `<main>` plus `scroll-snap-align: start`". Neither exists. Rewrite to state the hook owns only the one-shot reveal-cascade trigger, no CSS snap involved (matching `chapter-multi-beat.tsx:90,108`). `:27`'s "tuned to the CSS scroll-snap settle" is a historical note on SETTLE_MS — leave it.
- **Validation** — `pnpm run check:cc`, `pnpm run typecheck:cc`, `pnpm --filter @vyoh/web test --coverage` **[corrected — `--coverage` added]**. No test file exists under `apps/web/src/routes/`. Scroll `/` once end-to-end; the hero rest position is owned by `LandingHeading`'s cascade and `whileInView` (`routes/index.tsx:19-22`), not by snap.
- **Note updates** — tick F-12 in `state-review-2026-07-25.md`.
- **Effort** — 20 min.
- **Blocked by** — nothing.

### 18. `fix: drop the unnecessary navigate cast in the command palette`

- **Scope** — `apps/web/src/components/command-palette-dialog.tsx`
- **What changes** — `:284-285`: delete the `biome-ignore` and the `as any`. `RecentItem.path` is `string` (`command-palette-recents.ts:6-10`), and `useNavigate()`'s `to` widens to `string` when the argument is not a literal (`MakeToRequired` falls through to `OptionalToOptions`). Type-probed against the repo's real tsconfig: `navigate({ to: item.path })` produces no diagnostic, while a literal control `navigate({ to: "/definitely-not-a-route" })` in the same program errors TS2322 against the full route union — so the `Register` augmentation is live and the clean result is not an artifact. Replace with an explanatory comment: palette paths arrive already resolved, some carry query strings (`:420`, `:741`), and some come back from `loadRecents()` (localStorage), so no route-union type applies.
- **Do not** switch to `navigate({ href: item.path })` — it typechecks but takes a different runtime path (`router.js:459-465` probes `new URL(href)` and can force `reloadDocument`) and breaks the `{ to: … }` assertions in the test file.
- **Validation** — `pnpm run typecheck:cc`, `pnpm --filter @vyoh/web test --coverage` **[corrected — `--coverage` added]**, plus the focused `pnpm --filter @vyoh/web test src/components/command-palette-dialog.test.tsx`, then `pnpm run check:cc`. Note Biome 1.9.4 **does** report `suppressions/unused` (verified), so an orphaned `biome-ignore` would surface in `check:cc` immediately.
- **Note updates** — tick F-13 in `state-review-2026-07-25.md`.
- **Effort** — 10 min.
- **Blocked by** — nothing.

### 19. `fix: make the detail-panel dispose idempotent and pin the contract`

- **Scope** — `apps/web/src/lib/scroll-container-context.tsx`, new `apps/web/src/lib/scroll-container-context.test.tsx`, `apps/web/src/components/scroll-to-top.test.tsx`
- **What changes** — **This is hygiene, not coverage.** `scroll-container-context.tsx` already reads FNF:8 FNH:8 / LF:21 LH:21 in lcov (reached indirectly through `slide-panel.test.tsx`), so it moves none of the three failing web thresholds — its only headroom is 2 branches, and branches already passes.
  - `:54-57` dispose closure decrements unconditionally, so a double-invoked cleanup drives `openPanelCount` negative and latches `open` off for the page session. Add `let released = false; if (released) return; released = true;`. Not reachable from app code today (the sole producer is the effect at `slide-panel.tsx:99-102` and React never double-invokes a cleanup) — defensive hardening.
  - New sibling test: no-registration → false; register → true; dispose → false; two registrations, dispose one → still true; double-dispose then re-register → true (green only with the guard); register **before** `renderHook` → true on first render (covers the `useState(openPanelCount > 0)` initializer at `:61`); post-unmount register/dispose does not throw (covers `listeners.delete` at `:65`). `openPanelCount`/`listeners` are module singletons shared with `scroll-to-top.tsx` — **each case must leave the counter at exactly 0**; the module exports no reset, so balance inside the case. Do not use `vi.resetModules()`.
  - `scroll-to-top.test.tsx` — append the integration case, and **await the exit**: `reducedMotion="always"` suppresses transform values, not AnimatePresence's deferred unmount (verified: `queryByRole` immediately after registering still returns the button carrying `opacity: 0; transform: translateY(10px) scale(0.8)`). Use `waitForElementToBeRemoved(btn)`.
- **Validation** — `pnpm --filter @vyoh/web test src/lib/scroll-container-context.test.tsx src/components/scroll-to-top.test.tsx`, run twice to catch module-state leakage. Then `pnpm --filter @vyoh/web test --coverage` **[corrected — added]**, `pnpm run typecheck:cc`, `pnpm run check:cc`.
- **Note updates** — tick F-10 in `state-review-2026-07-25.md`.
- **Effort** — 45 min.
- **Blocked by** — nothing.

### 20. `chore: bump typescript to 7`

- **Scope** — `package.json`, `tools/perf-probe/package.json`, `tools/champion-assets/package.json`, `pnpm-lock.yaml` **[corrected]**
- **What changes** — **[corrected] `typescript` is pinned in three files, not one** — `package.json:29`, `tools/perf-probe/package.json:14`, `tools/champion-assets/package.json:16`, all `^6.0.3`. Bumping root alone leaves two packages resolving TS 6, installs two compiler copies, and falsifies this chunk's own claim that both tools `tsc --noEmit` clean under 7. Bump all three. **`pnpm-lock.yaml` must be in scope** — CI runs `pnpm install --frozen-lockfile` at `ci.yml:26` and `:83`, so a `package.json`-only bump fails both the `check` and `bundle-size` jobs with `ERR_PNPM_OUTDATED_LOCKFILE`. Every dependency commit in this repo's history carries the lockfile. Root devDependency `"typescript": "^6.0.3"` → `"^7.0.2"` at `:29`. **No script change needed** — `tsc -b --noEmit` from `apps/web` returns rc=0 under 7.0.2 (TS5023 fires only when `-b` is not the first argument; the repo's script already has it first). Every package typechecks clean under 7: `apps/web` `tsc --build --force` rc=0, and `packages/shared` / `apps/api` / `tools/champion-assets` / `tools/perf-probe` each `tsc --noEmit` rc=0. No `baseUrl` in any of the 9 tsconfigs, no package imports the compiler API, and the eight declared `typescript` peer ranges (`@nestjs/schematics >=4.8.2`, `@prisma/client >=5.4.0`, `prisma >=5.4.0`, `valibot >=5`, `cosmiconfig >=4.9.5`, `fork-ts-checker-webpack-plugin >3.6.0`) are all open-ended.
- **Validation** — `pnpm install`, then `pnpm run typecheck:cc`, `pnpm -r --no-bail test --coverage`, and sanity-check a `tsx`-driven script (`apps/api/src/scripts/run-patch-sync.ts`) still runs.
- **Note updates** — tick F-14 (typescript) in `state-review-2026-07-25.md`.
- **Effort** — 20 min.
- **Blocked by** — 9 (so the bump is validated against a CI gate that actually fails).

### 21. `chore: bump size-limit to 13`

- **Scope** — `apps/web/package.json`, `pnpm-lock.yaml` **[corrected — lockfile added, same `--frozen-lockfile` reason as chunk 20]**
- **What changes** — `@size-limit/file` and `size-limit` `^12.1.0` → `^13.0.1` (`:58`, `:75`). Engines satisfied (`^22.18.0 || ^24.0.0 || >=26.0.0`; runtime 22.22.2, `.nvmrc` = `22`).
- **Must land after chunk 10** — that chunk rewrites `.size-limit.cjs` from a single glob to a runtime-derived multi-path array, so v13's glob handling becomes the variable under test. Record the v12 number immediately after chunk 10 lands, then bump and compare.
- **Validation** — `pnpm install`, then `pnpm --filter @vyoh/web build && pnpm --filter @vyoh/web size` (both entries report, number unchanged from the chunk-10 baseline), and `pnpm --filter @vyoh/web size:cc` (confirm `--silent` still parses).
- **Note updates** — tick F-14 (size-limit) in `state-review-2026-07-25.md`.
- **Effort** — 15 min.
- **Blocked by** — 10.

### 22. `chore: unify the playwright pin across the workspace` [corrected — new]

- **Scope** — `package.json`, `tools/perf-probe/package.json`, `pnpm-lock.yaml`
- **What changes** — Commit `26590e8b` bumped `playwright` in two packages to **two different versions**: root `^1.60.0` → `^1.61.1` (`package.json:28`), `tools/perf-probe` `^1.60.0` → `^1.62.0` (`tools/perf-probe/package.json:12`). They were unified before. Consequences, all confirmed live: the lockfile carries both `playwright@1.61.1` and `@1.62.0` plus both `playwright-core` copies; each minor wants a **different chromium build** (1228 vs 1234), so two ~300 MB browser sets; and `pnpm exec playwright install chromium` from the repo root resolves root's 1.61.1 and installs the **wrong** build, leaving the probe still broken with no useful error. Unify both at `^1.62.0`.
- **Why it matters** — this is the repo's only perf-measurement tool, and `repo-conventions.md` § "Layer-count + paint budget per route scenario" makes re-probing mandatory for several classes of change. It was dead from 12:51 on 2026-07-25 until the state review diagnosed it, and nothing caught it (the probe is not in CI, by design).
- **Validation** — `pnpm install`, then `pnpm --filter @vyoh/tools-perf-probe exec playwright install chromium`, then `pnpm --filter @vyoh/tools-perf-probe probe -- --scenario lol-overview` against a running dev server. **Discard the first run** (see chunk 23).
- **Note updates** — tick the §8 tooling item in `state-review-2026-07-25.md` + the open-work line.
- **Effort** — 15 min.
- **Blocked by** — nothing. Sequence early; it unblocks the conventions' own re-probe escape hatch.

### 23. `docs: record the cold-run trap in the paint-budget convention` [corrected — new]

- **Scope** — `docs/repo-conventions.md`, `docs/working-notes/cross-cutting/progressive-paint-audit.md`, `docs/working-notes/cross-cutting/perf-baseline.md`
- **What changes** — The budget block currently says only "Bracket with 3 runs before claiming a regression or improvement". It does not warn that **the first run after a dev-server restart captures a skeleton**, producing falsely-excellent numbers. Measured 2026-07-25: `lol-overview` cold read layers=3 / raster=31 ms / longTasks=0 with the load and scroll-bottom screenshots byte-identical (307,958 B) because content never arrived — while `web-vitals` still reported FCP 220 ms, so it looks like a legitimate capture. Warm runs read 21–26 layers / 49–60 ms. `recap` showed the same shape (cold 3 layers / 33 ms; warm 14 / 122–126 ms).
- **Why it matters** — anyone following the documented 3-run bracket immediately after a restart pulls their median down ~40% and reads a false improvement. This is the same failure class as F-1 and F-3: a measurement that looks green while measuring the wrong thing.
- **Add** — "discard the first run after any dev-server restart, or warm the route once before bracketing" to the how-to-apply block, plus the correct filtered install command from chunk 22 (the root-level one is a trap). Record the 2026-07-25 warm numbers in `progressive-paint-audit.md` as an observation, **not** as a re-baseline — they were taken on chromium 151/arm64 against June baselines on a different chromium, so the raster deltas (−47 ms lol-overview, −70 ms recap) are at least partly environmental.
- **Validation** — none automated (Biome has no Markdown support). Re-read the edited blocks.
- **Effort** — 25 min.
- **Blocked by** — 22.

### 24. `docs: log the 2026-07-25 hygiene arc in project history` [corrected — new]

- **Scope** — `docs/working-notes/project-history.md`, `docs/working-notes/open-work.md`
- **What changes** — **No chunk in the original plan touched `project-history.md`**, which self-describes as an append-only log of shipped arcs and structural decisions, and which the recent history writes to routinely (`346c77e7`, `354280d2`, `1ba92171`, `eb5ac211`). A 20+ commit arc that resurrects a dead CI gate, clears three coverage packages, corrects the bundle budget by ~96 kB, splits a 1443-line service, and repairs 67 stale doc references is exactly a structural decision. Append the arc entry and close out the open-work line opened in chunk 2.
- **Effort** — 20 min.
- **Blocked by** — everything it summarises; land last.

## Deferred

- **Biome 1.9.4 → 2.5.5** — its own 3-commit arc, not a small item. **Measured in-repo 2026-07-26** (superseding the ~571/189 estimate, which came from a scratchpad config scanning ~70 extra files): `biome migrate --write` converts the config cleanly in one pass, then `biome ci .` over 1,156 files reports **599 errors / 79 warnings**.

  | Count | Rule | Character |
  |---|---|---|
  | 511 | `assist/source/organizeImports` | mechanical, auto-fixable — v2 sorts named specifiers inside the braces |
  | 28 | `complexity/useOptionalChain` | auto-fixable |
  | 19 | `a11y/*` | 10 `useSemanticElements`, 5 `useAriaPropsSupportedByRole`, 3 `noStaticElementInteractions`, 1 `noSvgWithoutTitle` |
  | 15 | `suspicious/noTemplateCurlyInString` | judgement; likely false positives in fixtures |
  | 15 | `style/noDescendingSpecificity` | CSS, new in v2 |
  | 15 | `correctness/noUnknownTypeSelector` | CSS; suspect Tailwind/custom selectors |
  | 10 | `correctness/useHookAtTopLevel` | judgement, possibly real |
  | 9 | `correctness/noUnsafeOptionalChaining` | real; matches the original estimate |
  | 9 | `complexity/noImportantStyles` | CSS `!important`, probably deliberate |
  | 4+1+1+1+3 | `noArrayIndexKey`, `useIterableCallbackReturn`, `noUnusedVariables`, `noUnusedImports`, `noUnknownProperty` | small tail |

  **The blocker on landing it piecemeal:** ~88 findings survive the auto-fixes, so a mechanical-only first commit leaves `check:cc` red, which breaks the pre-commit gate and main. Any staged plan has to either fix them all in one commit or deliberately set the unresolved rules to `off` with a tracked note, which is an owner decision rather than a mechanical one.

  Note the CSS weight: five of the ten judgement rules (`noDescendingSpecificity`, `noUnknownTypeSelector`, `noImportantStyles`, `noUnknownProperty`, `noUnknownMediaFeatureName`) are CSS rules v2 enables and v1 did not. Biome 2 also fails to parse `apps/web/src/index.css` outright, which needs looking at before any of those counts can be trusted.

  Suggested shape: (1) bump + config migrate + `check --write` mechanical fixes + explicitly disable the unresolved rules with reasons, landing green; (2) CSS rules, re-enabled one at a time; (3) the correctness tail (`noUnsafeOptionalChaining`, `useHookAtTopLevel`, `noArrayIndexKey`, `useIterableCallbackReturn`).
- **`concurrently` 9 → 10** — decided in HEAD (`eb5ac211`). 10.0.3 pins `shell-quote` to an exact `1.8.4`; 9.2.4 floats to the patched `1.9.0`. Re-open only if upstream loosens the pin. Record the rationale in `docs/working-notes/ops/security.md` so the next sweep stops re-proposing it.
- **`@types/node` 24 → 26** — skip. Four packages pin `^24.13.3` while the runtime is Node 22; 26 makes the types four majors ahead of the runtime with a silent failure mode. The correct direction is `^22`, which is a separate decision.
- **`dropdown-menu.tsx` (12 fns) and `installViewTransitionLifecycleLogger` (8 fns)** — the two highest-value remaining web coverage targets, both behind unproven mechanisms. Radix DropdownMenu does not open in happy-dom (`matches-breadcrumb.test.tsx:64`); unlocking it likely needs `Element.prototype.hasPointerCapture` + a ResizeObserver stub in `test-setup.ts` (6 lines, cleanup only), which would be its own commit and unlock every future Radix-menu test. The VT logger needs `localStorage["vt-debug"]` + a fake `document.startViewTransition` + `vi.resetModules()` + a fresh module import in a **new** file (its `__vtLoggerInstalled` one-shot guard cannot be reset, and `view-transition-nav.test.ts`'s own setVT/clearVT helpers mutate the same property). Simplest alternative: export the function — it is dev-only tooling.
- **`getChampionExtras` missing whitelist check + missing remake filter** — two real defects inside the code chunk 13 moves. Keep the move byte-identical; file both as a follow-up with a `getChampionExtras` remake test.
- **The 11 `if (m.remake) continue` aggregation sites** — genuine invariant violations invisible to any regex lint (`role-baselines.ts:74`, `champion-pool-drift.tsx:38`, `champion-position-heatmap.tsx:72`, `champion-stats.ts:75`, `patches-page.tsx:470`, `profile-patch-notice.tsx:30`, `profile-role-strip.tsx:32`, `trend-death-matchup-heatmap.tsx:46`, `trend-role-performance.tsx:35`, `trend-worst-matchup.tsx:28`, `champion-of-year.ts:23` — fixed in chunk 3). Own session: convert each to `for (const m of excludeRemakes(matches))` plus a second lint pattern scoped to `continue` only (which auto-excludes the legitimate `match-hero.tsx:57` display guard). `trend-death-matchup-heatmap.tsx:46` has a compound guard needing the other two conditions preserved.
- **`LolSocialAnalyticsService` (second seam)** — pre-specified for when the analytics remainder next approaches 1250L: `getDuos`, `loadOwnerMatchCache`, `getSquads`, `getChampionPairs` + the five module helpers + `DUO_*` consts ≈ 425L out. Not needed now (~190L of headroom after chunk 13).
- **Shared branch headroom** — `steam/game-recap.ts` has 26 uncovered branch paths / 0 uncovered lines with an existing sibling test (~+3.06pp branches). Only worth it if the branch threshold is ever raised.
- **`docs/case-studies/frontend-perf.md:180-190` and `frontend-2026-gaps.md:477`** — same stale 200 kB / wrong-config-file claims as `perf-baseline.md`. Published narrative; own commit after chunk 10.
- **`og-image-pipeline.md:103`** — documents `/og/steam/game/:appid.png`; actual is `/og/steam-game/:appid.png` (`og.controller.ts:60`). Shipped note, low value.
- **Committed-generated-file CI guard** — regenerate `routeTree.gen.ts` and `git diff --exit-code`. New gate, not part of chunk 1.

## Open decisions

1. **Bundle limit (blocks chunk 10).** The owner accepted ~235 kB against a "current honest 224.43 kB". `@size-limit/file` sums per-file gzip level 9, not concat gzip, so the gate will print **229.53 kB** — verified by exact calibration (the same algorithm over the index chunk alone gives 133,783 B, byte-identical to size-limit's printed 133.78 kB). 235 kB is **5.47 kB / 2.38% headroom**, one dependency bump from red; 240 kB gives 4.4%. (The ~10% figure in `frontend-perf.md:190` is case-study prose, not enforced policy — the 2026-05-29 raise gave "a small headroom" by its own comment.) **[corrected]** Recommend closing this at **240 kB**, not 235. The gate will print ~229.35 kB (decimal — see chunk 2), so 235 leaves 5.65 kB / 2.4% of headroom, which is inside a single dependency bump; chunk 21 bumps size-limit itself in this same arc. 240 kB gives ~4.4%.

2. **`champion-recap.ts:459` (blocks chunk 4).** Delete the block, or lower the `>= 0.5` bar below the `> 0.45` at `:346` if a distinct context-line threshold was the intent? The comment at `:456-458` says "skip the aggression context-line when the primary verdict is already aggressive" — and it always is, so the block has no purpose. Recommend deletion.

3. **`profile-post-game.tsx` `history` scope (affects chunk 11's shape).** Option (a): the minimal `:42` fix plus routing the `:137` `history.length < 8` sample gate through the helper. Option (b): filter once at `:324` (`history: excludeRemakes(matches)`), which subsumes (a), fixes the gate, and collapses the now-redundant `excludeRemakes(history)` calls at `:156/:157/:187` to plain `history`. Traced safe either way — `buildBaselineSignal` touches only `last`, `computeTiltStats` already filters internally, `buildChampionReadSignal` only narrows further. (b) changes the `<8 games` gate's behaviour (remakes stop counting toward the sample), which is arguably correct but is a behaviour change. Recommend (b).

4. **Branch protection.** If "Lint, format, typecheck, and test" is a required status check, chunk 9 blocks all merges until chunks 3–8 are in — which is why they come first. `gh` is unauthenticated in this container, so this was not verifiable; confirm before landing chunk 9 out of order.
4. **Branch protection (blocks chunk 9's landing strategy). [corrected — new]** If "Lint, format, typecheck, and test" is a required status check, chunk 9 blocks every merge from the moment it lands until coverage is green. The plan's mitigation is only "land it after chunks 3–8", which is right but offers no fallback if something regresses mid-arc. Concrete fallback worth having ready: land chunk 9 with `continue-on-error: true` on the test step for one commit, confirm the step reports red in the UI without blocking the queue, then strip the flag in an immediate follow-up. That decouples "prove the gate can fail" from "block the queue". Check the branch-protection setting before starting chunk 3.

---

## Corrections applied to the generated plan

Logged so the reasoning is auditable rather than silently overwritten.

| # | Correction | Source |
|---|---|---|
| 1 | Chunk 13's method line map was wrong at 5 of 8 positions; the prescribed deletions would have cut mid-method | critic, re-derived in main thread |
| 2 | Bundle figure is a binary-vs-decimal kB error, not a gzip-level one; true overshoot is 19.35 kB, and the review was corrected directly | main thread |
| 3 | Chunk 1's premise ("dirty in the tree") was wrong about provenance — the tree was clean at `eb5ac211`; the plugin bump regenerates it | main thread |
| 4 | Root `coverage:cc` has both defects chunk 9 fixes in CI; folded into that chunk's scope | critic |
| 5 | Chunk 6 split into 6a/6b | critic |
| 6 | Chunks 20 and 21 omitted `pnpm-lock.yaml`; `--frozen-lockfile` in CI would fail both jobs | critic |
| 7 | Chunk 20 omitted two of three `typescript` pins | critic |
| 8 | Chunks 11, 13, 17, 18, 19 mutate source inside coverage globs but did not validate with `--coverage` | critic |
| 9 | Chunk 16 carried a commit title for something that produces no tree change | critic |
| 10 | Playwright split and the cold-run trap were absent from the plan entirely — added as chunks 22 and 23 | critic |
| 11 | `project-history.md` was untouched by any chunk — added as chunk 24 | critic |
| 12 | Chunk 13 validation used `cd apps/api && npx vitest`, off house style | critic |
| 13 | `README.md:79` CI-command claim added to chunk 14 | critic |
| 14 | Bundle limit recommendation moved from 235 kB to 240 kB (2.4% → 4.4% headroom) | critic |
| 15 | Chunk 17's deliberately-untouched historical notes now stated explicitly | critic |

Nine of the nine investigations were flagged as not fully sound by their verifiers; the synthesis applied those corrections before this document was produced. The table above is the *second* round, from the completeness critic plus main-thread re-verification.
