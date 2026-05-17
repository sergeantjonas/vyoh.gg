# Performance baseline — 2026-05-12

**Status:** Reference — tooling baseline (bundle visualizer, size-limit budgets, Web Vitals overlay) plus measured ceilings to defend in PRs. One open follow-up: re-measure MatchWindowProvider + ChampionsPage memoization fixes in host Chrome — the devcontainer can't run Lighthouse, so this is a not-a-coding task tracked in [open-work.md](open-work.md).

Investigation started after the main roadmaps (views, match-depth, trends) shipped. Goal: understand how well the app runs, especially on lower-end machines, and produce screenshots `case-study-topics.md` is waiting for.

## Tooling in place

- **Bundle visualizer:** `rollup-plugin-visualizer` added as devDep. Run `ANALYZE=1 pnpm run build` from `apps/web/` to emit `dist/stats.html` (treemap) + `dist/stats.json` (parseable). Gated by `process.env.ANALYZE === "1"` in [apps/web/vite.config.ts](../../apps/web/vite.config.ts) so normal builds are unaffected.
- **Bundle budget:** `size-limit` configured in [apps/web/package.json](../../apps/web/package.json). Run `pnpm run size` (full report) or `pnpm run size:cc` (silent, exit-code only — CI-friendly) after a build. Current budgets: main bundle 200 kB gzip (~10% headroom over 179 kB), Recharts lazy chunk 85 kB gzip (~10% over 76 kB). The check reads `dist/`, so the pattern is `pnpm run build && pnpm run size:cc`.
- **Web Vitals:** wired via [apps/web/src/lib/web-vitals.ts](../../apps/web/src/lib/web-vitals.ts) + dev-only [PerfOverlay](../../apps/web/src/components/perf-overlay.tsx) gated by `usePerfFlag()`. Live updates enabled (`reportAllChanges: true` for CLS/INP/LCP). Activation: append `?perf` (or `?perf=1`) once — persists to `localStorage` for the session, survives TanStack Router validateSearch stripping. Clear `vyoh:perf` from localStorage to disable.
- **Lighthouse:** **not** available inside the devcontainer (no Chrome). Use the PerfOverlay against `vite preview` on a forwarded port for live measurements. Firefox lacks the live CPU-throttling Chrome offers, so deeper throttled measurement requires Chrome/Edge.

## Main bundle baseline

Initial measurement 2026-05-12: **205.69 kB gzip / 629 kB raw** (Vite output for `dist/assets/index-*.js`).

After lazy-loading sonner + cmdk (2026-05-12): **181.94 kB gzip / 550.70 kB raw** (-23.75 kB gzip / -11.5%). New lazy chunks:
- `dist-*.js` (sonner): 11.45 kB gzip — loads on first toast or after first paint
- `command-palette-dialog-*.js` (cmdk + dialog body): 7.75 kB gzip — loads on first ⌘K

The numbers below describe the original baseline (before lazy-loading), retained to anchor the "what was in the bundle before" view:

| Package | gzip | % | Status |
|---|---:|---:|---|
| `motion-dom` + `framer-motion` + `motion-utils` | 112.0 kB | 28.5% | **Accepted** — see "Motion cost" below |
| `react-dom` | 85.1 kB | 21.7% | Unavoidable |
| `@tanstack/router-core` + `react-router` | 50.5 kB | 12.9% | Expected for the router |
| `@tanstack/query-core` + `react-query` | 21.1 kB | 5.4% | Expected |
| `sonner` | 11.4 kB | 2.9% | ✅ Lazy-loaded 2026-05-12 (moved to own chunk via `lib/toast.ts` helper + `React.lazy` Toaster) |
| `tailwind-merge` | 10.7 kB | 2.7% | Standard shadcn pattern, keep |
| `cmdk` | 5.4 kB | 1.4% | ✅ Lazy-loaded 2026-05-12 (palette split into eager shell + lazy `command-palette-dialog.tsx`) |
| `@radix-ui/*` + `@floating-ui/*` | ~25 kB | ~6% | Tooltip/Dialog/Popper, fine |
| `lucide-react` | 4.3 kB | 1.1% | Good — tree-shaken |
| App code | 26.6 kB | 6.8% | Healthy |

Per-route chunks split cleanly (Trends 12 kB, MatchDetail 12 kB, Profile 29 kB) — TanStack auto code-splitting is doing its job.

Notable lazy chunk: **`CategoricalChart-*.js` (Recharts) at 77 kB gzip / 245 kB raw**, loaded only on chart pages. **Both Recharts and visx are present by design** — a prior session deliberately kept Recharts for workhorse charts and reached for visx only on showpieces where the extra API cost paid for bespoke visuals. The chunk is therefore not a leftover migration; consolidating onto visx everywhere is an option, but only worth pursuing if there's no visual regression on the existing Recharts surfaces.

## Motion cost — accepted, do not re-litigate

The 112 kB / 28.5% motion footprint is **intentional spend**, not a misconfiguration:

- `LazyMotion + m` is already used everywhere (`m` in 48/53 files, `useReducedMotion` in 26/53).
- No stray `framer-motion` direct imports; the `framer-motion` 29 kB is a transitive dep of `motion@12`.
- `domMax` is the right preset because the app uses `layoutId` (6 sites: nav pill, tab pill, card morph, match-count selector, champion-sort selector, champion table). Downgrading to `domAnimation` would break those.
- Motion v12 has no "animation + layout but no drag" intermediate preset.
- Async-loading the feature pack via `features={() => import(...)}` would save 50-80 kB but cause first-render animation misses — unacceptable for the showpiece brand.

