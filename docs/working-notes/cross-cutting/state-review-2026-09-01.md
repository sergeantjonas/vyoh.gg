# State-of-the-app review — 2026-09-01

**Status:** Reference — docs-and-in-flight sweep (Phases 0, 1, 2 and 6 of the state-review procedure) run on `main` @ `045217d6`. Phases 3–5 (architecture, code quality, project setup) were deliberately not run this pass; see § 7. **Chunk 1 (docs reconciliation) shipped 2026-09-01 in the commit that adds this note** — F-1, F-3, F-4 and N-1 → N-5 closed; F-0 landed earlier as `045217d6`. F-2, F-5 and chunk 3 are outstanding. The previous full sweep is [state-review-2026-07-25.md](state-review-2026-07-25.md); its findings F-1 through F-18 are all closed except F-14 (partial by decision), so this review does not re-litigate them.

Confidence labels: **CONFIRMED** = read the code or ran the command and saw it. **SUSPECTED** = pattern-matched, not verified.

---

## 1. Verdict

The repository is healthy and the launch is not blocked by anything in it. Lint, typecheck and every test suite pass on all three packages, the web production build succeeds, coverage clears every threshold, and there are zero `TODO`/`FIXME` markers, zero skipped tests, and no dead feature flags. August was the pre-launch month: 142 commits since 2026-08-01 landed owner auth, the DB-backed accounts roster with purge, backup and restore scripts, the endpoint-exposure remediation, viewer-scoped Steam reads with the hidden-games overlay, a 1.77 GB → 1.14 GB api image, and the launch runbook. [pre-launch-sweep.md:3](../ops/pre-launch-sweep.md) and [hosting.md:3](../ops/hosting.md) both state it plainly: **launch is blocked on buying the VPS and nothing else.**

