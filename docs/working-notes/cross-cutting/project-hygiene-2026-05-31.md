# Project hygiene audit — 2026-05-31

**Status:** Active — second-round structural/duplication audit, ~13 days after [project-hygiene-2026-05-18.md](project-hygiene-2026-05-18.md). Ran as a four-Explore fan-out (web structure, api structure, cross-package duplication, readability/generalization). **Headline:** boundaries and conventions remain disciplined; the new drift is concentrated in time/queue/playtime formatters that re-fragmented since F1, plus a clean generalization opportunity in Steam fact-chips. **Chunks shipped: none yet. Pending: F2, Q1, R3, C1, X1, X2. Deferred (independent sessions): D1–D4 below.**

The first-round audit (2026-05-18) caught and shipped F1 (formatters), R1/R2 (excludeRemakes), V1/V2 (ValidationPipe + GET DTOs), T1–T5 (web tests + axe). This second round was scoped to "is the structure still holding, and what slipped since?" — not a re-run of the same checks.

## Verification corrections (read first)

Two cross-checks the agents got *partially* wrong on initial pass — recorded so a future audit doesn't re-raise them:

1. **`profile-lp-history.tsx` size is contested between agents.** The structure agent flagged 1123L as bloated; the readability agent spot-checked the same file and called it "acceptable — 16 useEffect/useMemo with substantive comments, clean code paths." Both reads are partially right: the file isn't unreadable, but pure helpers (constants, tooltip className, queue label) are co-located with chart rendering. The X1 chunk below is a *relocation*, not a refactor.
2. **Steam `_shared/` flatness is fine.** First-round agent suggested adding subdirs to mirror LoL's 7-deep taxonomy. Steam's 26 files don't have the cross-cutting concept density that justifies subdirs yet. Do NOT promote this to a chunk; revisit if Steam doubles.

## What's solid (do not re-litigate)

- **Per-stream domain boundaries.** LoL (301 files) and Steam (128 files) never cross-import. Per-stream route convention from [repo-conventions.md](../repo-conventions.md) is being followed.
- **`_shared/` / `components/` / `lib/` split.** Three-bucket separation is coherent — cross-domain primitives in `components/`, cross-app utilities in `lib/`, cross-section concerns (backdrop, section-layout) in `_shared/`.
- **API module boundaries.** Nest modules properly scoped, Riot rate-limiter centralized in `riot/` and consumed by `lol/` cleanly, no service reaching into another module's internals, no direct `PrismaClient` outside `PrismaModule`. Steam has its own rate-limiter (96L) — justified by different quota model, not duplication.
- **Convention adherence sweep is high.** SectionTitle/CardTitle bifurcation landed cleanly (zero ad-hoc `<h3 className="text-sm font-semibold">` found), `useChampionName()` adopted (zero raw alias renders found), `cursor-pointer` discipline holds on sampled buttons, no native HTML `title=` attributes (the ~10 hits are SVG fallback `title` elements, not HTML attributes — intentional).
- **`excludeRemakes()` adoption.** Zero inline `!m.remake` checks found across `/lol` routes. R1/R2 convention landed and is being followed.
- **Test colocation.** ~274 colocated `*.test.tsx` files. Same-commit-as-code discipline visible in recent arcs.
- **Comment hygiene.** Zero orphan TODOs across the repo. Inline comments where they exist explain non-obvious WHY (React 19 StrictMode guard in match-list, viewport hover thresholds, art priority cascade).
- **Scripts directory.** All 14 backfill/maintenance scripts in `apps/api/src/scripts/` align with shipped arcs or ongoing maintenance — no stale scripts left from shipped arcs.

## Open issues, ranked

### 1. Time + playtime formatters re-fragmented since F1 — moderate

F1 (2026-05-18) consolidated `formatDuration`/`formatPlaytime`/`formatGold` into `@vyoh/shared`. Since then four new copies of a *month/year-aware* `relativeTimeAgo()` appeared in Steam surfaces, and one site shadowed the shared `formatPlaytime` locally.

