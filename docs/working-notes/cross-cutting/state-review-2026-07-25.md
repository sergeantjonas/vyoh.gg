# State-of-the-app review — 2026-07-25

**Status:** Reference — full-sweep audit (Phases 0–6) run on `main` @ `eb5ac211`, **now executed**. The sweep itself was read-only; the arc it produced landed as 23 commits on 2026-07-25/26 and closed F-1 through F-8 and F-10 through F-13, plus F-15. F-14 is partial (`size-limit` bumped, `typescript` 7 reverted — see below). **Still open: F-9, F-16**, and the follow-ups listed in [open-work.md](../open-work.md). Per-finding resolutions are recorded inline against each finding.

---

## 1. Verdict

The codebase itself is in good shape. Lint, typecheck, and all 4,241 tests pass; package boundaries are clean; the structural-lint suite in `apps/api/src/conventions.spec.ts` is genuinely enforcing four of the repo's own conventions and passing. Type-safety discipline is unusually strong for a project this size (zero non-null assertions in production code, exactly one `as any`). No TODO/FIXME markers, no skipped tests, no dead feature flags.

**The problem is the evidence layer, not the code.** Two of the three quality gates this repo advertises are not actually gating:

1. **CI's coverage step cannot fail.** `pnpm -r test --coverage 2>&1 | tee coverage-output.log` runs under GitHub's default `bash -e` shell, which has no `pipefail` — `tee`'s exit 0 masks vitest's exit 1. Right now all three packages fail their own coverage thresholds and CI is reporting green.
2. **The bundle budget measures one chunk out of 21.** `size-limit` reports "main bundle (initial JS)" at 133.78 kB against a 210 kB limit. Actual initial JS across the entry script plus its 20 modulepreloads is **229.35 kB gzip** — 19.35 kB over the stated ceiling.

For a repo that is explicitly a portfolio case study, a green badge over a broken gate is the worst failure mode here: it undermines the exact engineering signal the project exists to demonstrate. Everything else in this report is ordinary maintenance.

**Do first:** fix the CI pipe (`.github/workflows/ci.yml:33`), then decide whether to raise coverage back over the thresholds or lower the thresholds deliberately. Both are one commit.

---

## 2. In flight

Status strings quoted verbatim from each note's `**Status:**` header.

| Arc | Status | Blocker | Next concrete action |
|---|---|---|---|
| Match-depth Phase D | "Phase D and Phase E partial: outstanding D items (LP-overlay per duo — blocked o…)" | **owner-auth** | Land owner-auth chunk 1, then the LP overlay |
| Match-depth Phase E | Partial — full rune-page panel + composite S-grade remain | None; deprioritised polish | Pick one of the two remaining items when a polish slot opens |
| LP forecast LP3 | "Phase LP1 … shipped 2026-05-14. Phase LP2 shipped 2026-05-20" | None | LP3 personal linear fit; long-tail, unscheduled |
| Owner auth | "pre-deploy work, plan written 2026-05-14, **not started**" | Pre-launch sweep timing | Prerequisite for 3 other arcs — start here |
| Hosting | "pre-deploy work, **not started**. Owner lean is Hetzner VPS … but not committed" | Decision not made | Commit to A/B/C so `head()` origin hardcoding can be resolved |
| Accounts admin | "pre-deploy work, planned 2026-06-06, **not started**" | owner-auth chunk 1 | Blocked; sequence after owner-auth |
| TanStack Start migration | "committed direction (2026-05-26). Migration will happen as part of the pre-launch sweep" | Sequenced with owner-auth + hosting | No action until pre-launch sweep starts |
| App Phase 6 | "Phases 1–5 … all shipped; Phase 6 (Mastery integration, mu…)" | None | Scope mastery integration |
| Frontend-2026 KB expansion | "decided 2026-06-12: add domain files 18-angular, 19-migrations, 20-data-visualization" | None; one per session | Write `18-angular` |
| Visual-excellence audit | "V1 … + V2 + V3 … + V5 + V8 …" shipped; V9/V10/V12 unscoped | None | Scope V9 or park explicitly |
| Steam description images A7 | "A1–A5 shipped 2026-05-26 end-to-end" | Waits on a marquee surface showing a cold window | Trigger-gated; no action |
| Security / dependency refresh | "baseline shipped 2026-05-14 … " + 2026-07-25 sweep took audit 41 → 1 | None | Closed for now; 1 accepted `file-type` advisory documented |

**Pre-deploy is the critical path.** Four separate arcs (LP-overlay-per-duo, status-page admin gating, accounts admin, TanStack Start) all queue behind owner-auth, which has been "planned, not started" since 2026-05-14.

### Drift check

The same-commit note convention **held well** for feature work. All ten LoL feature commits checked (`2cbc25b3`, `ffd0f4c6`, `8307900c`, `e37ad427`, `2c587308`, `3b5a6675`, `3cdd2172`, `2ae6f071`, `f4cd4c24`, `2decc0b4`) touched `open-work.md` plus their arc note in the same commit. CONFIRMED via `git show --stat`.

Two exceptions, both documented as findings below: commit `1a2a3d87` (Steam game-detail → slide panel, 30 files, **zero** docs) and the four dependency-bump commits that deferred their note update to the fifth commit of the sweep.

No note claims a shipped artefact that does not exist — 33 named artefacts across ~20 shipped notes all resolved. CONFIRMED.

### Uncommitted work

Working tree is clean. Two stashes, both **~10 weeks old** (2026-05-17):

