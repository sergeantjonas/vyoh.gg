# Project hygiene audit — 2026-05-18

**Status:** Reference — full-repo hygiene sweep covering folder structure, duplication, industry-standard adherence, and dependency/build hygiene. Actionable items lifted into [open-work.md](../open-work.md) live there; this note is the source-of-record for what was checked, what passed, and the verification corrections that matter for future audits.

Run as a multi-subagent sweep: one Explore pass for each of structure, duplication, standards, and dependency hygiene, then verified against `git ls-files` and direct file reads before reporting. **Headline finding:** the repo is unusually disciplined for a single-author monorepo. Real gaps cluster in web-side test coverage, API input validation, and a handful of formatter utilities that drifted into 3–6 copies.

## Verification corrections (read first)

Two subagent findings were *wrong* on initial pass; they are recorded here so a future audit doesn't re-raise them as alarms:

1. **`apps/api/.env` is NOT committed.** The dependency-audit agent claimed "real API keys in repo" because the file exists in the working tree. Verified false: `git ls-files apps/api/.env` returns empty, and [.gitignore:12](../../../.gitignore#L12) excludes `.env`. **Lesson for next sweep:** any "secrets committed" claim from a subagent must be verified via `git ls-files <path>` before being acted on; working-tree presence ≠ tracked state.
2. **TypeScript 6.x is real, not a typo.** Root pins `typescript@^6.0.3` and `tools/champion-assets` pins `^6.0.0-beta`. Skew is real (see §3) but neither version is fabricated.

## What's solid (do not re-litigate)

- **Folder structure & naming.** Vertical domain alignment (lol / steam / home) mirrored across `apps/web`, `apps/api`, `packages/shared`. Kebab-case files, `use-*` hook prefix, NestJS `*.controller.ts` / `*.service.ts` / `*.module.ts` suffixes applied without exception across ~450 TS files. The three `_shared/` buckets ([apps/web/src/_shared/](../../../apps/web/src/_shared/), [apps/web/src/lol/_shared/](../../../apps/web/src/lol/_shared/), [apps/web/src/steam/_shared/](../../../apps/web/src/steam/_shared/)) have non-overlapping roles.
- **Workspace boundaries.** `apps/web` and `apps/api` import only from `@vyoh/shared`; `packages/shared` imports from neither. No back-channels.
- **TypeScript strictness.** Base `tsconfig` enables `strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`, `noFallthroughCasesInSwitch`. Web layer adds `noUnusedLocals` / `noUnusedParameters`. Zero `@ts-ignore` / `@ts-expect-error` in handwritten code; one manual `as any` in [apps/web/src/components/command-palette-dialog.tsx](../../../apps/web/src/components/command-palette-dialog.tsx).
- **Lint discipline.** ~20 `biome-ignore` suppressions repo-wide, each justified.
- **Error handling.** Global `RiotExceptionFilter` at [apps/api/src/main.ts:14](../../../apps/api/src/main.ts#L14) maps 404/429/504 to user-facing responses; web has a root error boundary and TanStack Query global handlers in [apps/web/src/main.tsx](../../../apps/web/src/main.tsx).
- **Security basics.** `.env` gitignored (verified above), `requireEnv()` everywhere, CORS origin whitelist, no hardcoded secrets in source.
- **API test depth.** 46 spec files for 135 sources (~7.9k LOC of tests), unit + integration.
- **Git/lockfile/package manager.** Single `pnpm-lock.yaml`, `packageManager` + `engines.node>=22` set, commit-style discipline applied.
- **Docs hygiene.** `Status:` header convention enforced; shipped notes archived; `open-work.md` is current.

## Open issues, ranked

### 1. Web test coverage is a structural gap — high

**~7 test files for 267 source files** in `apps/web/src`. The hooks and components driving user-perceived behavior (scroll restoration, splash provider, command palette, match-detail tab nav) are essentially untested. Every UI change is verified by eye. Single largest hygiene risk in the repo.

**Next move:** start with 5–10 component/hook tests on the highest-risk surfaces listed above before broadening.

### 2. Formatter duplication — moderate

Same conversions reimplemented in multiple files. Worth consolidating into `packages/shared/src/format.ts` (pure functions; web imports, API uses internally):

- `formatDuration` / `formatHoursMinutes` / `formatPlaytime` — ~6 copies: [home/tile-weekly-totals.tsx:3](../../../apps/web/src/home/tile-weekly-totals.tsx#L3), [home/tile-day-split.tsx:8](../../../apps/web/src/home/tile-day-split.tsx#L8), [lol/matches/match-row.tsx:21](../../../apps/web/src/lol/matches/match-row.tsx#L21), [lol/matches/match-hero.tsx:33](../../../apps/web/src/lol/matches/match-hero.tsx#L33), [steam/library/library-row.tsx:18](../../../apps/web/src/steam/library/library-row.tsx#L18), [steam/library/library-tile.tsx:18](../../../apps/web/src/steam/library/library-tile.tsx#L18), plus [apps/api/src/og/og.service.ts:6](../../../apps/api/src/og/og.service.ts#L6).
- `formatGameTime` — three identical copies: [match-build-order.tsx:23](../../../apps/web/src/lol/matches/match-build-order.tsx#L23), [match-map-overlay.tsx:148](../../../apps/web/src/lol/matches/match-map-overlay.tsx#L148), [match-event-timelines.tsx:40](../../../apps/web/src/lol/matches/match-event-timelines.tsx#L40).
- `formatGold` — two identical copies: [match-lane-phase.tsx:63](../../../apps/web/src/lol/matches/match-lane-phase.tsx#L63), [match-gold-lead.tsx:68](../../../apps/web/src/lol/matches/match-gold-lead.tsx#L68).

### 3. Remake-filter pattern repeated everywhere — moderate

`matches.filter((m) => !m.remake)` appears in 12+ files across recap/trends/profile/habits surfaces. The CLAUDE.md invariant says all LoL stat computation must filter remakes — centralising this as e.g. `filterRanked(matches)` in `packages/shared/src/lol/` makes it harder for a future stats query to silently skip the filter.

### 4. POST-body validation absent at the API boundary — moderate

Numeric params use `ParseIntPipe` / `DefaultValuePipe`, but there's no global `ValidationPipe` with class-validator DTOs or Zod. String params (`gameName`, `tagLine`, `champion`) reach service code unvalidated. Low risk *today* (limited write surface) but it's the conventional Nest hardening step. Worth doing before owner-write surfaces grow — couples naturally with the owner-auth pre-deploy work in [ops/owner-auth.md](../ops/owner-auth.md).

### 5. `routeTree.gen.ts` is tracked in git — review needed

[apps/web/src/routeTree.gen.ts](../../../apps/web/src/routeTree.gen.ts) is committed (verified). TanStack Router supports both — some teams commit it for zero-cold-start dev, others gitignore it. The rest of [.gitignore](../../../.gitignore) excludes generated files (`.tanstack/`, `*.tsbuildinfo`, `dist/`), so committing this one is inconsistent. **Decide deliberately**, then document the choice in [repo-conventions.md](../../repo-conventions.md) so it doesn't get re-raised.

### 6. Missing `exactOptionalPropertyTypes` — minor

With `noUncheckedIndexedAccess` already on, this is the obvious next strict flag. Likely to surface a handful of DTO sites that silently allow `undefined` assignment to optional fields. Fix the fallout, flip the flag, commit together.

### 7. Tooling-dep version skew — minor

- `typescript`: root `^6.0.3` vs `tools/champion-assets` `^6.0.0-beta` — pin tools to stable.
- `@types/node`: web/tools `^24.12.2` vs api `^24.0.0` — unify, or document why API trails.

### 8. `.env.example` is incomplete — minor

API code references `CUTOFF_DAYS`, `LOL_PREWARM`, `MATCH_SYNC_ENABLED`, `STEAM_PREWARM`, `PORT`; none documented in `.env.example`. Matters most for the freelance-portfolio framing — anyone cloning the repo should be able to boot it.

### 9. Accessibility is reactive — minor

125 `aria-*` usages exist but no jest-axe or focus-management tests. Radix primitives carry semantics for free; custom interactive surfaces (command palette, match-card hover states, splat-route navigation) are untested for keyboard / screen-reader paths.

## Considered, not actionable

- **NestJS try/catch repetition** in Steam services — patterns are scoped to genuinely different failure modes; abstracting would obscure rather than help.
- **TanStack Query `staleTime` repetition** — values cluster intentionally by data volatility (30 min for slow, 5 min for summary, `Infinity` for static). Centralising would couple unrelated queries.
- **TypeScript project references** — current path-alias setup works; the incremental-build win isn't worth config churn at this repo size.
- **JSDoc on `packages/shared` exports** — types carry semantics; adding param/return blocks for self-documenting code would be noise.

## Suggested next moves (priority order)

1. 5–10 component/hook tests for the highest-risk web surfaces (scroll restoration, splash provider, command palette, match-detail tab nav).
2. Extract `formatDuration` / `formatGameTime` / `formatGold` into `packages/shared/src/format.ts` and a `filterRanked()` helper for the remake invariant.
3. Decide on `routeTree.gen.ts` — commit or ignore, update `repo-conventions.md`.
4. Add a Nest `ValidationPipe` + DTO/Zod validation pass before any write surface grows. Sequence with owner-auth.
5. Flip `exactOptionalPropertyTypes` on, fix fallout in the same commit.