- `relativeTimeAgo()` — 4 copies: [library-tile-hovercard.tsx:39-45](../../../apps/web/src/steam/library/library-tile-hovercard.tsx#L39-L45), [library-row.tsx:26-32](../../../apps/web/src/steam/library/library-row.tsx#L26-L32), [time-to-100-card.tsx:24-31](../../../apps/web/src/steam/game/time-to-100-card.tsx#L24-L31), [last-progressed-card.tsx:12-19](../../../apps/web/src/steam/game/last-progressed-card.tsx#L12-L19); plus inline `relativeTime.format()` in [recent-unlocks-chip.tsx:16-20](../../../apps/web/src/steam/recent-unlocks-chip.tsx#L16-L20). `@vyoh/shared`'s `formatTimeAgo` only covers the short form (minutes/hours/days).
- `formatPlaytime()` shadow — local def in [library-tile-hovercard.tsx](../../../apps/web/src/steam/library/library-tile-hovercard.tsx) while siblings import from shared. Re-implements a "TIME PLAYED" verbose variant ("3.4 hrs"). May be intentional Steam-UI parity, but the shadowing of the same name is hostile — either rename + document or upstream the variant.

### 2. Queue-label sprawl, already drifting — moderate

`queueLabel(id)` and the LoL queue-id → display map exist in **5 separate sources**, and labels have already drifted (API says "Ranked Solo", web's live-helpers says "Ranked Solo/Duo"):

- Canonical (API): [apps/api/src/lol/queue-types.ts](../../../apps/api/src/lol/queue-types.ts)
- [apps/web/src/lol/live/live-helpers.ts:3-22](../../../apps/web/src/lol/live/live-helpers.ts#L3-L22) — separate `QUEUE_NAMES`
- [apps/web/src/lol/_shared/queue/queue-options.ts](../../../apps/web/src/lol/_shared/queue/queue-options.ts) — UI subset
- Triplicate inline `QUEUE_LABEL` in three profile components: [profile-lp-history.tsx:39-58](../../../apps/web/src/lol/profile/profile-lp-history.tsx#L39-L58), [hero-rank-strip.tsx](../../../apps/web/src/lol/profile/hero-rank-strip.tsx), [profile-season-history.tsx](../../../apps/web/src/lol/profile/profile-season-history.tsx)

Per the "Centralise domain invariants" rule, queue metadata clearly belongs in `packages/shared/src/lol/`.

### 3. Remake threshold inlined — moderate

`excludeRemakes()` shipped in R1 but the underlying *threshold* (`gameDuration < 210s`) is still inlined at [apps/api/src/lol/match-mapper.ts:135](../../../apps/api/src/lol/match-mapper.ts#L135). The 210s number is the Season 2 2026 inting-surrender boundary — documented in [CLAUDE.md § Architectural patterns](../../../CLAUDE.md). If the API ever lets a remake-shaped match through (e.g. a future patch shifts the boundary, or a code path bypasses the mapper), web has no guard. Cheap to centralize.

### 4. Steam fact-chip boilerplate — clean generalization opportunity

Five Steam chips repeat the same `useHook() → pending/error/empty/data → FactCard` shape with identical structure (40–60 lines each):

- [platform-mix-chip.tsx](../../../apps/web/src/steam/platform-mix-chip.tsx)
- [owned-games-chip.tsx](../../../apps/web/src/steam/owned-games-chip.tsx)
- [wishlist-chip.tsx](../../../apps/web/src/steam/wishlist-chip.tsx)
- [recent-unlocks-chip.tsx](../../../apps/web/src/steam/recent-unlocks-chip.tsx)
- [library-composition-chip.tsx](../../../apps/web/src/steam/library-composition-chip.tsx)

Five identical shells crosses the "three similar lines beat a premature abstraction" line by a comfortable margin. A `DataFactCard<T>` render-prop wrapper collapses each to ~15 lines and makes the next chip trivial.

### 5. File-size relocations — minor

[profile-lp-history.tsx](../../../apps/web/src/lol/profile/profile-lp-history.tsx) (1123L) and [match-review-view.tsx](../../../apps/web/src/lol/matches/match-review-view.tsx) (1022L) co-locate pure helpers/constants with rendering. The component code itself is readable per spot-check; the issue is the file footprint, not the structure inside it. X1 and X2 below are relocation chunks, not refactors.

### 6. Over-nested `_shared/` — micro

[apps/web/src/lol/trends/_shared/conclusion-card.tsx](../../../apps/web/src/lol/trends/_shared/conclusion-card.tsx) — a single file inside a feature-internal `_shared/` dir. Either promote to `lol/_shared/ui/conclusion-card.tsx` (if reused elsewhere) or inline into its sole consumer. Folds into X2.

## Considered, not actionable

- **`lol.service.ts` (1026L) / `lol-static-sync.service.ts` (1031L) / `lol-analytics.service.ts` (833L)** — domain-justified per audit. Surface in D1 below as a *watch*, not a chunk.
- **API response DTOs as shared types** — real future-proofing value but separate arc; not a hygiene fix. Surfaces in D4 below.
- **Steam `_shared/` flat layout** — see verification corrections above. Not actionable.
- **`match-detail-view.tsx` (1009L)** — spot-check called it acceptable. Listed in D3 below as a *standby* split, only if it grows.
- **Response-type sync gap.** API DTOs and web fetch types diverge today (web infers from runtime). Real risk but the cost of fixing is higher than the savings here; D4.

## Suggested next moves (priority order)

1. **F2 + Q1 + R3 as a single shared-utility sweep** — same shape (shared module + sweep call sites), can land in one session if context is fresh.
2. **C1 — Steam fact-chip primitive** — independent and self-contained.
3. **X1 + X2 — relocations** — independent, can defer.
4. **D1–D4 — deferred sessions** — each scoped below.

## Chunked plan (2026-05-31)

Order is dependency-aware: F2 → Q1 → R3 → C1, then X1/X2 independent. Suggest `/compact` between the shared-utility sweep (F2+Q1+R3) and C1 if context fills.

### F2 — Shared `relativeTimeAgo()` + remove local `formatPlaytime` shadow (1 chunk)

**New code:** extend `packages/shared/src/format.ts` with `relativeTimeAgo(date | timestamp): string` covering minute → year buckets via `Intl.RelativeTimeFormat("en-US")`. Cover boundary cases (29d, 30d, 12mo) in `packages/shared/src/format.test.ts`.

**Migrations (5 sites):**
- [steam/library/library-tile-hovercard.tsx](../../../apps/web/src/steam/library/library-tile-hovercard.tsx) — replace local `relativeTimeAgo` AND remove local `formatPlaytime` (use shared)
- [steam/library/library-row.tsx](../../../apps/web/src/steam/library/library-row.tsx)
- [steam/game/time-to-100-card.tsx](../../../apps/web/src/steam/game/time-to-100-card.tsx)
- [steam/game/last-progressed-card.tsx](../../../apps/web/src/steam/game/last-progressed-card.tsx)
- [steam/recent-unlocks-chip.tsx](../../../apps/web/src/steam/recent-unlocks-chip.tsx) — replace inline `relativeTime.format()`

**Risk:** the verbose "3.4 hrs" / "73 hrs" playtime variant in library-tile-hovercard may be intentional Steam-UI parity. If so, upstream it as `formatPlaytimeVerbose()` in the same commit rather than removing the local copy.

**Validate:** `verify:cc`; spot-check Steam library tile hover, library row, game-detail cards, recent-unlocks chip — strings unchanged unless an intentional consolidation was applied.

**Commit:** `refactor: consolidate relative-time formatter into shared`

### Q1 — Shared LoL queue metadata (1 chunk)

**New module:** `packages/shared/src/lol/queue-types.ts` — port from canonical [apps/api/src/lol/queue-types.ts](../../../apps/api/src/lol/queue-types.ts). Export `QUEUE_TYPES`, `queueLabel(id: number): string`, `RANKED_QUEUE_MAP`, `RankedQueueKey` type. Re-export from `packages/shared/src/index.ts`.

**Tests:** `packages/shared/src/lol/queue-types.test.ts` — unknown ids, ranked filter, label parity with the previous API map.

**Label drift decision:** "Ranked Solo" vs "Ranked Solo/Duo". Pick one. API canonical = "Ranked Solo". Web's `live-helpers.ts` reads "Ranked Solo/Duo" — adopt the API form unless owner prefers the wider live label (likely yes for the live-game surface specifically). If retaining "Ranked Solo/Duo" only on live, expose a `queueLabelExpanded(id)` variant.

**Migrations:**
- [apps/api/src/lol/queue-types.ts](../../../apps/api/src/lol/queue-types.ts) — collapse to a re-export from shared, or delete + sweep imports
- [apps/web/src/lol/live/live-helpers.ts](../../../apps/web/src/lol/live/live-helpers.ts) — drop `QUEUE_NAMES`
- [apps/web/src/lol/_shared/queue/queue-options.ts](../../../apps/web/src/lol/_shared/queue/queue-options.ts) — derive from shared
- Profile triplicate: [profile-lp-history.tsx](../../../apps/web/src/lol/profile/profile-lp-history.tsx), [hero-rank-strip.tsx](../../../apps/web/src/lol/profile/hero-rank-strip.tsx), [profile-season-history.tsx](../../../apps/web/src/lol/profile/profile-season-history.tsx)

**Validate:** `verify:cc`; verify LP-history dropdown labels and live-game queue label match the chosen canonical form.

**Commit:** `refactor: centralize lol queue metadata in shared`

### R3 — Remake threshold as shared constant (1 chunk)

**Extend** `packages/shared/src/lol/exclude-remakes.ts`: add `REMAKE_DURATION_S = 210` and `isRemakeMatch({ gameEndedInEarlySurrender, gameDuration })`. Re-implement `excludeRemakes` using `isRemakeMatch`.

**Tests:** `packages/shared/src/lol/exclude-remakes.test.ts` — boundary (209/210/211), early-surrender false → never remake regardless of duration.

**Migration:** [apps/api/src/lol/match-mapper.ts:135](../../../apps/api/src/lol/match-mapper.ts#L135) — replace inline check with `isRemakeMatch(participant, match.info)`.

**Validate:** `verify:cc`; run LoL match-mapper tests and any analytics aggregation tests.

**Commit:** `refactor: centralize remake threshold as shared constant`

### C1 — Steam fact-card data primitive (1 chunk)

**New primitive:** `apps/web/src/steam/_shared/fact-card-data.tsx` — render-prop wrapper around existing `FactCard`. Shape sketch:

```tsx
<FactCardData query={useOwnedGames()} title="Library size" emptyLabel="No games tracked">
  {({ data }) => <span>{data.count}</span>}
</FactCardData>
```

Handles pending (skeleton matching existing chip dimensions), error (existing error tone), empty (configurable label), success (renders children). Skeleton must mirror the card layout per [repo-conventions.md § Skeleton loaders](../repo-conventions.md).

**Tests:** `fact-card-data.test.tsx` covering all four states + axe scan (interactive surfaces convention).

**Migrations (5 chips):** [platform-mix-chip.tsx](../../../apps/web/src/steam/platform-mix-chip.tsx), [owned-games-chip.tsx](../../../apps/web/src/steam/owned-games-chip.tsx), [wishlist-chip.tsx](../../../apps/web/src/steam/wishlist-chip.tsx), [recent-unlocks-chip.tsx](../../../apps/web/src/steam/recent-unlocks-chip.tsx), [library-composition-chip.tsx](../../../apps/web/src/steam/library-composition-chip.tsx).

**Pre-flight:** read each chip first to inventory pending/empty copy variants. If any chip has non-default strings, pass them as props rather than hardcoding into the primitive.

**Validate:** `verify:cc`; eyeball each chip in dev with pending (DevTools Slow 3G) and error (DevTools offline) states.

**Commit:** `refactor: extract data-fact-card primitive for steam chips`

### X1 — Relocate `profile-lp-history.tsx` helpers (1 chunk)

**Goal:** chart file becomes render-only; pure helpers + constants live alongside.

**New files (all `apps/web/src/lol/profile/`):**
- `profile-lp-history-constants.ts` — `QUEUE_COLOR`, `RANGE_LABEL`, gap/session thresholds, tooltip className constant. (`QUEUE_LABEL` is gone post-Q1.)
- `profile-lp-history-tooltip.tsx` — tooltip component (lives where the chart imports it).
- Optionally `profile-lp-history.helpers.ts` for any pure derive functions found during the read.

**Out of scope:** brush/zoom UX, chart logic, hook composition — relocation only.

**Validate:** `verify:cc`; visual check that the chart still renders with hover/zoom intact and the dropdown labels match (assumes Q1 shipped).

**Commit:** `refactor: split profile-lp-history into chart + constants + tooltip`

### X2 — Extract `match-review-view.tsx` verdict logic + relocate `conclusion-card` (1 chunk)

**New file:** `apps/web/src/lol/matches/match-review-logic.ts` — pure functions `buildHighlightChips`, `getLaningVerdict`, `getMidVerdict`, `getLateVerdict`. These are pure → easy unit coverage.

**Tests:** `match-review-logic.test.ts` — one fixture per verdict builder, including edge cases (no data, all data, threshold boundaries).

**Update:** [match-review-view.tsx](../../../apps/web/src/lol/matches/match-review-view.tsx) — keep `MatchReviewView` only.

**Conclusion-card relocation:** `ugrep -l "conclusion-card" apps/web/src` to find consumers. If reused elsewhere → promote to `apps/web/src/lol/_shared/ui/conclusion-card.tsx`. If sole consumer → inline. Either choice removes the over-nested `lol/trends/_shared/` dir.

**Validate:** `verify:cc`; visual smoke on match-review page.

**Commit:** `refactor: extract match-review verdict logic + relocate conclusion-card`

## Deferred — independent sessions (D1–D4)

Each item below needs its own session because the scope or risk doesn't fit the hygiene-sweep shape. Listed with trigger conditions so a future session can scoop the next one cold.

### D1 — LoL service trio: god-class watch

**Scope:** [apps/api/src/lol/lol.service.ts](../../../apps/api/src/lol/lol.service.ts) (1026L), [apps/api/src/lol/lol-static-sync.service.ts](../../../apps/api/src/lol/lol-static-sync.service.ts) (1031L), [apps/api/src/lol/lol-analytics.service.ts](../../../apps/api/src/lol/lol-analytics.service.ts) (833L). Each is at the threshold where the *next* +200 lines should land as a sub-service rather than a continuation.

**Trigger:** any new arc that would extend one of these files past ~1250L. Examples that would qualify: a new analytics dimension (matchup-by-patch, role-vs-role), a new static sync source (Communitydragon fallback added at the service rather than at the image-resolver), a new orchestration responsibility on the core service.

**Likely splits (sketch — not committed):**
- `lol.service.ts` — extract `MatchCacheService` (cache reads/writes), `RankHistoryService` (rank delta + reset), keep orchestration only.
- `lol-static-sync.service.ts` — split per-source (champions+items, abilities+runes, queues+maps) into focused sync subservices, keep an orchestrator that invokes them.
- `lol-analytics.service.ts` — `CalibrationService` extracts the calibration math; `MatchupService` separates from generic champion analytics.

**Risk:** Nest's DI graph is forgiving of service splits but a partial extraction (helper class with no Nest module) can split cleanly without ceremony. Don't pre-emptively `@Injectable` everything — extract pure functions first, classes only when state or DI is needed.

**Estimated size:** 1–2 chunks per service, each its own commit. Budget a full context window per service if pursued.

**Status:** standing watch — do NOT pre-emptively split.

### D2 — `img/img.controller.ts` spot-check

**Scope:** [apps/api/src/img/img.controller.ts](../../../apps/api/src/img/img.controller.ts) (611L). Controller-class size is unusual; the audit couldn't confirm without reading whether it's routing-only (acceptable) or contains transform logic (should move to services).

**Trigger:** next time anyone is editing the image pipeline (new asset family, new fallback source, new transcode op). Read top + bottom + a middle section first to characterize; only then decide.

**Likely outcomes:**
1. **Routing-heavy controller** — leave as-is, document why.
2. **Transform logic inline** — extract image-shape-specific transforms to `apps/api/src/img/transforms/*` and inject them into the controller, which becomes a thin router.

**Estimated size:** 30–60 minute spot-check; up to 1 chunk if transforms exist.

**Status:** investigation-first; no commitment until the read happens.

### D3 — `match-detail-view.tsx` standby split

**Scope:** [apps/web/src/lol/matches/match-detail-view.tsx](../../../apps/web/src/lol/matches/match-detail-view.tsx) (1009L). Houses three exported tab components (`MatchRecapTab`, `MatchYourGameTab`, `MatchTimelineTab`).

**Trigger:** when the next match-detail tab arc lands (e.g. the deferred MD2 owner-data catalog full rune page panel from [match-depth-roadmap.md](../lol/match-depth-roadmap.md)), or when readability degrades below the current spot-check rating.

**Likely split:**
- `match-detail-recap-tab.tsx`
- `match-detail-your-game-tab.tsx`
- `match-detail-timeline-tab.tsx`
- `match-detail-view.tsx` — thin shell with tab routing only.

**Risk:** shared state between tabs (scroll position, hover state) would need to lift into the shell or a context. Inventory shared state before splitting.

**Estimated size:** 1 chunk.

**Status:** standby — split only if a new tab is being added or readability becomes a blocker.

### D4 — API response DTOs as shared types

**Scope:** the broader response-shape-sharing gap. Today web infers types from runtime fetch responses; API DTOs (`AccountParamsDto`, etc.) are validation-only on the request side. If the API shape drifts, web typechecks against stale assumptions until runtime.

**Trigger:** sequence with [tanstack-start-migration.md](tanstack-start-migration.md) — route loaders are the natural place to introduce typed response DTOs end-to-end. Alternative trigger: a real incident where API drift broke web silently.

**Approach options (decide at start of session):**
1. **Export response types from `apps/api` directly** — web imports via package boundary. Couples web to api's internal types.
2. **Mirror DTOs in `packages/shared/src/<domain>/dto.ts`** — api maps to them on the way out, web imports them. Cleaner boundary but two-place definition.
3. **Generate types from a runtime schema** (Zod/class-validator + reflection) defined in shared. Most ceremony, best safety. Sequence with V3 (POST body DTOs from the prior hygiene round).

**Risk:** large scope creep; could turn into a multi-session arc if option 3 is picked. Scope ruthlessly to a single domain (LoL match summary or Steam owned-games) first.

**Estimated size:** 2–4 chunks, depending on option chosen. Owner-coordinated.

**Status:** waiting on Start migration kickoff or a drift incident.