- `stash@{0}` "routeTree-WIP" — 1 file, `routeTree.gen.ts` only (+21 lines). Generated-file noise.
- `stash@{1}` "patch-notes-WIP" — 3 files, includes a 20-line deletion in `profile-patch-notice.tsx`.

**Verified fully superseded, 2026-07-26** (upgraded from "almost certainly"). Neither has a third-parent untracked commit (`git rev-parse -q --verify 'stash@{N}^3'` returns rc=1 for both), so the shown patches are complete:

- Both stashes' `routeTree.gen.ts` hunks register an **account-scoped `/lol/$accountSlug/patches` route**. [patches-as-global-surface.md:3](../lol/patches-as-global-surface.md) records that route as deliberately removed ("account-scoped patches routes removed; Patches dropped from the account TABS"), and `apps/web/src/routes/lol/$accountSlug/patches.tsx` does not exist. Applying either would re-introduce a route the project chose to delete.
- `stash@{1}`'s only other content is the `ChangeKindGlyph` extraction, already shipped at `apps/web/src/lol/patches/change-kind-glyph.tsx` — diffed against the stash's parent and **byte-identical** apart from the added `export` keyword — plus the matching `TABS` entry the same decision removed.

**Not dropped.** `git stash drop` is destructive and these are owner-local, so it needs a explicit go-ahead rather than riding the plan's authorization. Drop order matters: `stash@{1}` first, because dropping `{0}` first renumbers `{1}`.

### Markers, skipped tests, dead flags

- `TODO`/`FIXME`/`HACK`/`XXX` in `apps/**/src`, `packages/**/src`, `tools/**`: **zero**. CONFIRMED.
- `.skip` / `.only` / `xit` / `xdescribe`: **zero**. CONFIRMED.
- `@ts-ignore` / `@ts-expect-error` / `@ts-nocheck`: two, both legitimate — `routeTree.gen.ts:3` (generated) and `game-screenshot-strip.test.tsx:297` (happy-dom `Image` override, commented). CONFIRMED.
- Dead feature flags: none found.

---

## 3. Validation baseline

All commands run 2026-07-25 on `main` @ `eb5ac211`.

| Command | Result |
|---|---|
| `tokf err pnpm run check:cc` | **PASS** — no errors |
| `tokf err pnpm run typecheck:cc` | **PASS** — no errors |
| `tokf test pnpm run test:cc` | **PASS** — all tests passed |
| `pnpm --filter @vyoh/web build` | **PASS** — built in 7.30s |
| `pnpm --filter @vyoh/web size` | **PASS as configured** (see F-3 — configuration is wrong) |
| `pnpm -r test --coverage` | **FAIL — exit 1** (see F-2) |

**Test totals:**

| Package | Files | Tests |
|---|---|---|
| `packages/shared` | 22 | 397 |
| `apps/api` | 86 | 1,246 |
| `apps/web` | 330 | 2,598 |
| **Total** | **438** | **4,241** |

