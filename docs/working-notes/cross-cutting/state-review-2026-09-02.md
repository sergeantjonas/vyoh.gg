# State-of-the-app review — 2026-09-02

**Status:** Reference — architecture, code-quality and project-setup sweep (Phases 3, 4 and 5 of the state-review procedure) run on `main` @ `2516c6b8`, plus a delta re-run of Phases 0–2 and 6 against [state-review-2026-09-01.md](state-review-2026-09-01.md), which deliberately skipped 3–5. Every finding is sized as one landable commit. **Shipped 2026-09-02:** B-1 (`c1e0327d`, with `qs` taken in the same pass); F-1, F-3, F-4, F-5, F-6 (`b41908f6`); F-7 (`9252f712`); F-2 in the commit that updates this line, as `storedMatchOf()` + `ownerParticipant()` in `match-projection.ts` replacing the seven inline shapes (six in `lol-analytics`, one in `lol-champion-analytics`); the two `as StoredDetailJson` / `as DetailJson` readers in `match-narrative.service.ts` and `match-baseline.service.ts` are the same pattern under a different cast and are left for a follow-up. F-8, F-9 and N-4 shipped as one docs commit: the shell fixtures and the remake bound now live in the two conventions files and the local `CLAUDE.md` points at them; the `/` rule names the recap ranking as its exception; the four notes carry Status headers. The `CHART_TEAM_BLUE`/`CHART_TEAM_RED` slots were added to the palette rather than mapping the live radar's team sides onto the win/loss pair. Two visible deltas to eyeball, not no-ops: the live radar's `PolarGrid` had `hsl(var(--border))`, an invalid colour since `--border` is oklch, so the grid never rendered and now does; and the champion win-rate trend's loss stroke moved from red-400 `#f87171` to the palette's rose-400 `CHART_NEGATIVE`. The header-lint widening is deferred — 13 more sites carry the exact `text-xs uppercase tracking-wide text-muted-foreground` recipe (e.g. `profile-patch-notice.tsx:109`, `patches-page.tsx:249`), so it is its own sweep, not a lint tweak. Read yesterday's note for the in-flight table — the delta since then is 21 commits and is summarised in § 2 rather than re-derived.

---

## 1. Verdict

The repository is in good shape and the engineering signal it is meant to carry holds up under a structural read: the Nest module graph is acyclic and LoL never imports Steam at any layer, Prisma access stays inside its domain, the Riot rate limiter has a single un-bypassed call site, all ten cron jobs run through a concurrency guard, all 20 viewer-scoped handlers declare `@WithViewer()`, every one of the 43 interactive web components has a sibling test, no component is orphaned, and no dependency is declared-but-unused or used-but-undeclared. Lint, typecheck, tests, the production build and every coverage threshold pass.

**The one thing to do first:** `pnpm audit --prod` fails locally on four *high* advisories for `fast-uri` (patched in 3.1.6) that landed after this morning's green CI run. The audit job gates at `--audit-level=high`, so the next push to `main` goes red. The `fast-uri@<3.1.5: ^3.1.5` override in `pnpm-workspace.yaml` is now stale by one patch version — this is exactly the "stale floor shows up as a fresh finding" behaviour the override block was designed for, and the fix is one line.

Behind that, the findings are small and mostly convention drift inside one file (`routes/lol/$accountSlug/champions/$championKey.tsx` carries a hardcoded chart hex, an ad-hoc header recipe, and is the largest route file) plus one genuine oddity: `patch.service.ts` contains two literal NUL bytes, so git treats a source file as binary. The W1 duplication yesterday's note tracked has not regrown but also has not been fixed.

---

## 2. In flight — delta since 2026-09-01

21 commits since `eff861a2`. Notes were updated in the same commits throughout; no drift found in this window.