**Rule for future perf work:** target non-visual code (eager imports, unused libs). Don't propose downgrading motion features, async-loading the pack, or removing decorative motion usage to "save weight."

## Open levers (non-motion)

In order of ROI:

1. ~~**Lazy-load `sonner` Toaster + `cmdk` palette**~~ — ✅ done 2026-05-12 (-23.75 kB gzip from main).
2. **Hunt remaining Recharts callers, migrate to visx** — 77 kB off chart-page chunks, ~30 min.
3. **Lighthouse on host** — runtime baseline on key routes (`/`, `/lol/<slug>`, `/lol/<slug>/trends`, `/lol/<slug>/matches/<id>`, `/lol/<slug>/champions`); screenshots for the README.
4. ~~**React render profile** of Trends / MatchDetail / Champions~~ — ✅ static pass done 2026-05-12, see "Render profile pass" below.
5. ~~**Bundle budget in CI**~~ (already wired — see `.github/workflows/ci.yml` `bundle-size` job).

## Render profile pass — 2026-05-12

**Method.** Static pass only. The devcontainer has no Chrome (per "Tooling in place" above), and Playwright/Puppeteer aren't in the workspace, so React DevTools Profiler could not be driven hands-on. Instead: read the layout/route/context graph end-to-end for Trends, Match Detail, Champions, and the shared `/lol/$accountSlug` tab-cycle path. Looked for context fan-out via inline-object provider values, expensive computations called in JSX, and effect-driven setState churn on tab change. **Before/after commit counts are not measured.** Owner should re-profile on the host machine and revert any fix that doesn't earn its keep.

**Findings.**

1. **`MatchWindowProvider value` was a fresh object literal every render** in [apps/web/src/routes/lol/$accountSlug.tsx](../../apps/web/src/routes/lol/$accountSlug.tsx). `AccountLayout` re-renders on every pathname change (it drives the `lol-tab-indicator` layoutId pill and reads `useRouterState({ select: (s) => s.location.pathname })`). The inline `value={{ matches, isPending, total, count, setCount }}` invalidated every `useMatchWindow()` consumer — 5 Profile widgets (`profile-stats-bar`, `profile-queue-distribution`, `profile-now-playing`, `profile-recent-form`, `profile-lp-history`, `profile-pregame-ritual`), `useSeriousMatches`, `use-lp-delta`, and the matches index — even when matches/total/count were byte-identical. Trends and Champions read their own `useCachedMatchesWindow(account, …)` directly with different window sizes, so they were *not* hit by this fan-out; the wasted work was concentrated on the Profile route during tab cycles back to `/lol/$slug`.
2. **`ChampionsPage` called `aggregateChampionStats(matches)` un-memoized in JSX** at [apps/web/src/routes/lol/$accountSlug/champions/index.tsx](../../apps/web/src/routes/lol/$accountSlug/champions/index.tsx). With `CHAMPIONS_FETCH_COUNT=2000`, every render reran the O(matches) aggregation *and* handed `ChampionTable` a fresh `stats` array, invalidating that table's own `useMemo(sortStats…)` and forcing a re-sort of ~50 rows on each commit. (Note: an earlier task hint said the Champions table virtualizes via `@tanstack/react-virtual` — it does not. Only `match-list.tsx` uses the virtualizer. The full champion list is rendered every commit.)

**Fixes (landed, static-only, no measured before/after).**

- Wrapped the `MatchWindowProvider` value in `useMemo([matches, isPending, total, count, setCount])` — same `useMemo` discipline the sibling `ActiveMatchProvider` and `SeriousQueuesProvider` already use.
- Wrapped `aggregateChampionStats(matches)` in `useMemo([matches])` and passed the memoised result into `ChampionTable` so its sort memo can keep its output stable.

**Considered, not fixed.**

- `MatchDetailPage.heroSummary` is also built inline (a fresh `MatchSummary` literal every render when `cachedSummary` is absent). Its consumers (`MatchHero`, `ChampionStickyStrip`) don't `React.memo`, so identity churn there is cheap — would need measurement to justify a fix.
- `AccountLayout`'s `compact` scroll-toggle can fire a second commit per tab change when leaving a scrolled state (the `mainScrollRef.current?.scrollTo(0, 0)` on transition fires the scroll handler, which can flip `compact`). The cooldown + hysteresis already cap this at one extra commit per transition; not worth structural change without measurement.
- The 168 ms INP spike under abusive tab cycling has not been re-measured here. Best structural guess is that motion's layout animations (`layoutId="lol-tab-indicator"`, scope-keyed `AnimatePresence` around `Outlet`) dominate, which is accepted spend. The two fixes above remove the non-motion churn that was riding alongside the layout animations on every tab cycle; whether that meaningfully shifts INP needs Chrome-driven Profiler.

**Validation to-do for next host-Chrome session.** `pnpm --filter @vyoh/web dev`, open Profiler, cycle Profile ↔ Matches ↔ Trends ↔ Champions five times each, capture commits with these expected effects: Profile widgets should no longer commit when only the pathname changes; Champions page commits should keep `ChampionTable`'s sort-row work stable as long as the underlying matches window is unchanged.

## Routes that exist (for Lighthouse coverage)

- `/` — landing
- `/lol/` — account search
- `/lol/$accountSlug/` — profile
- `/lol/$accountSlug/trends`
- `/lol/$accountSlug/recap`
- `/lol/$accountSlug/live`
- `/lol/$accountSlug/matches`
- `/lol/$accountSlug/matches/$matchId`
- `/lol/$accountSlug/champions`
- `/lol/$accountSlug/champions/$championKey`