**Coverage (actual vs each package's own configured threshold):**

| Package | Statements | Branches | Functions | Lines | Verdict |
|---|---|---|---|---|---|
| `packages/shared` | 97.07% (min 95) | 90.91% (min 89) | 99.40% (min 97) | 99.79% (min 99) | **PASS** — cleared 2026-07-25 |
| `apps/api` | 92.40% (min 92) | 83.02% (min 82) | **94.58%** (min 94) | 94.60% (min 94) | **PASS** — cleared 2026-07-25 (`fae31693`) |
| `apps/web` | 80.31% (min 79) | 64.33% | 86.12% (min 86) | 90.95% (min 90) | **PASS** — cleared 2026-07-25 |

`apps/web` branch coverage at **62.89%** is the weakest surface by a wide margin. Uncovered surfaces are concentrated in the four route-level files with no sibling test (`__root.tsx`, `routes/steam.tsx`, `routes/lol/$accountSlug.tsx`, and the two detail routes) and the large editorial chapters (`steam-chapter.tsx` 1,015L, `ahri-chapter.tsx` 945L), which are render-heavy and lightly asserted.

**Bundle sizes** (production build, gzip):

| Chunk | Raw | Gzip |
|---|---|---|
| `index-*.js` (entry) | 407.19 kB | 130.63 kB |
| `react-*.js` | 121.64 kB | 38.17 kB |
| `routes-*.js` (lazy, not preloaded) | 167.48 kB | 48.75 kB |
| `CategoricalChart-*.js` (Recharts, lazy) | 230.07 kB | 68.25 kB |
| `shaka-player.compiled-*.js` (lazy) | 807.28 kB | 265.88 kB |
| **Initial JS total** (entry + 20 modulepreloads) | — | **229.35 kB** |

`shaka-player` is correctly dynamically imported at `apps/web/src/steam/game/game-screenshot-strip.tsx:443` — it is not in the initial payload. CONFIRMED.

Against [perf-baseline.md](perf-baseline.md), which records a 181.94 kB gzip main bundle as of 2026-05-12: the *measured* chunk has improved to 130.63 kB, but the note's numbers and its stated "200 kB" budget are both stale (actual budget is 210 kB, raised 2026-05-29).

---

## 4. Findings

### Blocking

---

**F-1 · The CI coverage step cannot fail. CONFIRMED — FIXED 2026-07-25.**

**Evidence** — `.github/workflows/ci.yml:32-33`:
```yaml
      - name: Test with coverage
        run: pnpm -r test --coverage 2>&1 | tee coverage-output.log
```
The step declares no `shell:` key, so it runs under GitHub's default `bash -e {0}`, which does **not** set `pipefail`. The pipeline's exit status is `tee`'s, which is always 0. Verified locally:
```
bash -e -c 'false | tee /dev/null >/dev/null'          -> exit 0
bash -eo pipefail -c 'false | tee /dev/null >/dev/null' -> exit 1
```
And the underlying command genuinely fails today: `pnpm -r test --coverage` → **exit 1**.

Introduced by `aa134f02` (2026-05-19), whose subject line is *"ci: report test coverage via codecov + step summary with threshold gate"* — the commit that added the gate is the commit that disabled it. The `check` job's other steps (`pnpm ci:check`, `pnpm typecheck`) are unpiped and do gate correctly; only coverage is masked.

**Why it matters** — coverage has been eroding unobserved for ~10 weeks behind a green badge. This is the single highest-signal defect in the repo: a documented quality gate that does not gate.

**Fix** — add `shell: bash` to the step (opts into `-eo pipefail`), or drop the pipe and use vitest's own reporter output for the step summary.

**Effort** — 1 line + one CI round-trip to confirm red.

---

**F-2 · All three packages fail their own coverage thresholds. CONFIRMED — RESOLVED 2026-07-25.** All three now pass; `pnpm -r --no-bail test --coverage` exits 0. Note `apps/web` carried floors on statements (79) and functions (86) that the original bail-at-shared run never surfaced — functions, not lines, was the binding constraint.

**Evidence** — actual `pnpm test --coverage` output per package:
```
packages/shared  ERROR: Coverage for lines (97.63%) does not meet global threshold (99%)
apps/api         ERROR: Coverage for functions (93.15%) does not meet global threshold (94%)
apps/web         ERROR: Coverage for lines (88.73%) does not meet global threshold (90%)
```
Thresholds set in `packages/shared/vitest.config.ts:14`, `apps/api/vitest.config.ts:19`, `apps/web/vite.config.ts` (coverage block from :116). The web thresholds were last set in `9a0f608c` (2026-05-26, *"test: unify vitest includes, full coverage thresholds"*).

**Why it matters** — this is what F-1 was hiding. Fixing F-1 without fixing this turns CI red immediately.

**Fix** — two defensible options, and the choice is the owner's: (a) write tests to clear the gaps — shared needs ~14 lines, api needs ~9 functions, web needs ~210 lines; or (b) re-baseline the thresholds to just under current actuals and treat them as a ratchet. Given `packages/shared` sits at 97.63% against a 99% floor that the note at `vitest.config.ts:12-13` describes as "well below current (100% lines)", that comment is itself stale and (b) is reasonable there.

**Effort** — (b) is one commit. (a) is one focused session for shared+api; web is larger.

---

### Should fix

---

**F-3 · The bundle budget measures 1 of 21 initial chunks, and the true number is over the limit. CONFIRMED — FIXED 2026-07-25.** The config now derives its file list from `dist/index.html` and throws on a partial parse; limit set to 240 kB against a measured 229.5 kB. See [perf-baseline.md](perf-baseline.md) § "Initial-JS re-baseline".

**Evidence** — `apps/web/.size-limit.cjs:9-15` defines the budget as a single glob:
```js
  {
    name: "main bundle (initial JS)",
    path: "dist/assets/index-*.js",
    limit: "210 kB",
```
`pnpm --filter @vyoh/web size` reports `133.78 kB gzipped` against that limit — a pass. But `dist/index.html` loads the entry script plus **20 `modulepreload` links**, all of which are initial payload. Summing gzip across all 21: **229.35 kB** — 19.35 kB over the 210 kB ceiling. Notable preloaded chunks the budget ignores: `react-*.js` (38.17 kB), `Match-*.js` (15.81 kB), `useQuery-*.js` (7.96 kB).

This is almost certainly fallout from the Vite 8 / rolldown chunking change, which split the entry that the glob was written against. CI's `bundle-size` job (`.github/workflows/ci.yml:70-87`) gates on this, so the job is passing on a partial measurement.

**Why it matters** — [perf-baseline.md](perf-baseline.md) cites the bundle budget as a defended ceiling and a case-study talking point. The claim currently does not hold.

**Fix** — point size-limit at the real initial set. Either add an entry per preloaded chunk group, or switch the main entry to `@size-limit/preset-app` / a `path` array covering `dist/assets/index-*.js` plus the preloads. Then re-set the limit against the honest number.

**Effort** — one commit, ~30 min, plus a decision on whether 224 kB is the new accepted ceiling.

---

**F-4 · `lol-analytics.service.ts` has crossed the documented god-class watch threshold. CONFIRMED. — FIXED 2026-07-26.**

**Evidence** — `wc -l apps/api/src/lol/lol-analytics.service.ts` → **1,443 lines**. [parked.md](../parked.md) records a standing watch: *"LoL service trio god-class watch — trigger if any service extends past ~1250L"*. The trigger has fired and no note records it.

Other services remain under: `lol-moments.service.ts` 1,195L, `lol-static-sync.service.ts` 1,076L, `lol.service.ts` 1,026L.

**Why it matters** — the watch exists precisely so this is caught at the boundary rather than at 2,000 lines. It fired silently.

**Fix** — the cohesive seam is the champion-analytics subdomain: `getChampionExtras`, `getChampionRecap`, `getChampionPairs`, `getChampionBuildFlow`, `getChampionRuneDiversity`, `getChampionLanePhase` (roughly lines 146–262 plus their helpers) extract to a `LolChampionAnalyticsService`. `loadOwnerMatchCache` (line 382) is shared and should stay. Not a rewrite — a move plus a constructor injection.

**Effort** — one focused session.

**Resolution (2026-07-26)** — split along the `championKey` seam. 1443L → **1059L** (`lol-analytics.service.ts`) + **423L** (`lol-champion-analytics.service.ts`); the 2121-line spec split 1390 / 773. Both moved blocks were extracted with `sed` and diffed against their originals to prove the move is byte-identical, so review can focus on the wiring.

Two corrections to the fix sketch above, both found while doing it:

- **`getChampionPairs` does not belong in the new service.** The name reads champion-scoped, but it takes no `championKey` and aggregates `(yourChamp, teammateChamp)` pairings across all of the owner's matches. Moving it would have split account-level duo analysis across two services. It stayed.
- **The line map was wrong.** "Roughly 146–262" would have cut mid-`getChampionRecap` and swallowed the `getDuos` doc comment. The real ranges are `146–261` and `1128–1380`, the second of which the sketch missed entirely (`getChampionBuildFlow` / `RuneDiversity` / `LanePhase` all live past line 1100, not near 146).

`LolService` fell out of `LolAnalyticsService` as a side effect: only the two moved methods ever called `this.lol.resolveSummoner`, so the remaining service now takes `(prisma, identity)`.

**Two pre-existing defects came across unchanged** rather than being fixed inside the move, and are now tracked in [open-work.md](../open-work.md):

1. `getChampionExtras` and `getChampionRecap` never call `identity.isLolAccountAllowed`. Every one of the other twelve analytics methods does. This is an authorization gap on two live routes, not a style inconsistency.
2. `getChampionExtras` aggregates items and matchups over raw `matches` with no `excludeRemakes()`, against the [documented domain invariant](../../repo-conventions.md#centralise-domain-invariants-that-must-apply-to-every-aggregation-in-a-feature). It does not even `select` the `remake` column. Because it never spells the token, it is invisible to the hardened structural lint from F-5 — the same "helper that never spells `remake`" class as the post-game streak bug.

---

**F-5 · The remake structural lint has a multi-line blind spot, and one site is already through it. CONFIRMED — FIXED 2026-07-25.** Both sites routed through `excludeRemakes()`; the lint now scans whole file text across 10 array methods, with a guard-the-guard test. A third, worse instance surfaced while fixing it: `buildOutcomeSignal` walked an unfiltered history, so a remake could pad a streak or supply the "broke a run" match — invisible to any regex lint, since it never spells the token.

**Evidence** — `apps/api/src/conventions.spec.ts:69` matches on a single line:
```js
const regex = /\.filter\(\s*\(?[a-zA-Z_]\w*\)?\s*=>\s*!\s*[a-zA-Z_]\w*\.remake/;
```
When Biome wraps the call across lines, the pattern no longer matches. `packages/shared/src/lol/pregame-signals.ts:78-80` is exactly that shape and is not caught:
```ts
  const recent = matches.filter(
    (m) => !m.remake && new Date(m.playedAt).getTime() >= cutoff
  );
```
`buildChampionTone` is a genuine aggregation (it buckets games and wins per champion), so this is the invariant-drift the convention exists to prevent — not a display conditional.

Second, narrower gap: the regex covers only `.filter`. `apps/web/src/lol/profile/profile-post-game.tsx:322` uses `ordered.find((m) => !m.remake)`. That one is a display selection rather than a rollup, so it is defensible, but it is invisible to the lint either way.

The six other `!x.remake` hits in `apps/web` are all render conditionals (LP badge visibility on a remake row) and are correct as-is.

**Why it matters** — 40 files correctly call `excludeRemakes()`. The one that does not is in `packages/shared`, the package most likely to be reused by a future surface.

**Fix** — two parts, same commit: route `buildChampionTone` through `excludeRemakes()`, and make the lint whitespace-tolerant across newlines (normalise the file text before matching, or extend the regex to `[\s\S]*?`). Add `.find`/`.some`/`.every` to the covered methods while in there.

**Effort** — 30 min.

---

**F-6 · Three canonical doc pointers lead to files that do not exist. CONFIRMED.**

Each of these is cited in an auto-loaded doc as *the* reference to follow, so a fresh session walks into a 404.

| Doc claim | Reality |
|---|---|
| `docs/repo-conventions.md:207` — "**Bare wrapper, chromed children** — [apps/web/src/routes/steam/game.$appid.tsx](…)" | File deleted. Actual: `apps/web/src/routes/steam/library/$appid.tsx` |
| `docs/repo-conventions.md:344` — cites "`apps/web/src/lol/matches/match-detail-tab-nav.test.tsx` (ARIA tab roles)" as the canonical test pattern | No `*tab-nav*` file exists. Actual: `apps/web/src/lol/matches/match-detail-tabs.test.ts` |
| `CLAUDE.md:21` — "`useSplashChampion(name)` (defined in `apps/web/src/lol/_shared/splash-backdrop.tsx`…)" | Actual: `apps/web/src/lol/_shared/assets/splash-backdrop.tsx` |

**Fix** — three path corrections.

**Effort** — 10 min.

---

**F-7 · A route move shipped with zero doc updates, leaving 67 stale references. CONFIRMED — FIXED 2026-07-25.** Live surfaces corrected (README, `repo-conventions.md`, and the Active/Index notes `api-surface-survey`, `game-detail-enrichment`, `frontend-2026-gaps`, plus four live claims in `steam-integration`). Historical and archive notes deliberately left as records of past state. The live API path `/steam/game/:appid/...` is untouched — it is still served by `steam.controller.ts`.

**Evidence** — commit `1a2a3d87` *"feat: convert steam game-detail to slide panel"* changed 30 files and touched **no** file under `docs/`. It deleted `apps/web/src/routes/steam/game.$appid.tsx` and added `apps/web/src/routes/steam/library/$appid.tsx`. `ugrep -rc` for the old path across `docs/`, `README.md`, `CLAUDE.md` returns **67 hits across 19 files**.

Most are historical notes describing state at the time, which is fine and should not be rewritten. The ones that matter are the live surfaces:

- `README.md:17` — "per-game detail at `/steam/game/$appid`" (public-facing)
- `docs/repo-conventions.md:207` — live convention (also F-6)
- `docs/working-notes/steam/api-surface-survey.md` — 8 hits, note is **Active**
- `docs/working-notes/steam/game-detail-enrichment.md` — 4 hits, note is **Index/Active**
- `docs/working-notes/steam/steam-integration.md` — 18 hits

**Why it matters** — this is the same-commit convention failing on the one commit where it mattered most (a path change invalidates every pointer at once). Everything else in the recent history honoured it.

**Fix** — correct the live surfaces only (README, repo-conventions, the three active Steam notes). Leave historical notes alone.

**Effort** — 30 min.

---

**F-8 · `README.md:14` documents a route shape that was deliberately removed. CONFIRMED.**

**Evidence** — README claims routing under `/lol/$accountSlug/{matches,trends,champions,patches,recap,live}`. Patches is **global**, not account-scoped: `apps/web/src/routes/lol/patches/index.tsx` and `patches/$version.tsx`. This directly contradicts a shipped note — `patches-as-global-surface.md:3`: *"account-scoped patches routes removed; Patches dropped from the account TABS"*. The other five segments verify.

Also stale in the same neighbourhood: "pnpm 10" at `README.md:33`, `README.md:54`, and `CLAUDE.md:14` — root `package.json` pins `pnpm@11.1.1`. And `README.md:101` says "19 write-ups"; there are 21.

**Fix** — README + CLAUDE.md corrections.

**Effort** — 15 min.

---

### Nice to have

---

**F-9 · Two stashes from 2026-05-17 are dead. CONFIRMED — inspection done 2026-07-26, drop awaiting owner sign-off.** `stash@{0}` is generated-file noise (`routeTree.gen.ts` only); `stash@{1}` touches `profile-patch-notice.tsx` and predates the shipped global-patches arc. Ten weeks old. Both verified fully superseded — evidence in [§2 Uncommitted work](#uncommitted-work) above. **Fix:** `git stash drop 'stash@{1}'` then `git stash drop 'stash@{0}'` (that order — dropping `{0}` first renumbers `{1}`). Held back because dropping stashes is destructive and owner-local. **Effort:** 1 min.

**F-10 · `scroll-container-context.tsx` drives visible state with no test. CONFIRMED. — FIXED 2026-07-26.** `apps/web/src/lib/scroll-container-context.tsx:43-58` holds a module-level `openPanelCount` pubsub that `ScrollToTop` reads to hide itself while a panel is open. The repo bar names "context providers that drive visible state" explicitly. Of the four context files with no sibling test, the other three (`active-match-context`, `match-window-context`, `command-palette-context`) are covered indirectly by 3–6 test files each; this one is referenced by **zero**. **Fix:** a small test for register/unregister → subscriber notification. **Effort:** 20 min.

**F-11 · Case-study inventory is missing an entry, violating its own rule. CONFIRMED.** `docs/case-studies/README.md:38` states *"Add new write-ups to the inventory table above in the same commit that lands the file."* `nav-hover-dropdown-primitive-choice.md` (added by `df3484de`) is the only one of 21 missing from the table. **Effort:** 5 min.

**F-12 · Inert scroll-snap class left behind by the recap migration. CONFIRMED. — FIXED 2026-07-26.** `apps/web/src/routes/index.tsx:61` still carries `[scroll-snap-align:start]`; `__root.tsx:182-191` documents that no `scroll-snap-type` remains on the container, so it is inert. This is explicitly acknowledged in the comment as pending per-chapter cleanup, so it is known-and-tracked rather than forgotten — listed for completeness. **Effort:** 5 min.

**F-13 · One `as any` in production code. CONFIRMED. — FIXED 2026-07-26.** `apps/web/src/components/command-palette-dialog.tsx:285`: `navigate({ to: item.path as any })`. This is the standard TanStack Router typed-path escape hatch for a dynamically-built path. Worth a one-line comment explaining why, or a narrowed cast, rather than removal. **Effort:** 10 min.

**F-14 · Dev-dependency majors available. CONFIRMED via `pnpm outdated -r`.** `@biomejs/biome` 1.9.4 → 2.5.5, `typescript` 6.0.3 → 7.0.2, `size-limit` + `@size-limit/file` 12.1.0 → 13.0.1, `concurrently` 9.2.4 → 10.0.3, `@types/node` 24 → 26. All dev-only; the Biome 2 and TS 7 jumps each deserve their own commit. Note `eb5ac211` already reverted a `concurrently` major deliberately. **Effort:** one commit each.

**Progress 2026-07-26:**

- `size-limit` + `@size-limit/file` → 13.0.1 — **DONE.** Reports byte-identical numbers to v12 (229.55 kB / 68.25 kB), still exits 1 when over budget, `--silent` still parses.
- `typescript` → 7.0.2 — **ATTEMPTED AND REVERTED.** TypeScript 7.0 ships the `tsc` executable only and does not expose the programmatic compiler API, which `@nestjs/cli` requires: `nest build` fails outright with *"the compiler API is expected to return in 7.1"*. Everything else was clean under 7 (all five packages `tsc --noEmit` rc=0, full test suite green, web build green), which is exactly what makes it dangerous. **Retry when TypeScript 7.1 ships.** See F-16 for the CI gap this exposed.
- `@biomejs/biome` → 2.5.5, `@types/node` → 26 — not attempted.

---

## 5. Checked and healthy

- **Lint / typecheck / tests** — all green; 4,241 tests across 438 files.
- **Structural convention lints** — `apps/api/src/conventions.spec.ts` enforces four conventions in CI (remake filter, native `title=`, header-recipe re-typing, retired `bg-card` opacity rungs). All passing. This is the strongest hygiene mechanism in the repo.
- **Package boundaries** — zero relative imports escaping a package root; zero cross-package `apps/…` imports. All cross-package references use workspace names.
- **Formatter duplication** — the 2026-05-18 consolidation into `packages/shared/src/format.ts` is holding; no regrowth. The apparent duplicates (`formatDuration`, `formatKda` local variants) have genuinely different signatures and outputs, verified by reading them.
- **Route/stream separation** — no LoL↔Steam cross-imports in either direction. `/` renders only cross-stream synthesis (moments aggregators, subject chapters, cross-stream strips) — no single-stream feed has crept in.
- **Error-boundary coverage** — three intact tiers: app-root (`main.tsx:130`), route-outlet (`__root.tsx:195-212`, wraps `<Outlet>` inside `<main>` so chrome survives), and widget/chart leaves (`WidgetBoundary`/`ChartBoundary` across 13 files). No gap between the tiers.
- **Type safety** — zero non-null assertions in production code; one `as any` (F-13); `as` casts elsewhere are JSON-fetch assertions and `CSSProperties` custom-property objects, all legitimate.
- **Tooltips** — zero native `title=` on intrinsic elements (machine-enforced). Local `TOOLTIP_CLASS` consts all compose via `cn(TOOLTIP_CONTENT_COMPACT, …)`, which the convention explicitly blesses.
- **Chart palette** — zero hardcoded series hex at call sites.
- **Scroll-reset wiring** — called at exactly two section roots (`routes/steam.tsx:64`, `routes/lol/$accountSlug.tsx:181`), never at a leaf. Correct per convention.
- **Secrets / env** — `.env` and `apps/api/.env` present but **untracked** (verified with `git ls-files`); `.env.example` files tracked; `.gitignore:12-14` correct; no hardcoded secrets found.
- **Committed generated files** — `apps/web/src/routeTree.gen.ts` is the only one, and it is documented. No undocumented tracked generated files.
- **tsconfig consistency** — all five packages extend `tsconfig.base.json`; every divergence is contextual (NodeNext for server/CLI, ES2023 + extra strictness for the browser app).
- **Devcontainer / version pinning** — Node 22 image matches `.nvmrc` and `engines.node`; pnpm 11.1.1 via corepack matches `packageManager`. Aligned. (The docs describing it are not — see F-8.)
- **Scripts and compose** — `scripts/setup.sh`, `scripts/reset.sh`, `compose.yaml` all match current reality.
- **Dependency audit** — `pnpm audit` down to 1 moderate advisory (`file-type` via `node-vibrant` → `@jimp/core`), with the override and risk acceptance documented in `pnpm-workspace.yaml`.
- **`onlyBuiltDependencies` vs `allowBuilds`** — both keys exist; pnpm 11 honours `allowBuilds` from `pnpm-workspace.yaml`. Not a conflict, and their contents do not contradict.
- **Markers and test hygiene** — no TODO/FIXME/HACK/XXX, no skipped or `.only` tests, no dead feature flags.
- **Shipped-note accuracy** — 33 named artefacts across ~20 shipped notes all resolve to real code.

---

## 6. Recommended next three chunks

**Chunk 1 — Restore the CI coverage gate.** Fix the `tee` pipe at `.github/workflows/ci.yml:33` (add `shell: bash`), then re-baseline the three coverage thresholds to just below current actuals so CI goes green honestly rather than green falsely. Update the stale comment at `packages/shared/vitest.config.ts:12-13` that claims "well below current (100% lines)". Addresses F-1 + F-2. One commit, plus one CI round-trip to confirm the gate can now fail.

**Chunk 2 — Make the bundle budget measure the real initial payload.** Rewrite `apps/web/.size-limit.cjs` to cover the entry script plus its modulepreloads, set the limit against the honest 229.35 kB figure, and update the stale numbers and "200 kB" budget claim in [perf-baseline.md](perf-baseline.md) in the same commit. Addresses F-3. One commit.

**Chunk 3 — Doc-pointer repair sweep.** Correct the three canonical pointers (F-6), the live `/steam/game/$appid` references in README + `repo-conventions.md` + the three active Steam notes (F-7), the patches route shape and pnpm version in README/CLAUDE.md (F-8), and add the missing case-study inventory row (F-11). Explicitly leave historical notes untouched. One commit, ~1 hour.

F-4 (analytics service extraction) and F-5 (remake lint blind spot) are the natural fourth and fifth; F-5 is small enough to ride along with any LoL-touching commit.

---

## 7. Not checked

- **Perf probe — now RUN.** See §8 below. Two of six scenarios bracketed; the other four (`lol-champion-panel`, `steam-library`, `lol-patches`, `wishlist-upcoming`) were not run this pass.
- **Lighthouse / Web Vitals** — devcontainer cannot run Lighthouse; this is already tracked as an open follow-up in `perf-baseline.md:3`.
- **Visual convention compliance (tile recipe, `SectionTitle` vs `CardTitle`, skeleton parity, `cursor-pointer`)** — checked only via the machine lints in `conventions.spec.ts`, which cover header-recipe re-typing and retired opacity rungs but **not** frosted-vs-transparent tier selection, skeleton-to-layout parity, or `cursor-pointer` presence. Those three need a visual pass or a new structural lint; a grep cannot distinguish "frosted because it faces a splash" from "frosted by mistake".
- **Command-palette grammar coverage for new surfaces** — no new filterable surface has landed since the last palette phase, so there was nothing to check.
- **Dead-code sweep** — sampled rather than exhaustive. The sampled components under `components/`, `lib/`, and `_shared/` were all reachable; a complete unreferenced-export audit needs a tool (`knip` or similar), not grep.
- **Auto-memory staleness** — reviewed the `MEMORY.md` index, plus the two entries most likely to be affected by F-6's moved splash/backdrop paths. Both are accurate: `project_backdrop_primitives` cites `apps/web/src/_shared/backdrop/`, which exists with both named primitives; `feedback_splash_visual_parity` states a principle and names no path. The remaining ~40 memory bodies were **not** individually verified against current code. No deletions made.

---

## 8. Perf probe — run 2026-07-25 (added after the dev server was restarted)

Environment: chromium 151.0.7922.34 (playwright v1234), 1440×900, dev server on `:2009`, arm64 devcontainer, API warm.

### Methodology finding — the first run after a dev-server restart is garbage

The first probe run against a freshly-restarted Vite server captures a **skeleton**, not the loaded page, and produces falsely-excellent numbers. Observed on both scenarios:

| Scenario | Cold run 1 (`01-load`) | Warm runs |
|---|---|---|
| `lol-overview` | layers=3, raster=31 ms, longTasks=0, scroll phase **all zeros** | layers 21–26, raster 49–60 ms |
| `recap` | layers=3, raster=33 ms, longTasks=0 | layers 14, raster 122–126 ms |

Both cold screenshots were byte-identical between the load and scroll-bottom moments (307,958 bytes), confirming the page never scrolled because content had not arrived. `web-vitals` still reported FCP 220 ms, so the page *painted* — it painted skeletons.

**This is a live trap for the documented "bracket with 3 runs" convention:** a 3-run bracket that includes the cold run pulls the median down and reads as an improvement. Discard the first run after any dev-server restart, or warm the route once before bracketing. Worth encoding in [progressive-paint-audit.md](progressive-paint-audit.md) and the budget-table how-to-apply block in [repo-conventions.md](../../repo-conventions.md).

### Results vs budget

**`lol-overview`** — 3 warm runs, `01-load`:

| Metric | Run 1 | Run 2 | Run 3 | Median | Budget | Verdict |
|---|---|---|---|---|---|---|
| Layers | 26 | 21 | 23 | **23** | ≤ 30 | PASS |
| RasterTask | 60 ms | 49 ms | 53 ms | **53 ms** | ≤ 150 ms | PASS |
| Long tasks | 2 | 2 | 1 | **2** | ≤ 2 | PASS |
| Dropped frames | 0 | 0 | 0 | **0** | 0 (hard gate) | PASS |

Documented reference is "24 layers / ~100 ms / 1–2 long tasks". Layers match; raster reads roughly **half** the recorded figure.

**`recap`** — 2 warm runs, `01-load`:

| Metric | Run 2 | Run 3 | Budget | Verdict |
|---|---|---|---|---|
| Layers | 14 | 14 | ≤ 20 | PASS |
| RasterTask | 122 ms | 126 ms | ≤ 220 ms | PASS |
| Long tasks | 1 | 1 | ≤ 2 | PASS |
| Dropped frames | 0 | 0 | 0 (hard gate) | PASS |

Documented reference is "13 layers / 179–213 ms median ~195". Layers match (14 vs 13); raster reads **~70 ms below the recorded floor**.

`02-scroll-bottom` layer counts swung 34 → 413 across runs on `lol-overview`, exactly as the convention predicts for `content-visibility: auto` materialisation timing. Its gates (dropped=0, long tasks 1) pass.

### Interpretation — do not re-baseline on this evidence alone

Both routes are comfortably inside budget, and no dropped frames anywhere. But the raster improvements (**-47 ms** on lol-overview, **-70 ms** on recap) should **not** be written into the budget table yet. The baselines were captured 2026-06-09/10 on a different chromium; this run is chromium 151 on arm64, and today's dependency refresh moved Vite, visx, and the React toolchain. The delta is at least partly environmental. Re-baselining requires a controlled comparison on the same machine, not a cross-version one.

**Actionable:** the budget table is not stale in a way that misleads — everything passes with headroom. The two things worth doing are (a) documenting the cold-run trap above, and (b) re-running all six scenarios in one sitting on this environment if the numbers are ever to be used as evidence in the case study.

### Tooling defect found while running this

Today's dependency refresh broke the probe. Commit `26590e8b` bumped `playwright` in **two packages to two different versions** — root `package.json` `^1.60.0` → `^1.61.1`, and `tools/perf-probe/package.json` `^1.60.0` → `^1.62.0`. Both were previously unified at `^1.60.0`.

Consequences, all CONFIRMED:
- The lockfile now carries `playwright@1.61.1` + `playwright@1.62.0` and both `playwright-core` copies.
- Each minor wants a **different chromium build** (1228 vs 1234), so two ~300 MB browser sets are needed.
- `pnpm exec playwright install chromium` from the repo root resolves root's 1.61.1 and installs the **wrong** build; the probe still fails. The working invocation is `pnpm --filter @vyoh/tools-perf-probe exec playwright install chromium`.
- The probe was dead from 12:51 today until this was diagnosed, and nothing caught it — the probe is not in CI, by design.

**Fix:** unify both pins to the same caret range (`^1.62.0`) in one commit, and add the correct filtered install command to the perf-probe README or the budget-table how-to-apply block, since the root-level command is a trap.

### Unit correction (applied 2026-07-25, post-review)

F-3's figure was first recorded as **224.43 kB**, computed as `bytes / 1024`. `size-limit` reports and parses **decimal** kB (`bytes / 1000`) — confirmed by measuring the entry chunk at 133,482 B, which is 133.48 decimal kB (matching its printed 133.78 kB, the residual being `__BUILD_TIME__`/`__BUILD_COMMIT__` drift between builds) versus 130.35 binary kB, which does not match. `@size-limit/file` compresses per file at gzip level 9 (`apps/web/node_modules/@size-limit/file/index.js:32`).

Restated in size-limit's own units: true initial JS is **229.35 kB** (229,347 B, per-file gzip -9 across all 21 chunks) against a **210 kB** limit — an overshoot of **19.35 kB**, not 14.43 kB. The finding stands and is slightly worse than first reported; only the arithmetic changed.

---

## 9. F-15 — the local `:cc` scripts had F-1's defect too (found 2026-07-25 while fixing F-1)

**CONFIRMED, and fixed in the same commit as F-1.**

`pnpm run <script>` where the script pipes to `head` exits **0 regardless of the underlying command**, because a pipeline's status is the last command's. Proven in an isolated package:

```
piped to head, producer exits 1  -> pnpm run exits 0
bare, producer exits 1          -> pnpm run exits 1
```

Three of the repo's Claude-facing validation scripts were built that way:

| Script | Before | Could it fail? |
|---|---|---|
| `check:cc` | `biome ci .` — no pipe | yes |
| `typecheck:cc` | `pnpm -r typecheck 2>&1 \| head -300` | **no** |
| `test:cc` | `pnpm -r test 2>&1 \| head -400` | **no** |
| `coverage:cc` | `pnpm -r test --coverage 2>&1 \| head -400` | **no** |

Because `verify:cc` chains them with `&&`, **`verify:cc` only ever gated on lint** — typecheck and test failures passed silently. Verified end-to-end: with a deliberately failing test in `packages/shared`, `test:cc` and `verify:cc` both returned 0 before the fix and both return 1 after.

This is why the F-1 bug survived: the local command a session would reach for to check its work had the same blind spot as CI.

**Fixed:** `typecheck:cc` and `test:cc` now run under `bash -o pipefail -c '…'`, keeping their output caps. `coverage:cc` drops its pipe entirely — its `head -400` was truncating before `apps/web`'s summary, which lands at output line **960 of 966**, so it never showed web's numbers *or* its threshold errors. It also gains `--no-bail` so all three packages report.

**Not changed:** `check:cc` and `check:fix:cc` (no pipe, already correct).

**Residual:** `pipefail` + `head` could in principle surface a producer SIGPIPE as a false failure. Tested against a producer emitting 5,000 lines into `head -10`: exits 0 when the producer succeeds, 1 when it fails. Not a practical risk here.

---

## 10. F-16 — CI never builds `apps/api` (found 2026-07-26 while attempting the TypeScript 7 bump)

**CONFIRMED. Not fixed — decision needed.**

**Evidence** — the only build step anywhere in [`.github/workflows/ci.yml`](../../../.github/workflows/ci.yml) is `pnpm --filter @vyoh/web build` at `:97`, inside the `bundle-size` job. The `check` job runs `ci:check`, `typecheck`, and the test suite; nothing runs `nest build`.

**How it surfaced** — the TypeScript 7 bump (chunk 20) passed *everything* CI runs: all five packages `tsc --noEmit` rc=0, `pnpm -r --no-bail test --coverage` exit 0, `pnpm --filter @vyoh/web build` exit 0, `size` within budget. It fails only at `pnpm --filter @vyoh/api build`, because TypeScript 7.0 ships the `tsc` executable without the programmatic compiler API that `@nestjs/cli` loads:

```
Error  The installed TypeScript version (7.0.2) does not expose the programmatic
compiler API that the Nest CLI requires. TypeScript 7.0 ships the "tsc"
executable only; the compiler API is expected to return in 7.1.
```

**Why it matters** — typecheck and tests both bypass `nest build` entirely (vitest transforms via esbuild, `tsc --noEmit` never emits). So the api's *production build path* is currently unexercised by any automated gate. A change that breaks only that path ships green and fails at deploy. This bump is a concrete instance, not a hypothetical: it would have merged.

Note this is the same shape as F-1, one layer out. F-1 was a gate that could not fail; this is a gate that does not exist.

**Fix** — add `pnpm --filter @vyoh/api build` to the `check` job. It is cheap (SWC) and needs no database or secrets. The open question is whether to also build `packages/shared` and the two `tools/` packages, or just the two deployables.

**Effort** — 15 min, one commit.