**The single most important thing to do next is therefore not in the repo: buy the box and run the launch runbook** ([hosting.md § Launch runbook](../ops/hosting.md#launch-runbook--added-2026-08-20)). The three open gates (backups installed + one restore drill, DNS + `VITE_API_URL`, branch protection) all need the box or the GitHub settings page.

Two things have drifted in the evidence layer while the code moved. The append-only ship log [project-history.md](../project-history.md) stops at 2026-08-01, a month and ~140 commits behind `open-work.md`, and two June audit notes still read "none started" although one of their chunks shipped under the TanStack Start migration. One docs-only commit fixes all of it (§ 6, chunk 1). The other item to decide before it bites: the initial-JS bundle budget has 1.0 % headroom left (247.46 kB against 250 kB); the next feature chunk trips CI.

One defect was found and fixed during this session: the Steam achievement-schema poller threw on every game whose `GetGameAchievements` row omits `localized_desc` (Binding of Isaac: Rebirth's "Dead God"). Fixed at the client boundary in `045217d6`, unpushed.

---

## 2. In flight

Status strings quoted verbatim from each note's `**Status:**` header or the cited `open-work.md` line.

| Arc | Status as written | Blocker | Next concrete action |
|---|---|---|---|
| **Launch** ([pre-launch-sweep.md](../ops/pre-launch-sweep.md)) | "Eight of the eleven gates are closed as of 2026-08-13 … Launch is blocked on buying the VPS and nothing else." | VPS purchase | Buy the VPS; install backups + run one restore drill; set DNS / `VITE_API_URL`; enable branch protection; run the runbook. |
| Owner auth chunk 3 ([owner-auth.md](../ops/owner-auth.md)) | "Only chunk 3 remains … The rest of chunk 3 genuinely is wiring: a separate prod OAuth app, and the values themselves." | VPS | Create the prod GitHub OAuth app; set the four `requireEnv` values on the box. |
| Status-page admin (a)/(b) ([open-work.md:53](../open-work.md)) | "(c) shipped 2026-08-13; (a)/(b) remaining" | None | (a) Steam sync status row; (b) granular LoL sync triggers wrapped in `OwnerAction` + `GUARDED_ROUTES`. |
| Dormant chapter ranking follow-ups ([open-work.md:26](../open-work.md)) | "shipped 2026-08-25 … Still open, unscoped: the parked 'Greatest hits' chapter kind, and a sharper benchmark signal than completion" | None (unscoped) | Scope the unlock-gap-while-achievements-remain signal, or park it with a trigger. Freshest in-flight item (2026-08-25). |
| Achievement rarity drift R3 ([achievement-rarity-drift.md](../steam/achievement-rarity-drift.md)) | "R3 is no longer blocked on data; it needs a scoping decision" | Owner decision: launch-window beat vs. mature-library drift beat | Decide the beat's shape, then chunk. |
| Match-depth LP-overlay per duo ([match-depth-roadmap.md](../lol/match-depth-roadmap.md)) | "Phase D now complete except LP-overlay … unblocked 2026-08-13 when owner-auth shipped" | None for three weeks | Build it; closes Phase D outright. |
| Visual-excellence V7 status-page polish ([visual-excellence-audit-2026-06-12.md:3](visual-excellence-audit-2026-06-12.md)) | "V7 (status page) deferred — gated on owner-auth / status-admin restructure" | **Gate cleared** (owner-auth 2026-08-13, accounts-admin 2026-08-16); note not updated — see F-4 | Mark unblocked; pick up alongside status-page admin (a)/(b). |
| Steam player portrait cards 4 / 8 ([player-portrait.md](../steam/player-portrait.md)) | "Every chunk in the plan has shipped … What's left is blocked, not unscoped" | Sustained api uptime (`SteamPlaySession` needs a continuously running poller) | Waits for prod. Owner still owes a skim of the 154-tag allowlist. |
| Queue-id follow-ups ([open-work.md:21](../open-work.md)) | "Two follow-ups outstanding" | Classic-queue live label unobserved | Owner observes the next Classic game via spectator-v5; no code scoped. |
| Biome 1.9 → 2.x ([biome-2-migration.md](../ops/biome-2-migration.md)) | "Planned, not started. Evaluated and deferred 2026-07-26" | Staging-strategy decision; Biome 2 fails to parse `index.css` | Decide stage-behind-disabled-rules vs. one large commit. "Do not re-propose on version-currency grounds alone." |
| `typescript` 6 → 7 ([open-work.md:78](../open-work.md)) | "blocked upstream, re-tested 2026-07-26" | Nest CLI needs the programmatic compiler API | Capability trigger: retry when `pnpm --filter @vyoh/api build` passes under a stable 7.x. |
| CodeQL ([security.md:3](../ops/security.md)) | "CodeQL's stated trigger ('when the project grows an auth surface') now fires alongside owner-auth" | Owner-auth shipped; no workflow exists (`.github/workflows/` holds only `ci.yml`) | Reconcile with [pre-launch-sweep.md § Post-launch](../ops/pre-launch-sweep.md), which lists it as post-launch — see N-4. |
| Long tail, no blocker | LP3 personal fit; App Phase 6; folder-structure chunks 3/4 (trigger-gated); description-images A7 (trigger-gated); frontend-2026 KB files 18 + 19; TFT ("when it's cheap, not when it's urgent") | — | No action; correctly recorded as long-tail. |

### Recently landed (2026-08-01 → 2026-08-25)

Reconstructed from the notes' Status headers because `project-history.md` stops at 08-01 (F-1). Dates are the notes' own.

- 08-01 — Live-state ambience on `/`; queue-id migration closed (`Match.queueType` gone — CONFIRMED, 0 hits in `schema.prisma`).
- 08-01 → 08-06 — Steam player portrait, every chunk (`packages/shared/src/steam/portrait/` exists).
- 08-03 → 08-05 — API exposure audit + remediation (owner allowlist choke point, miss-path clamp, nginx `limit_req_zone` in `deploy/nginx/vyoh-cache.conf`, `/img` cache keying, Steam key redaction).
- 08-05 → 08-06 — Ingestion cron reliability: three self-sealing gates fixed; four pollers converted to staleness-driven.
- 08-07 / 08-12 — Achievement rarity drift R1 (history table) + R2 (`apps/api/src/scripts/probe-rarity-drift.ts`).
- 08-09 → 08-10 — Generative season artwork + shareable recap chapters, all five chunks (`apps/api/src/og/og-card.ts`).
- 08-11 → 08-12 — Wishlist "Upcoming" follow-on arc, chunks 0–5.
- 08-13 — Owner auth chunks 1 + 2 (`apps/api/src/auth/owner.guard.ts`, 5 non-test `@UseGuards(OwnerGuard)` sites); ValidationPipe V3 verified; timeZone sweep verified (0 of 37 formatter sites unpinned).
- 08-14 → 08-16 — Accounts admin chunks 1–3 (roster tables, hide/pause/remove, purge endpoints + confirmation dialog); `scripts/backup.sh` + `scripts/restore.sh` (08-15).
- 08-20 — api image 1.77 GB → 1.14 GB; launch runbook + incident restore procedure written; `compose.prod.yaml` fixed to pass the owner-auth env vars.
- 08-20 → 08-21 — Hidden games / two-axis curation overlay (`packages/shared/src/steam/curation.ts`), viewer-scoped Steam reads, curation table on `/status`, invariant lints; dev CSS nesting flattened with lightningcss.
- 08-23 — Owner can hide a wishlisted game from the row; new-purchase prompt.
- 08-25 — Dormant chapter ranking D1 (25 % completion gate) + D2.

### Drift check

- **CONFIRMED — the ship log is a month stale.** [project-history.md:18](../project-history.md) is headed "Last captured status — 2026-08-01" and nothing follows it; `git rev-list --count --since=2026-08-01 HEAD` = 142. `open-work.md` records at least eight arcs shipped 08-03 → 08-25. → F-1.
- **CONFIRMED — [audit-web-structure.md:3](audit-web-structure.md) "five chunks scoped, none started" is wrong for W5.** W5 (queryOptions factories + route-loader prefetch) shipped under the Start migration: 15 non-test files export `queryOptions(`, 11 route files call `ensureQueryData`/`prefetchQuery`. W1–W4 are genuinely untouched: `formatRelative` still defined in 3 files (`footer-chips.tsx`, `steam-chapter.tsx`, `ahri-chapter.tsx`) and `firstSentence` in 2; no sheen recipe under `lib/` or `components/` other than the nav wordmark; `match-detail-recap-tab.tsx` is 908 lines (was 911); `steam-chapter.tsx` / `ahri-chapter.tsx` are 1006 / 954 lines (were 1015 / 945) with no `home/recap/_shared/`. → F-3.
- **CONFIRMED — [audit-api-structure.md:3](audit-api-structure.md) "four chunks scoped, none started" is half-stale for A2.** Owner-auth chunk 1 (`68859382`, 2026-08-13) rewrote `apps/api/src/env.ts` and added boot-time `requireEnv` calls in `main.ts`, which is the failure mode A2 describes, though not the Zod-schema shape it prescribes. A1 is untouched (the only filter is `@Catch(RiotError)` at `riot.exception-filter.ts:4`); A3 hosting-gated by design; A4 untouched. → F-3.
- **CONFIRMED — V7's gate cleared without the entries moving.** [open-work.md:30](../open-work.md) and [visual-excellence-audit-2026-06-12.md:130](visual-excellence-audit-2026-06-12.md) both say "sequence after the status-page admin surface + owner-auth"; both landed (08-13, 08-16). → F-4.
- **CONFIRMED — [frontend-2026-gaps.md:3](frontend-2026-gaps.md)** still says one gap "folds into the parked tanstack-start-migration"; Start shipped 2026-07-27 and that note's own Gap 4 records the route tier shipping with it. → N-3.
- **CONFIRMED — [motion-choreography-arc.md:3](motion-choreography-arc.md)** reads "Active 2026-05-31" with M-1 → M-6 shipped and M-7 "the only remaining chunk in scope (separate arc)". No such arc exists, the note is not referenced from `open-work.md` or `parked.md`, and it was last touched 2026-05-31. → N-1.
- **CONFIRMED — three notes have zero referrers** anywhere under `docs/`, `CLAUDE.md`, or `README.md`: [deploy-and-test-tiers.md](../archive/deploy-and-test-tiers.md) (Draft, "partially overtaken 2026-07-27 … has *not* been rewritten"), [steam/library-row-redesign.md](../steam/library-row-redesign.md) ("Researching. No implementation.", untouched since 2026-05-25), [lol/match-count-cap.md](../lol/match-count-cap.md) (Reference, content fine). → N-2. Every other note is reachable transitively; all 143 links across the five index files resolve (0 broken).
- **CONFIRMED — no shipped claim without code.** Thirteen named artefacts from the August notes were checked and all resolve: `curation.ts`, `portrait/`, `backup.sh`, `restore.sh`, `probe-rarity-drift.ts`, `deploy/nginx` (`limit_req_zone`), `apps/web/server/index.ts`, `compose.prod.yaml`, `owner.guard.ts`, `curated-games-table.tsx`, `ValidationPipe` in `main.ts`, `queueType` absent from the schema, `lightningcss` in `vite.config.ts`.
- **CONFIRMED — the git tree is clean after `045217d6`.** No stashes, no unmerged branches. `origin/main` already carries the two 2026-08-25 commits; only the achievement fix is unpushed.
- **CONFIRMED — markers and test hygiene:** zero `TODO`/`FIXME`/`HACK`/`XXX` in `apps/**/src`, `packages/**/src`, `tools/**`; zero `.skip`/`.only`/`xit`/`it.todo`; zero commented-out test blocks; zero `@ts-expect-error`/`@ts-ignore`. 48 `biome-ignore` comments, each with a stated reason (mount-only animation deps, stable positional keys, sanitised `innerHTML`, APG semantics). One env gate, `MATCH_SYNC_ENABLED` at `apps/api/src/lol/match-sync.service.ts:22` — an operational switch, not a dead flag.
- **Hedged status lines:** none in `open-work.md` or `README.md`.

---

## 3. Validation baseline

All run on `main` @ `045217d6` in the devcontainer.

| Check | Result |
|---|---|
| `tokf err pnpm run check:cc` | **PASS** — no diagnostics |
| `tokf err pnpm run typecheck:cc` | **PASS** — all three packages |
| `tokf test pnpm run test:cc` | **PASS** — all packages |
| `pnpm --filter @vyoh/web build` | **PASS** — client + server bundles, `dist/` 13 MB |
| `pnpm --filter @vyoh/web size` | **PASS, 1.0 % headroom** — initial JS (entry + static imports) **247.46 kB gzip / 250 kB limit**; Recharts lazy chunk 68.25 kB / 85 kB |
| `pnpm run coverage:cc` | **PASS** on every threshold — table below |
| Perf probe | **Not run** — needs a warm dev server; see § 7 |

Bundle against [perf-baseline.md:194–196](perf-baseline.md): the post-Start figure recorded on 2026-07-27 was **241.65 kB** with "~3.3 % headroom". Today's 247.46 kB is **+5.8 kB in five weeks** with no entry in the baseline note explaining it. → F-2.

### Coverage

| Package | Statements | Branches | Functions | Lines | vs. 2026-07-25 |
|---|---|---|---|---|---|
| `packages/shared` | 96.69 % (min 95) | 90.41 % (min 89) | **97.27 % (min 97)** | **99.08 % (min 99)** | down: 97.07 / 90.91 / 99.40 / 99.79 |
| `apps/api` | 93.00 % (min 92) | 84.39 % (min 82) | 95.11 % (min 94) | 95.05 % (min 94) | up from 92.40 / 83.02 / 94.58 / 94.60 |
| `apps/web` | 81.61 % (min 79) | 66.23 % | 89.66 % (min 86) | 92.47 % (min 90) | up from 80.31 / 64.33 / 86.12 / 90.95 |

`apps/web` improved on every axis since July. `packages/shared` sits **0.27 pt above its functions threshold and 0.08 pt above lines** — seven untested functions out of 257, eleven uncovered lines out of 1,205. → F-5.

### 3a. Where `apps/web` is uncovered

26 of ~520 web source files sit under 60 % statement coverage; eleven are at **0 %** (no test imports them). Names resolved from the truncated text-reporter rows against the source tree; the two marked † are ambiguous between sibling files. CONFIRMED for the rest.

At 0 %: `lol/champions/champion-hero.tsx`, `steam/game/game-panel-hero.tsx`, `lol/_shared/ui/champion-sticky-strip.tsx`, `lol/_shared/account/live-game-chip.tsx`, `lol/profile/profile-lp-history-tooltip.tsx`, `lol/patches/patches-search.ts`, `steam/use-safari-slide-direction.ts`, `steam/wishlist/wishlist-all-panel.tsx` †, `components/fetch-progress.tsx` or `components/scroll-progress.tsx` †, and two `routes/lol/**/index.tsx` route files.

Under 60 %: `components/ui/dropdown-menu.tsx` 13.8 %, `match-record.tsx` 33.3 %, `lib/view-transition-nav.ts` 42.1 %, `use-lp-delta.ts` 47.1 %, `routes/lol/$accountSlug.tsx` 50 %, `cv-section.tsx` 50 %, `sitemap[.]xml.ts` 50 %, `steam/library/library-row.tsx` 50.3 %, `stat-row.tsx` 51.9 %, `home/atmosphere/*live-ambience.ts` 52.9 %, `audio-recipes.ts` 53.4 %, `lol/profile/use-habits-stats.ts` 55 %, `use-champions.ts` 57.6 %, `steam/library/library-grid-virtual.tsx` 59.3 %, `lol/matches/match-spell-casts.tsx` 59.8 %.

The two panel heroes and the sticky strip are the notable ones: they are the surfaces the Radix-portal-child-owns-effects lesson was learned on (`GamePanelHero` mirrors `MatchHero`, commit `1a2a3d87`), carry mount-only animation `biome-ignore`s, and have no test at all. The rest is the same shape the 07-25 review named — route-level files without a sibling test — plus small hooks. None of this fails a threshold today; it is where the web branch figure (66 %) comes from.

---

## 4. Findings

### Blocking

None. Every validation command passes.

### Should fix

**F-0 · Achievement-schema poller threw on rows without a description. CONFIRMED — FIXED `045217d6` this session.** Steam's `IPlayerService/GetGameAchievements` omits `localized_desc` outright on some rows regardless of `hidden` (appid 250900, "Dead God"); the client mapped it to `undefined` and the non-null `SteamGameAchievement.description` column rejected the upsert, so that game's schema never wrote (logged as a per-appid `WARN`, so the api still booted). Fixed at the client boundary (`steam-client.service.ts:240` defaults to `""`; `types.ts:429` marks the raw field optional; a spec row added). No note tracked it — no housekeeping owed. **Unpushed.**

**F-1 · `project-history.md` stops at 2026-08-01. CONFIRMED.** Evidence: [project-history.md:18](../project-history.md) "Last captured status — 2026-08-01"; 142 commits since. **Why it matters:** `CLAUDE.md` points at this file as "recent shipped arcs, repo evolution", and it is the first place a case-study reader lands to answer "when did X land". Today it says the app froze the day the pre-launch month began. **Fix:** append one "Last captured status" block per shipped arc from the list in § 2 (12 entries, one line each pointing at the owning note). **Effort:** 30 min, docs-only.

**F-2 · Initial-JS budget is 2.54 kB from tripping, unexplained. CONFIRMED.** Evidence: `size-limit` output above; [perf-baseline.md:194](perf-baseline.md) recorded 241.65 kB on 07-27. **Why it matters:** the next feature chunk fails the "Bundle size budget" CI job (`ci.yml:111–127`) with no diagnosis on file, and the fix under time pressure will be "raise the number". **Fix:** attribute the +5.8 kB (build at `467e29f9` and at `HEAD`, diff the manifest's static-import set), then either trim or raise the ceiling *with the reason recorded* in both `.size-limit.cjs` and `perf-baseline.md`. **Effort:** one sub-session.

**F-3 · Two June audit notes' Status headers are stale. CONFIRMED.** Evidence in § 2 drift check. **Why it matters:** both are Active notes indexed from `open-work.md:28` via [audit-2026-06-11.md](audit-2026-06-11.md); a reader scoping "what structural work is open" gets W5 as open when it shipped, and gets no trigger for W1–W4. **Fix:** flip W5 to "shipped via Start migration 2026-07-27"; record A2 as "boot-time `requireEnv` landed with owner-auth; Zod schema not pursued"; either promote W1–W4 / A1 / A4 into `open-work.md` with triggers (W4's is already written: "before scoping chapter #3") or move them to `parked.md`. **Effort:** 20 min, docs-only.

**F-4 · V7's gate cleared but both entries still say "deferred". CONFIRMED.** Evidence: [open-work.md:30](../open-work.md), [visual-excellence-audit-2026-06-12.md:130](visual-excellence-audit-2026-06-12.md); owner-auth 08-13, accounts-admin 08-16. **Why it matters:** the "don't soften status lines" rule exists because hedged or stale gates silently demote items in the next scoping sweep — this one already survived one (2026-08-01 survey). **Fix:** mark V7 unblocked in both places, sequenced with status-page admin (a)/(b). **Effort:** 5 min.

**F-5 · `packages/shared` coverage thresholds have <0.3 pt headroom. CONFIRMED — FIXED 2026-09-01** by covering the seven functions (`isRecentlyEngaged`, `excludeBarelyPlayedInWindow`, `emptyRankHistory`, `visibleAppidFilter`, and the three sort comparators in `backlog.ts` / `pregame-signals.ts`) plus `PLATFORMS`: functions 97.27 → 99.61 %, lines 99.08 → 99.75 %, thresholds unchanged. Evidence: functions 97.27 % vs min 97; lines 99.08 % vs min 99 ([vitest.config.ts:18](../../../packages/shared/vitest.config.ts)). Down from 99.40 / 99.79 on 07-25. **Why it matters:** the next shared helper that lands with an untested branch fails CI on a threshold rather than a defect. The same-commit-test bar makes that recoverable, but it converts a convention into a CI fight. **Fix:** either cover the 7 uncovered functions (run `pnpm --filter @vyoh/shared test -- --coverage` and read the per-file table) or lower functions → 96 and lines → 98 with a one-line reason. **Effort:** 30 min.

### Nice to have

**N-1 · "Active" labels that mean "reference".** [motion-choreography-arc.md](motion-choreography-arc.md) (M-7 orphan, untouched since 05-31), [self-portrait-surfaces.md](self-portrait-surfaces.md) (05-31), [lol/app-state-analysis.md](../lol/app-state-analysis.md) ("last fresh read 2026-05-13"), [steam/api-surface-survey.md](../steam/api-surface-survey.md), [frontend-2026-sweep-queue.md](frontend-2026-sweep-queue.md) and [frontend-2026-kb-expansion.md](frontend-2026-kb-expansion.md) (both 06-14). None has a next action anyone is taking. Relabel Reference or Shipped, or give each one a trigger. **Effort:** 15 min, folds into chunk 1.

**N-2 · Three orphan notes.** Archive [deploy-and-test-tiers.md](../archive/deploy-and-test-tiers.md) (its own Status says two premises were settled and it was not rewritten); park [steam/library-row-redesign.md](../steam/library-row-redesign.md) with a trigger and link it from `parked.md`; add an index line for [lol/match-count-cap.md](../lol/match-count-cap.md) in `README.md`. **Effort:** 10 min, folds into chunk 1.

**N-3 · [frontend-2026-gaps.md:3](frontend-2026-gaps.md)** still calls the Start migration "parked". Rewrite the status line to "Gap 3 (RUM backend) is the only open gap, post-launch". **Effort:** 2 min.

**N-4 · CodeQL sequencing disagrees between notes.** [security.md:3](../ops/security.md) says its trigger "now fires alongside owner-auth"; [pre-launch-sweep.md § Post-launch](../ops/pre-launch-sweep.md) lists it as post-launch; `.github/workflows/` has no CodeQL job. Pick one and say it in both. **Effort:** 5 min.

**N-5 · [landing-live-hero.md](landing-live-hero.md)** has read "Planned 2026-05-31" for three months and is reachable only from the closed [landing-showcase-arc.md](landing-showcase-arc.md). Park with a trigger or drop. **Effort:** 5 min.

**N-7 · Pre-existing broken relative links in older notes. CONFIRMED, not fixed here.** The reachability check in § 2 covered note-to-note `.md` links only. A path check over every link in the notes chunk 1 touched found ~33 that do not resolve, all predating this session and all the same shape — one `../` level short when pointing out of `docs/working-notes/` (e.g. `../../apps/web/src/...` from `cross-cutting/`, `../repo-conventions.md` from `archive/`): [motion-choreography-arc.md](motion-choreography-arc.md) 9, [landing-live-hero.md](landing-live-hero.md) 8, [frontend-2026-gaps.md](frontend-2026-gaps.md) 7 (including `frontend-2026-kb-refresh-queue.md`, since renamed, and a bare `owner-auth.md`), [project-history.md](../project-history.md) 6, [archive/README.md](../archive/README.md) 1, [ops/security.md](../ops/security.md) 1, [lol/app-state-analysis.md](../lol/app-state-analysis.md) 1. Links into `~/.claude/` are machine-local by design and excluded from the count. **Fix:** a scripted pass that rewrites the depth and verifies each target exists; targets that no longer exist get unlinked. **Effort:** 30 min.

**N-6 · Auto-memory staleness.** `project_next_visible_payoff_picks` (2026-08-01) lists the Steam portrait chunk 2 as "next" and the season-artwork + share arc as unstarted; both shipped (08-06, 08-10). Its "queue-id chunk 4 may be in flight in a parallel session" warning is also stale. Candidate for rewrite to "all three shipped; next pick is open". Not deleted by this review.

---

## 5. Checked and healthy

- **Validation** — Biome, typecheck, tests, production web build all pass; coverage clears every threshold.
- **Markers and test hygiene** — zero TODO-class markers, zero skipped/focused tests, zero TS suppressions; every `biome-ignore` carries a reason.
- **Index integrity** — 143 links across `README.md`, `open-work.md`, `parked.md`, `project-history.md`, `CLAUDE.md` all resolve; all 47 `open-work.md` links point at existing notes; status lines in both indexes are decisions, not hedges.
- **Shipped-note accuracy** — 13 named August artefacts all resolve to code.
- **Git state** — clean tree, no stashes, no unmerged branches, one unpushed commit (the F-0 fix).
- **README claims** — pnpm 11 / Node 22 match `package.json`; the LoL and Steam route shapes match the route tree (verified by the 07-25 review, unchanged since).
- **Launch gate bookkeeping** — `pre-launch-sweep.md` and `hosting.md` agree with each other and with the code on what is left.

---

## 6. Recommended next three chunks

**Chunk 1 — Docs reconciliation (F-1, F-3, F-4, N-1 → N-5).** One docs-only commit: append the twelve August entries to `project-history.md`; flip W5 / A2 in the two audit notes and give W1–W4 / A1 / A4 a home in `open-work.md` or `parked.md`; mark V7 unblocked; relabel the six stale Actives; archive `deploy-and-test-tiers.md`, park `library-row-redesign.md` and `landing-live-hero.md`, index `match-count-cap.md`; fix the `frontend-2026-gaps` sentence and the CodeQL sequencing. Roughly 14 files, all under `docs/`. Fits one context window if the entries are written from § 2 of this note rather than re-derived.

**Chunk 2 — Budget headroom (F-2 + F-5).** Attribute the +5.8 kB initial-JS growth since `467e29f9`, then trim or re-set the ceiling with the reason in `.size-limit.cjs` and `perf-baseline.md`; in the same session, read shared's per-file coverage and either cover the seven functions or lower the two thresholds with a note. Two small commits.

**Chunk 3 — LP-overlay per duo.** The only Phase D item left, unblocked since 2026-08-13, and it turns "Phase D complete except…" into "Phase D complete" across `CLAUDE.md`, `match-depth-roadmap.md` and `open-work.md`. Read [match-depth-roadmap.md](../lol/match-depth-roadmap.md) § D and the duo/squad detection code first. If polish outranks a feature this week, V7 status-page (now unblocked) sequenced with status-page admin (a)/(b) is the alternative.

And outside the repo, ahead of all three: **buy the VPS and run the launch runbook.**

---

## 7. Not checked

- **Phase 3 (architecture)** — package boundaries, `excludeRemakes()` coverage, route/stream separation, api layering, the visual-convention compliance sweep. Not in this pass's scope; the structural lints in `apps/api/src/conventions.spec.ts` pass, which covers the machine-checkable subset.
- **Phase 4 (code quality)** — file-size outliers, duplication, type-safety erosion, dead code, a11y scan coverage. Not run. W3's 908-line recap tab and the ~1000-line chapters are the known outliers and are already tracked (F-3).
- **Phase 5 (project setup)** — tsconfig / Biome config, `pnpm outdated`, generated-file list, secrets, devcontainer pinning. Not run. CI was inspected only far enough to list its four jobs (lint+typecheck+api build+coverage; prod audit; bundle budget).
- **Perf probe and Lighthouse** — not run; the probe needs a warmed dev server and the devcontainer cannot run Lighthouse (`perf-baseline.md:3`).
- **Per-file coverage for `packages/shared` and `apps/api`** — only the web per-file table was extracted (§ 3a); the seven uncovered shared functions behind F-5 were not named.