| Arc | Status (quoted) | Δ since 09-01 | Next |
|---|---|---|---|
| Achievement rarity drift R3 ([steam/achievement-rarity-drift.md](../steam/achievement-rarity-drift.md)) | "R3 live; R2b optional; mature beat parked" | Shipped 09-02 across five commits (`26c8f891` → `2516c6b8`), visual review closed | Nothing; mature-library beat parked on a ≥5 pp trigger |
| Match-depth LP-overlay per duo | "Phase D complete" | Shipped 09-01 (`7d3f9e57`, `83bcb5c3`) | Phase E remains deprioritised polish |
| Status-page admin (a)/(b) ([open-work.md](../open-work.md)) | "(a) Steam sync status / (b) granular LoL triggers remain" | (a) shipped `6dd3c465`; a patch-note trigger shipped `7193214c` | (b) remaining |
| Initial-JS budget | 255 kB limit since `5b799cf0` | 247.54 kB gzip today (2.9 % headroom; was 1.0 % against 250 kB) | Record the 255 kB re-baseline attribution the commit promised, if not already in perf-baseline (it is: 09-01 section) |
| Launch | "blocked on buying the VPS and nothing else" | Unchanged | Buy the VPS |
| Docs hygiene | Four notes carry no `**Status:**` header | Unchanged | See N-4 |

Markers and test hygiene re-checked: zero `TODO`/`FIXME`/`HACK`/`XXX`, zero `.skip`/`.only`, one `@ts-expect-error` (in a test, `game-screenshot-strip.test.tsx`), `as any` only inside `routeTree.gen.ts`.

---

## 3. Validation baseline

All run on `main` @ `2516c6b8` in the devcontainer.

| Check | Result |
|---|---|
| `tokf err pnpm run check:cc` | **PASS** |
| `tokf err pnpm run typecheck:cc` | **PASS** |
| `tokf test pnpm run test:cc` | **PASS** |
| `pnpm --filter @vyoh/web build` | **PASS** — built in 708 ms |
| `pnpm --filter @vyoh/web size` | **PASS** — initial JS 247.54 kB / 255 kB; recharts lazy chunk 68.25 kB / 85 kB |
| `pnpm run coverage:cc` | **PASS** on every threshold — table below |
| `pnpm audit --prod` | **FAIL** — 4 high (`fast-uri` ×4, patched ≥3.1.6), 3 moderate (`file-type`, `qs` ×2). → B-1 |
| GitHub Actions on `main` | Green through `33620147073` (2026-09-02 10:34 UTC). The `fast-uri` advisories are not in that run; the next push will fail the audit job. |
| Perf probe / Lighthouse | **Not run** — no dev server was up; see § 7 |

Largest client chunks (gzip): `shaka-player` 263 kB (lazy, dynamic import at `steam/game/game-screenshot-strip.tsx:443`), entry `index-*` 142 kB, `CategoricalChart` 68 kB (lazy), `routes-*` 52 kB, `react-*` 39 kB.

### Coverage

| Package | Statements | Branches | Functions | Lines | vs. 09-01 |
|---|---|---|---|---|---|
| `packages/shared` | 97.49 % (min 95) | 90.86 % (min 89) | 99.63 % (min 97) | 99.76 % (min 99) | up on every axis — F-5's shared tests landed (`2b963357`) |
| `apps/api` | 93.08 % (min 92) | 84.58 % (min 82) | 95.02 % (min 94) | 95.20 % (min 94) | flat |
| `apps/web` | 81.64 % (min 79) | 66.30 % (min 62) | 89.77 % (min 86) | 92.47 % (min 90) | flat |

---

## 4. Findings

### Blocking

**B-1 · The production audit fails on `fast-uri` and CI will go red on the next push. CONFIRMED.** Evidence: `pnpm audit --prod` → "7 vulnerabilities found · Severity: 3 moderate | 4 high"; all four high rows are `fast-uri` with patched versions `>=3.1.6`; `pnpm why fast-uri` resolves 3.1.5 via `ajv@8.18.0`. `pnpm-workspace.yaml` carries `fast-uri@<3.1.5: ^3.1.5`. CI's audit job runs `pnpm audit --prod --audit-level=high` (`.github/workflows/ci.yml`). **Why it matters:** a red badge on the README of a portfolio repo, and the third time this job has gone red on a stale floor (see `dc42822a`). **Fix:** widen the override to `fast-uri@<3.1.6: ^3.1.6`, `pnpm install`, re-run the audit; note the date in the override comment as the others do. Consider whether the two moderate `qs` advisories (via `express` under `@nestjs/platform-express`) get an override now rather than when they escalate. **Effort:** 10 min.

### Should fix

