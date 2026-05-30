# Steam profile hero — session handoff (2026-05-30)

Working handoff for the Steam-profile parity arc (nav-condensation 1.3a Steam portion). Delete this note once the arc lands.

## Goal
Bring the Steam profile (`/steam`) to visual + content parity with the LoL profile hero we just shipped. LoL reference: unified cinematic hero card with glass rank strip + scroll/nav identity morph (commits `8fff4a8`, `98732fe`, `7547c8d`, `b83540f`, `8807e62`; M2/M2b morph earlier).

## Shipped this session (all committed, NOT pushed, branch `main`)
- `8cb8789` — **Chunk 0 (data gate):** Steam summary now carries `memberSinceUnix` (from `timecreated`, already fetched, free), `steamLevel` (new `getSteamLevel` client method, `GetSteamLevel/v1`), `steamLevelPercentile` (new `getSteamLevelDistribution`, takes a level int, no privacy). All optional end-to-end (`.catch(()=>null)`, mapper emits only when present). Files: `apps/api/src/steam/types.ts`, `steam-client.service.ts`(+spec), `steam.service.ts`(+spec), `packages/shared/src/steam/summary.ts`. Live-verified: `/steam/summary` → memberSinceUnix 1263864425, steamLevel 14, steamLevelPercentile 94.66.
- `4b1df10` + `feedc99` — **Chunk 1 (hero):** `apps/web/src/steam/profile/steam-identity-hero.tsx` (+`.test.tsx`, 8 tests, axe-clean). Backdrop = live current-game hero art when in-game else most-played owned `games[0]` (`steamLibraryHeroUrl`), pointer parallax (reuses `lol-hero-drift` CSS + same Motion pattern as LoL hero). Avatar (animated-aware, reduced-motion safe) + persona name + headline `Member since 2010 · Level 14 · top 5%` (percentile → `top {round(100-pct)}%`) + presence line (online-status-only; in-game → emerald "Now playing X"). Wired into `apps/web/src/routes/steam/index.tsx`, replaced the text `<h1>Profile</h1>`. Browser-verified by owner — looks good.
- Earlier docs: `78141f0` steam-api-unused-data.md (the API probe findings).

## Owner decisions locked
- Backdrop: **live current-game else most-played** (done). Profile-background declined (echoes ambient `SteamProfileBackdrop`).
- Presence line: **online-status-only** (no most-played echo in the line).
- Data scope: member-since + level + percentile (done). Badges/2wk-activity/backlog% deferred — see steam-api-unused-data.md.
- NowPlayingChip: **DELETE it, fold "last checked" into the hero presence line** (owner answer this turn).
- Sequencing (my judgment, owner left open): now-playing cleanup → stat band → morph.

## IN PROGRESS — now-playing cleanup (do this first, small)
1. In `steam-identity-hero.tsx` presence line, append ` · checked {formatTimeAgo(playerState.lastPolledAt)}` to BOTH branches (offline label AND in-game "Now playing X"). Import `formatTimeAgo` from `@vyoh/shared`. `lastPolledAt` is on `useSteamPlayerState().data` (string ISO). Guard: only render the "checked" suffix when `playerState?.lastPolledAt` exists.
2. Delete `apps/web/src/steam/now-playing-chip.tsx` (no test file exists). Remove its import + `<NowPlayingChip />` usage from `apps/web/src/routes/steam/index.tsx`.
3. Update `steam-identity-hero.test.tsx`: add a case asserting the "checked Nm ago" suffix renders (mock `lastPolledAt`). `formatTimeAgo` of a fresh ISO → "just now"/"Xm ago".
4. Verify: `pnpm run typecheck:cc` + `cd apps/web && pnpm exec vitest run src/steam/profile/steam-identity-hero.test.tsx` + `pnpm run check:cc` (from ROOT). Commit `feat: fold steam presence staleness into the hero, drop the now-playing chip`.

Chip detail: now-playing-chip.tsx renders `Last checked {formatTimeAgo(playerState.lastPolledAt)}`; that's the one unique bit to preserve. Everything else (game art, name, presence dot) is already in the hero.

## NEXT — Chunk 2 (stat band) — NEEDS OWNER DESIGN INPUT, do not guess
Content was deliberately deferred to "decide against the real card." Now that the hero is live, ASK the owner what fills the band before building. Material available (all already fetched, see steam-api-unused-data.md item A): owned-games count (175), total playtime (~2860h, sum `games[].playtimeForeverMinutes`), most-played (`games[0]`), backlog % (only ~41% ever played). Parallel to LoL's glass perf strip. Likely a glass strip at the hero bottom (mirror LoL `HeroRankStrip`) OR a row of stat chips — put options to owner.

## LAST — Chunk 3 (morph parity) — heaviest, scope separately
Owner wants the avatar+name to morph between the hero and the section strip's `SteamIdentity` (in `apps/web/src/routes/steam.tsx`, `SteamIdentity()` ~line 111, reads `useSectionShellState().compact`), mirroring LoL M2 (scroll-collapse, Motion `layoutId`) + M2b (nav morph).
**CRITICAL COMPLICATION:** Steam bypasses router VT on WebKit (Safari snapshot cost — `navigation-type.ts` returns false for intra-Steam on WebKit, CSS-slide substitute via `useSafariSlideDirection`). So the M2b nav-morph half can't be a straight copy of LoL's `identity-morph-nav.ts` — it must compose with that gate (likely: morph only where router VT runs i.e. non-WebKit; on WebKit fall back to the existing CSS slide with no identity morph, OR a layoutId-only approach). LoL morph reference: `apps/web/src/lol/profile/identity-layout.ts` (shared layoutId consts), `identity-morph-nav.ts` (imperative VT driver — KEY GOTCHA: never `await requestAnimationFrame` inside a VT update callback, it deadlocks; name dest synchronously after `await navigate`). M2 scroll side is simpler: shared `layoutId` on hero avatar/name + strip avatar/name, gated on `compact`, single-owner. Steam `SteamIdentity` strip avatar currently uses `transition-all` + `compact ? size-10 : size-12`.

## Environment notes (cost real time this session)
- **cwd drifts** after `cd apps/web`/`apps/api` for vitest — commits failed with "pathspec did not match" twice. ALWAYS `cd /workspaces/vyoh.gg` (or `git -C`) before `git add`. Run validation from ROOT: `pnpm run typecheck:cc`, `check:cc`, `check:fix:cc`. Web tests: `cd apps/web && pnpm exec vitest run <path>`.
- **tokf wrapper mangles output** (🗜️ markers, dropped lines). Prefix `CLAUDE_HOOK_BYPASS=1 NO_COLOR=1` or write to /tmp + Read for clean output.
- **Parallel tool batches collided** this session (duplicate edits inserted twice → "Duplicate function implementation"). Prefer sequential edits on the same file.
- Validation MUST run from workspace root. Biome ignores `apps/web/src/styles/view-transitions.css` (don't chase its "errors").
- Commit style: `type: description` lowercase, no scope parens, NO Co-Authored-By/Claude attribution. Never push. Tests same commit as code.

## Working-tree state at handoff
Clean except: the now-playing cleanup edits in progress (not yet made). HEAD = `feedc99`.
