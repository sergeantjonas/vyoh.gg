# Steam — achievement completion planner ("nearest 100%")

**Status:** Shipped — all three chunks landed 2026-09-05: api + shared scoring, the "Nearest 100%" section on the signature page, and the `/hunt` palette verb.

Read this when: touching the completion-candidates endpoint, the scoring in `packages/shared/src/steam/completion-candidates.ts`, or adding another surface that ranks games by achievement progress.

Promoted from [feature-candidates-2026-06.md § F3](../cross-cutting/feature-candidates-2026-06.md).

## Why

The library-completion read answers "how far along is each game" and the rarest feed answers "what have I pulled". Neither answers the completionist's actual question: *which game is the least work to finish?* Every input already exists server-side (schema size, unlocks, weekly global rarity), so this is a new aggregation over stored data with zero new upstream calls.

## Decisions

- **Score is bounded effort, not a rarity product.** Each locked achievement costs `1 − globalPercent / 100` (an unpolled one costs 0.5); the game's score is the sum. The F3 sketch said "remaining × average rarity", but any score that divides by `percent` sends every launch-window title to the top: Steam reports fresh achievements at 0.0% for their first weeks ([achievement-rarity-drift.md](achievement-rarity-drift.md)), and the read path deliberately keeps that floor. A cost capped at 1 per achievement makes the floor harmless while still ranking "3 left, all common" ahead of "1 left at 0.5%".
- **Only started, unfinished games are candidates.** Untouched games are not "near" anything, and finished ones belong to the 100%'d hall. Eligibility is `0 < unlocked < total`.
- **Sorted server-side, uncapped.** The palette and the page must agree on the order, so the sort is one place. The list is bounded by the library, not by a `take`, so `excludeHiddenGames()` on the totals is enough and `visibleAppidFilter()` on the locked query only keeps the wide result narrow.
- **Scoring lives in shared**, with its own test, so a web surface can explain the number it displays without a second implementation.
- **Home is `/steam/achievements/signature`**, alongside the completionist axis and the 100%'d hall, per the 2026-05-16 route split that left `/steam/achievements` as the recent-unlocks feed only.

## Chunks

1. **Api + shared** — `SteamCompletionCandidates` type and `buildCompletionCandidates()` in shared; `getCompletionCandidates(curation)` on the achievements service; `GET /steam/achievements/completion-candidates` with `@WithViewer()`. Shipped 2026-09-05.
2. **Web section** — `useCompletionCandidates()` hook (viewer-scoped key, `credentials: "include"`), a "Nearest 100%" section on the signature page joined with owned games for names and capsules, capped at eight rows, test file in the same commit. No loader await: the signature page has no loader and the section is not crawler-relevant. Shipped 2026-09-05 as `nearest-hundred.tsx`, placed after the 100%'d hall so "finished" reads into "closest to finished".
3. **Palette verb** — `/hunt` in `parsePaletteVerb`, a "Nearest 100%" group with the signature page as its first entry and the ranked games below it, each navigating to `/steam/library/$appid`; parser and dialog tests. Shipped 2026-09-05. Unlike the Steam library group, the verb *fetches* (two queries, disabled until the verb is typed) instead of reading the cache: the ranking lives on a page most visits never open, so a cache-only read would answer with nothing exactly when the verb is typed cold. Resolving the viewer for the queries' scope is what made every dialog test seed the viewer.

## Follow-up found while wiring the verb

The dialog and the Steam-game preview read owned games with `getQueryData(["steam", "owned-games"])`, but the hook's key has carried a trailing viewer-scope segment since the hidden-games arc, and `getQueryData` matches exactly. Outside tests (which seed the unscoped key) the Steam library group and the `dev:`/`pub:`/`franchise:` grammar therefore see an empty cache. Tracked in [open-work.md](../open-work.md); not fixed here.