**F-1 · `apps/api/src/lol/patch.service.ts` is a binary file to git. CONFIRMED.** Evidence: `git ls-files --eol` reports `i/-text w/-text`; `tr -cd '\000' | wc -c` → 2; both sit at [patch.service.ts:420](../../../apps/api/src/lol/patch.service.ts#L420), where `abilityKey()` uses a raw NUL as the composite-key separator inside a template literal. **Why it matters:** `git diff`/`git log -p` print "Binary files differ" for this file, code review on GitHub shows no inline diff, and any tool that sniffs for binaries (`file` says `data`) skips it. **Fix:** write the separator as `\u0000` — identical runtime string, text file again. Same-commit test: none needed beyond the existing patch tests. **Effort:** 5 min.

**F-2 · The lean match-detail projection is re-typed inline six times. CONFIRMED.** Evidence: `cache.detail as unknown as { info: { participants: Array<{ … }> } }` at [lol-analytics.service.ts:549, 627, 721, 822, 909, 997](../../../apps/api/src/lol/lol-analytics.service.ts#L549). These are 6 of the 43 non-test `as unknown as` casts in the repo; the rest are Prisma `Json` column bridges. **Why it matters:** the projection that strips non-owner fields lives in `match-projection.ts`, but nothing ties these six ad-hoc shapes to it — the D.3 radar damage-taken bug (auto-memory `project_lean_match_detail_cache`) was exactly a reader assuming a field the projection had removed. **Fix:** export a `LeanMatchDetail` type from `match-projection.ts` (or `@vyoh/shared`, since the web reads the same cache shape) and a single `readLeanDetail(cache)` accessor; replace the six casts. **Effort:** 30 min, one file plus the projection module.

**F-3 · Two handlers still declare their JSON response type inline. CONFIRMED.** [patch.controller.ts:30](../../../apps/api/src/lol/patch.controller.ts#L30) `Promise<{ year: number }>` and [lol.controller.ts:98](../../../apps/api/src/lol/lol.controller.ts#L98) `Promise<{ idCount: number; backfilled: number }>`. The rule in `docs/repo-conventions.md` § "API response types live in packages/shared" says the type is imported from `@vyoh/shared`. Yesterday's note counted six stragglers; four have since been fixed or were outside `*.controller.ts`. **Fix:** two named types in `packages/shared/src/lol/`, annotate both ends. **Effort:** 15 min. Shrinks the D4 residual tracked in `open-work.md` to the health and SSE sites.

**F-4 · Chart series colours hardcoded at two call sites. CONFIRMED.** [$championKey.tsx:619](../../../apps/web/src/routes/lol/$accountSlug/champions/$championKey.tsx#L619) `stroke={detail.winRate >= 0.5 ? "#34d399" : "#f87171"}` — `CHART_POSITIVE` / `CHART_NEGATIVE` exist in `lib/chart-palette.ts:36-38`. [live.tsx:274-290](../../../apps/web/src/routes/lol/$accountSlug/live.tsx#L274) `PolarGrid`/`Radar` use `"hsl(220 80% 60%)"`, `"hsl(0 80% 60%)"`, `"hsl(var(--border))"` — `CHART_GRID` and the series constants cover all three. **Why it matters:** the palette file exists so a theme change is one edit; these two surfaces would drift. **Fix:** swap to the constants. **Effort:** 10 min.

**F-5 · A champion name rendered raw. CONFIRMED.** [trend-death-matchup-heatmap.tsx:159-161](../../../apps/web/src/lol/trends/trend-death-matchup-heatmap.tsx#L159) renders `row.championName` (truncated to 8 chars) as SVG `<text>`. `docs/repo-conventions-web.md` § "Use `useChampionName()` for all champion name display" — the alias vs. display-name difference (`MonkeyKing`/Wukong) shows here. **Fix:** resolve via the hook before truncating. **Effort:** 10 min.

**F-6 · Ad-hoc header recipe the lint cannot see. CONFIRMED at :571, SUSPECTED at :677/:758.** [$championKey.tsx:571](../../../apps/web/src/routes/lol/$accountSlug/champions/$championKey.tsx#L571) `<div className="text-xs uppercase tracking-wide text-muted-foreground">Win Rate Trend</div>` directly above a chart body inside a bare flex wrapper — the mechanical wrapper test in § "Header primitives" says `SectionTitle`. The `conventions.spec.ts` header lint matches the blessed class strings, so a different size/tracking combination slips through. Near-identical divs at :677 and :758 in the same file. **Fix:** replace with `SectionTitle`; if the lint should catch this shape, widen it to `uppercase tracking-` + `text-muted-foreground` on a `div`/`p`. **Effort:** 15 min. F-4, F-6 and the file's 915-line size (see § 4 Nice to have) make `$championKey.tsx` the one file worth a dedicated pass.

**F-7 · W1 duplication still stands. CONFIRMED, already tracked.** `formatRelative` defined three times (`home/recap/ahri-chapter.tsx:58`, `home/recap/steam-chapter.tsx:68`, `home/conclusion/footer-chips.tsx:11`), `firstSentence` twice (`steam-moment-beat.tsx:371`, `steam-chapter.tsx:85`), and `home/recap/lol-moment-beat.tsx:576` declares a local `formatDuration` while `@vyoh/shared` exports one from `format.ts:1`. Unchanged since yesterday and since 07-25; listed here only because it now meets the "≥3 sites" bar and because the local `formatDuration` shadows a shared export by name, which is the shape the "cross-package utilities" rule calls a defect. **Fix (as shipped):** `formatRelative` → `formatElapsedCompact` in `packages/shared/src/format.ts`, footer-chips onto the existing `formatTimeAgo`; `firstSentence` stayed web-local in `apps/web/src/home/_shared/` because it parses Steam store copy nothing in the api reads; the local `formatDuration` deliberately differs from shared (whole minutes) and is renamed `formatWholeMinutes`. **Effort:** 30 min, one commit.

**F-8 · The repo-specific architecture facts live in an untracked file. CONFIRMED.** `git ls-files CLAUDE.md` → nothing; `.gitignore` lists `CLAUDE.md` and `.claude/`. The file's "Architectural patterns" section (keyed route transitions in `__root.tsx`, `SplashProvider`/`useSplashChampion`, `LazyMotion` `domMax`, the `SHOULD_ANIMATE` bypass, the 210 s remake threshold) exists only on this machine, while the portable half was already moved to `docs/repo-conventions.md` (commit `80d74b58`). **Why it matters:** a fresh clone — or the second machine whose memory store is `-home-vyoh-dev-vyoh-vyoh-gg` — starts without them, and a case-study reader never sees them. Hiding AI config from the public repo is a deliberate choice, so the fix is not to track `CLAUDE.md`. **Fix:** move the five bullets into `docs/repo-conventions.md` (three already have a home in § Architecture) and leave `CLAUDE.md` as pointers. **Effort:** 15 min, docs-only.

**F-9 · The `/` rule and the recap surface disagree. SUSPECTED (docs drift, not a code defect).** `docs/repo-conventions.md` § "Per-stream routes": "`/` may carry at most a single curated highlight per stream that links into the deep route." `routes/index.tsx:100-118` maps every ranked `steam-subject` chapter onto `/`, by design of the self-portrait recap arc (shipped 06-07) and the dormant-chapter ranking (08-25). The rule was written for dashboard tiles ("top tracks this week") and the recap is an editorial format, but the sentence as written is violated by the home page. **Fix:** amend the rule to name the exception — synthesis chapters ranked across streams are allowed; single-stream *feeds* are not. **Effort:** 5 min.

### Nice to have

**N-1 · The axe scan covers 4 of 43 interactive components.** `components/accessibility.test.tsx` scans `CommandPaletteDialog`, `Nav`, `LandingHeading`, `MatchRow`; no other test imports `jest-axe`. The convention says new interactive components get an axe scan. The dialogs and popovers are the highest-value additions: `slide-panel`, `screenshot-lightbox`, `tag-filter-popover`, `library-controls`, `game-panel-hero`. One test file, five `render` + `axe` blocks. **Effort:** 30 min.

**N-2 · Unused-code checking exists only in `apps/web`.** `tsconfig.app.json` sets `noUnusedLocals` / `noUnusedParameters`; `apps/api/tsconfig.json` and `packages/shared/tsconfig.json` do not, and `biome.json` enables neither `noUnusedVariables` nor `noUnusedImports` (recommended set in 1.9 leaves them off). Dead helpers in api/shared are caught by nothing but coverage. **Fix:** add the two flags to `tsconfig.base.json` and fix whatever surfaces (likely a handful of unused params in Nest handlers — `_` prefix them). **Effort:** 20–40 min depending on the count; run typecheck first to size it.

**N-3 · `reflect-metadata` is declared in `apps/api` but never imported.** `ugrep -r reflect-metadata apps/api/src apps/api/prisma` → nothing. `@nestjs/core` imports it itself, so nothing is broken; either drop it or add the explicit `import "reflect-metadata"` at the top of `main.ts` that the Nest docs still show. **Effort:** 2 min.

**N-4 · Four working notes have no `**Status:**` header.** `cross-cutting/multi-beat-chapter-arc.md`, `cross-cutting/progressive-paint-audit.md`, `cross-cutting/r13-exit-dissolve.md`, `cross-cutting/subject-chapter-design-spec.md`. The outline tooling and the "read before" index both key on that header. **Effort:** 5 min.

**N-5 · One glass combination outside the documented tiers. SUSPECTED.** `steam/profile/steam-stat-band.tsx:255` uses `bg-background/20 … backdrop-blur-xs` — neither the frosted (`bg-card/60 backdrop-blur-sm`), transparent, nor chrome (`bg-card/80 backdrop-blur-md`) recipe. Possibly a deliberate band-on-hero treatment; if so, name it in the tile section, otherwise fold it into a tier.

**N-6 · Filter controls outside the palette grammar. SUSPECTED.** `steam/library/tag-filter-popover.tsx`, `steam/library/library-controls.tsx` (sort), `lol/champions/champion-sort-selector.tsx`, `lol/matches/match-count-selector.tsx` have no corresponding term in `command-palette-chips.ts` or `library-query.ts`. Check `command-palette.md` for a recorded deferral before treating as gaps — sort and count selectors may fall under the "spatial selection / live preview" exemption.

**N-7 · File-size outliers, for the record.** Api: `recap/lol-moments.service.ts` 1195, `og/og-card.ts` 1144, `lol/lol.service.ts` 1112, `lol/lol-analytics.service.ts` 1105, `lol/lol-static-sync.service.ts` 1079. Web: `home/recap/steam-chapter.tsx` 1006, `ahri-chapter.tsx` 954, `components/command-palette-dialog.tsx` 946, `lol/matches/match-map-overlay.tsx` 919, `routes/…/champions/$championKey.tsx` 915, `match-detail-recap-tab.tsx` 908. Natural seams: a detector-per-file split for `lol-moments`; DDragon vs. wiki sync in `lol-static-sync` (five `fetch` sites across two upstreams); the `$championKey.tsx` route's chart sections into `lol/champions/` components (it is the only route file importing recharts directly). W3/W4 in `audit-web-structure.md` already cover the recap tab and chapters; do not double-track.

**N-8 · Auto-memory pruning candidates.** `project_next_visible_payoff_picks` (still lists shipped arcs as next; flagged yesterday as N-6, not yet rewritten); `project_tokf_host_filter_resolution` (a 0.2.45-era host bug, likely superseded); `project_ccusage_baseline` (June figure, superseded by `user_usage_window_weighting`). Not deleted by this review.

---

## 5. Checked and healthy

- **Validation** — lint, typecheck, tests, production build, size budget, all coverage thresholds pass.
- **Api module graph** — 17 modules, no back-edges; `LolModule` and `SteamModule` never import each other; `home`/`recap`/`og` are the only cross-stream consumers, one layer below the `/` rule.
- **Prisma layering** — no controller injects `PrismaService`; no Steam service reads a LoL table or vice versa.
- **Riot rate limiter** — one `fetch` to `api.riotgames.com` (`riot.service.ts:208`), behind Bottleneck; wiki/DDragon fetches are separate upstreams by design.
- **Cron guards** — all 10 `@Cron` sites run through `SyncJobRegistry.run()` or the older private guard in `match-sync.service.ts`.
- **Viewer scoping** — 20/20 `@ViewerIsOwner()` handlers carry `@WithViewer()`; `home`/`recap`/`og` call `getCuration()`, the *visitor* projection, which is the safe default for routes with no owner split.
- **Web stream separation** — zero `@/steam/**` imports under `lol/**` or `routes/lol/**` and vice versa.
- **Scroll reset** — exactly two call sites, both section roots (`routes/steam.tsx:88`, `routes/lol/$accountSlug.tsx:190`).
- **cursor-pointer** — `Button` bakes it into the `cva` base; ~10 raw `<button>` sites spot-checked all carry it; one inline `style={{ cursor: "pointer" }}` on an SVG circle (`match-map-overlay.tsx:384`) is equivalent.
- **Error boundaries** — `router.tsx:105` (app), `__root.tsx:82/303/356` (route + outlet), `WidgetBoundary` on the `index`, `live`, `trends`, `review` and `$championKey` routes, `ChartBoundary` on the match-detail tabs. No tier gap found.
- **Skeletons** — one per major surface (matches, match detail, champions, trends, game detail, library, wishlist, upcoming); presentational children return `null` only on parent-resolved data.
- **Tests** — 43/43 interactive components have a sibling test; no orphaned component; no `.skip`/`.only`; one `@ts-expect-error` (in a test).
- **Type safety** — `as any` only in `routeTree.gen.ts`; 43 non-test `as unknown as`, of which 6 are F-2 and the rest Prisma `Json` bridges; 2 `noNonNullAssertion` suppressions, each with a reason.
- **Dependencies** — nothing declared-but-unused (bar N-3), nothing used-but-undeclared; the `radix-ui` umbrella and the six scoped `@radix-ui/*` packages dedupe to one version each; 40 minor/patch updates available, no major.
- **Generated files** — `git ls-files` shows exactly the two documented (`routeTree.gen.ts`, `champion-assets.gen.ts`).
- **Secrets** — only `.env.example` files are tracked.
- **Version pinning** — Node 22 everywhere: `.nvmrc`, `engines`, devcontainer image, both Dockerfiles, CI `node-version-file`; pnpm 11.1.1 via `packageManager` + corepack.
- **CI** — gates lint/format, typecheck, api build, coverage upload with a truncation guard, prod audit, bundle budget; `shell: bash` pipefail fix documented inline.
- **Biome 1.9.4** — deferred to 2.x by a measured decision (`ops/biome-2-migration.md`); not flagged.

---

## 6. Recommended next three chunks

**Chunk 1 — Unblock CI (B-1).** Widen the `fast-uri` override to `<3.1.6: ^3.1.6`, `pnpm install`, `pnpm audit --prod`, commit with the dated comment. Decide in the same sitting whether `qs` gets a pre-emptive override. One file plus lockfile.

**Chunk 2 — Convention sweep on the champion detail route and its neighbours (F-1, F-3, F-4, F-5, F-6).** `\u0000` in `patch.service.ts`; two shared response types; two palette swaps; one `useChampionName()`; `SectionTitle` ×3 in `$championKey.tsx`. Seven files, no behaviour change, existing tests cover all of it; add the widened header lint to `conventions.spec.ts` if the :677/:758 near-misses confirm. Updates the D4 residual line in `open-work.md` in the same commit.

**Chunk 3 — Typed lean detail + W1 dedupe (F-2, F-7).** `LeanMatchDetail` + accessor in the projection module, six casts replaced; `formatRelative` to shared as `formatElapsedCompact`, `firstSentence` to `home/_shared/`, both with tests; local `formatDuration` renamed. Updates `audit-web-structure.md` (W1 shipped) in the same commit. Roughly nine files.

F-8 and F-9 are a docs-only commit that can ride along with either chunk.

---

## 7. Not checked

- **Perf probe and Lighthouse** — no dev server was running; the probe needs a warm one and Lighthouse cannot run in the devcontainer (`perf-baseline.md:3`).
- **Skeletons per tab branch** — sampled, not enumerated; the heuristic (files without loading keywords) produced ~30 candidates that were all presentational children on inspection.
- **Unreferenced exports in `packages/shared`** — barrel re-exports make a text sweep useless; a real check needs `knip` or `ts-prune`, which were not installed to keep the review read-only on the dependency graph.
- **`img.controller.ts` catch sites at :559, :618, :660, :678** — the four at :172–:265 were read and convert failures to 400/404; these four were not.
- **Shared-vs-api type-name collisions** — only spot-checked (`DenyReason` in `auth.controller.ts`, no collision).
- **Full tile-tier census** — the dominant `bg-card/60 backdrop-blur-sm` recipe was counted (~28 sites); only the recap chapters and home strips were checked for nesting.
