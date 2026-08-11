# Performance baseline — 2026-05-12

**Status:** Reference — tooling baseline (bundle visualizer, size-limit budgets, Web Vitals overlay) plus measured ceilings to defend in PRs. One open follow-up: re-measure MatchWindowProvider + ChampionsPage memoization fixes in host Chrome — the devcontainer can't run Lighthouse, so this is a not-a-coding task tracked in [open-work.md](../open-work.md).

Investigation started after the main roadmaps (views, match-depth, trends) shipped. Goal: understand how well the app runs, especially on lower-end machines, and produce screenshots `case-study-topics.md` is waiting for.

## Tooling in place

- **Bundle visualizer:** `rollup-plugin-visualizer` added as devDep. Run `ANALYZE=1 pnpm run build` from `apps/web/` to emit `dist/stats.html` (treemap) + `dist/stats.json` (parseable). Gated by `process.env.ANALYZE === "1"` in [apps/web/vite.config.ts](../../../apps/web/vite.config.ts) so normal builds are unaffected.
- **Bundle budget:** `size-limit` configured in [apps/web/.size-limit.cjs](../../../apps/web/.size-limit.cjs) (not `package.json`). Run `pnpm run size` (full report) or `pnpm run size:cc` (silent, exit-code only — CI-friendly) after a build. Current budgets: **initial JS 250 kB gzip** (~3.3% headroom over 241.65 kB), Recharts lazy chunk 85 kB gzip (~20% over 68.25 kB). The check reads `dist/client/`, so the pattern is `pnpm run build && pnpm run size:cc`. The initial-JS entry derives its file list from `dist/client/.vite/manifest.json` at config load and **throws** if the walk looks partial — see the 2026-07-25 and 2026-07-26 sections below for why.
- **Web Vitals:** wired via [apps/web/src/lib/web-vitals.ts](../../../apps/web/src/lib/web-vitals.ts) + dev-only [PerfOverlay](../../../apps/web/src/components/perf-overlay.tsx) gated by `usePerfFlag()`. Live updates enabled (`reportAllChanges: true` for CLS/INP/LCP). Activation: append `?perf` (or `?perf=1`) once — persists to `localStorage` for the session, survives TanStack Router validateSearch stripping. Clear `vyoh:perf` from localStorage to disable.
- **Lighthouse:** **not** available inside the devcontainer (no Chrome). Use the PerfOverlay against `vite preview` on a forwarded port for live measurements. Firefox lacks the live CPU-throttling Chrome offers, so deeper throttled measurement requires Chrome/Edge.

## Initial JS baseline

> **Heading renamed 2026-07-25.** It read "Main bundle baseline", and that conflation is what caused the budget to be wrong for months: "main bundle" was taken to mean the entry chunk, while the browser loads the entry *plus* its modulepreloads. Every figure in this section dated 2026-05-12 describes the **entry chunk only**, not initial JS.

Initial measurement 2026-05-12 (**entry chunk only**): **205.69 kB gzip / 629 kB raw** (Vite output for `dist/assets/index-*.js`).

After lazy-loading sonner + cmdk (2026-05-12, **entry chunk only**): **181.94 kB gzip / 550.70 kB raw** (-23.75 kB gzip / -11.5%). New lazy chunks:
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

Notable lazy chunk: **`CategoricalChart-*.js` (Recharts) at 68.25 kB gzip / 230.08 kB raw**, loaded only on chart pages. **Both Recharts and visx are present by design** — a prior session deliberately kept Recharts for workhorse charts and reached for visx only on showpieces where the extra API cost paid for bespoke visuals. The chunk is therefore not a leftover migration; consolidating onto visx everywhere is an option, but only worth pursuing if there's no visual regression on the existing Recharts surfaces.

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

1. **`MatchWindowProvider value` was a fresh object literal every render** in [apps/web/src/routes/lol/$accountSlug.tsx](../../../apps/web/src/routes/lol/$accountSlug.tsx). `AccountLayout` re-renders on every pathname change (it drives the `lol-tab-indicator` layoutId pill and reads `useRouterState({ select: (s) => s.location.pathname })`). The inline `value={{ matches, isPending, total, count, setCount }}` invalidated every `useMatchWindow()` consumer — 5 Profile widgets (`profile-stats-bar`, `profile-queue-distribution`, `profile-now-playing`, `profile-recent-form`, `profile-lp-history`, `profile-pregame-ritual`), `useSeriousMatches`, `use-lp-delta`, and the matches index — even when matches/total/count were byte-identical. Trends and Champions read their own `useCachedMatchesWindow(account, …)` directly with different window sizes, so they were *not* hit by this fan-out; the wasted work was concentrated on the Profile route during tab cycles back to `/lol/$slug`.
2. **`ChampionsPage` called `aggregateChampionStats(matches)` un-memoized in JSX** at [apps/web/src/routes/lol/$accountSlug/champions/index.tsx](../../../apps/web/src/routes/lol/$accountSlug/champions/index.tsx). With `CHAMPIONS_FETCH_COUNT=2000`, every render reran the O(matches) aggregation *and* handed `ChampionTable` a fresh `stats` array, invalidating that table's own `useMemo(sortStats…)` and forcing a re-sort of ~50 rows on each commit. (Note: an earlier task hint said the Champions table virtualizes via `@tanstack/react-virtual` — it does not. Only `match-list.tsx` uses the virtualizer. The full champion list is rendered every commit.)

**Fixes (landed, static-only, no measured before/after).**

- Wrapped the `MatchWindowProvider` value in `useMemo([matches, isPending, total, count, setCount])` — same `useMemo` discipline the sibling `ActiveMatchProvider` and `SeriousQueuesProvider` already use.
- Wrapped `aggregateChampionStats(matches)` in `useMemo([matches])` and passed the memoised result into `ChampionTable` so its sort memo can keep its output stable.

**Considered, not fixed.**

- `MatchDetailPage.heroSummary` is also built inline (a fresh `MatchSummary` literal every render when `cachedSummary` is absent). Its consumers (`MatchHero`, `ChampionStickyStrip`) don't `React.memo`, so identity churn there is cheap — would need measurement to justify a fix.
- `AccountLayout`'s `compact` scroll-toggle can fire a second commit per tab change when leaving a scrolled state (the `mainScrollRef.current?.scrollTo(0, 0)` on transition fires the scroll handler, which can flip `compact`). The cooldown + hysteresis already cap this at one extra commit per transition; not worth structural change without measurement.
- The 168 ms INP spike under abusive tab cycling has not been re-measured here. Best structural guess is that motion's layout animations (`layoutId="lol-tab-indicator"`, scope-keyed `AnimatePresence` around `Outlet`) dominate, which is accepted spend. The two fixes above remove the non-motion churn that was riding alongside the layout animations on every tab cycle; whether that meaningfully shifts INP needs Chrome-driven Profiler.

**Validation to-do for next host-Chrome session.** `pnpm --filter @vyoh/web dev`, open Profiler, cycle Profile ↔ Matches ↔ Trends ↔ Champions five times each, capture commits with these expected effects: Profile widgets should no longer commit when only the pathname changes; Champions page commits should keep `ChampionTable`'s sort-row work stable as long as the underlying matches window is unchanged.

## LoL account-switcher splash wash — dropdown-open re-baseline 2026-05-30

**Context.** Chunk 1.5 of the nav-condensation arc added a per-account last-played-champion splash wash + open-stagger to the topbar LoL `AccountRow` ([apps/web/src/components/nav.tsx](../../../apps/web/src/components/nav.tsx)). The open path now does meaningful per-row paint (N `backdrop` webp backgrounds + a 240 ms staggered entry), so it needed a host-Chrome re-baseline before the chunk closed.

**Measured (host Chrome, owner machine, real `/me` ~7 accounts with distinct last-played champions — the realistic worst case; menu opened on a populated route).**

1. **Performance panel (throttled record over the open):** clean — no long task >50 ms, no dropped frames during the stagger window.
2. **Network (images):** first open fires the N distinct `backdrop` fetches; **second open is all cache hits** (memory/disk), so the wash does not re-fetch on subsequent opens.
3. **Web Vitals (PerfOverlay `?perf`):** all green on the open interaction (INP in the good band).

**Verdict.** No contention; the splash wash earns its keep at the representative account count. No fix sub-chunk needed — the `loading`/decode-hint and per-row-cap mitigations that were on standby are unnecessary. Chunk 1.5's LoL portion is fully done incl. the perf gate; only the explicitly-deferred Steam single-card variant + live pill remain.

## LoL identity scroll/nav morph (M2/M2b) — re-baseline 2026-05-30

**Context.** Chunk 1.3a of the nav-condensation arc added the cinematic Profile hero, then M2 (the avatar + name collapse into the compact header strip via Motion `layoutId` on scroll) and M2b (the same identity *travels on navigation* — a hand-rolled `startViewTransition` that runs the section slide and the identity morph together; see [nav-condensation-arc.md](../archive/nav-condensation-arc.md) and [identity-morph-nav.ts](../../../apps/web/src/lol/profile/identity-morph-nav.ts)). Both run on `/lol/$accountSlug`, the highest-traffic route, so the morphs needed a host-Chrome re-baseline before being treated as perf-validated.

**Measured (host Chrome, owner machine, dev WEB-VITALS overlay via `?perf`, clicking through the LoL section tabs — the nav-morph path).**

| Metric | Reading | Band |
|---|---:|---|
| INP | 8 ms | Good (≪ 200 ms) |
| LCP | 1479 ms | Good (< 2.5 s) |
| CLS | 0 | Good |
| FCP | 342 ms | Good |
| TTFB | 147 ms | Good |

INP 8 ms on the morph-heavy interaction (each tab click fires the VT snapshot + Motion layout morph + the staggered chrome reveal) is ~25× under the "good" threshold — the morph adds no main-thread block. No regression vs the pre-morph `/lol/$slug` feel.

**Caveat on source.** These are dev-overlay readings (the in-app `web-vitals` overlay), **not** a Lighthouse or React-Profiler capture — the devcontainer can't run Lighthouse (per "Tooling in place"), so this is the owner's host browser reading the live overlay. The margin is decisive enough that a formal Lighthouse pass isn't gating, but if a README perf-screenshot run happens later, capture `/lol/$slug` under Lighthouse then. The scroll-collapse (M2) side wasn't separately INP-sampled here (scroll rarely logs an INP event); eyeballed smooth on scroll-down/up.

## Landing surface (`/`) — ambient hero + bento composition, host capture pending 2026-05-31

**Context.** [landing-showcase-arc.md](landing-showcase-arc.md) shipped Chunks 1–5: editorial display headline, static CSS ambient gradient, Canvas2D rAF drift with single-path static↔canvas dispatcher, activity-intensity reactivity (`/home/activity-intensity` → canvas chroma 0.7×–1.3×), and the composition pass below.

**Composition pass landed 2026-05-31.** Bento tile chrome bumped `bg-card/50` → `bg-card/65` across 9 tiles (10 occurrences) to deepen the surface and mute the high-chroma ambient bleed-through for the worst-case combo (dusk palette × `intensity = 1.0` × 1.3× chroma boost). No `backdrop-filter` was added — per [engine-gate perf cliffs](../../../docs/working-notes/cross-cutting/safari-vt-snapshot-cost.md) and the standing rule (`feedback_engine_gate_perf_cliffs` in auto-memory), always-mounted `backdrop-blur` on N tiles compounds the Safari snapshot/composite cost. Opacity tuning gives the legibility lift without engaging the WebKit cost path.

**Bundle impact, this arc.**
- Chunks 1–3: editorial heading + ambient hero, Canvas2D + drift loop, ~500 LOC across `apps/web/src/home/ambient-hero.tsx` + `ambient-hero-canvas.tsx`. Vite reports the home route chunk in the per-route range (single-digit kB), no measurable change to the main bundle (Canvas/CSS only, no new deps).
- Chunk 4: activity-intensity (`apps/web/src/home/use-home-activity-intensity.ts` + shared type + dispatcher prop). Trivial — ~80 LOC, no new deps.
- Chunk 5: Tailwind utility swap. Zero bundle impact.

**Runtime — not yet captured on host.** The devcontainer can't run Lighthouse (per "Tooling in place" above), so LCP/INP for `/` are still pending a host-Chrome session. The natural cells to fill:

| Metric | Reading | Band |
|---|---:|---|
| INP (intensity refetch + canvas chroma swap) | _pending host capture_ | _expected: well under 200 ms; chroma threading is `intensityRef` mutation only, no rAF restart_ |
| LCP (heading + first bento row) | _pending host capture_ | _expected: < 2.5 s; AmbientHero is `pointer-events-none -z-10`, doesn't gate LCP element_ |
| CLS | _pending host capture_ | _expected: 0; hero is absolute-positioned with explicit height_ |

**APCA contrast — worst-case validation pending.** The worst-case combo is dusk palette (`oklch(0.42-0.52, 0.18, 350)` magenta + `oklch(0.42, 0.15, 320)`) × `intensity = 1.0` (chroma multiplier 1.3×) under full-motion. Tile foreground is `--card-foreground` (`oklch(0.985 0 0)` in dark mode) against `bg-card/65` blended with the ambient swirl. Eyeballed clean in dev; awaiting APCA capture against the live `dusk` route (visit `/?hour=20`).

**Validation to-do for next host-Chrome session.** `pnpm --filter @vyoh/web dev`, visit `/?perf&hour=20` (forces dusk palette), let the canvas drift settle, capture LCP/INP/CLS via the in-app PerfOverlay. Sample the bento against the high-chroma quadrants and verify text remains crisp. Capture an APCA reading on a representative tile body (`.text-foreground/90` over `bg-card/65 + ambient`).

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

---

## Initial-JS re-baseline — 2026-07-25

The budget had been measuring one chunk of twenty-one.

`.size-limit.cjs` globbed `dist/assets/index-*.js` and called it "main bundle (initial JS)". That was true when written, but the Vite 8 / rolldown chunking split the entry, and `dist/index.html` now loads the entry script **plus 20 `modulepreload` links** before first paint. The budget reported ~133 kB against a 210 kB limit and passed, while the real initial payload was **229.53 kB** — over the stated ceiling. Nothing caught it because the number still looked plausible, and CI's `bundle-size` job gated on it.

| Measure | Value |
|---|---|
| Entry chunk alone (what the old glob measured) | 133.78 kB gzip |
| **Initial JS — entry + 20 modulepreloads** | **229.53 kB gzip** |
| Limit (set 2026-07-25) | 240 kB gzip (~4.4% headroom) |
| Recharts lazy chunk | 68.25 kB gzip / 230.08 kB raw (limit 85 kB) |
| `index-*.css` — render-blocking, **not** in the JS budget | ~31 kB gzip |

Largest preloaded chunks the old budget ignored: `react-*.js` 38.17 kB, `Match-*.js` 15.81 kB, `useQuery-*.js` 7.96 kB.

**Units matter here.** `size-limit` reports and parses *decimal* kB (bytes ÷ 1000), not binary. The first pass at this finding computed 224.43 kB using ÷1024 and understated the overshoot. Confirmed by measuring the entry chunk at 133,482 B = 133.48 decimal kB, which matches size-limit's printed 133.78 (residual is `__BUILD_TIME__` drift) — 130.35 binary kB does not. `@size-limit/file` compresses per file at gzip level 9.

**Why the config parses HTML instead of listing globs.** Chunk names are content-hashed and change every build, and prefix globs over-count — `dist/assets/dist-*.js` matches five emitted chunks, only three of which are preloaded. Parsing `dist/index.html` is the only source that stays correct as chunking changes.

**The guard is the load-bearing part.** `size-limit` silently ignores a path that matches nothing, so a tag-shape change upstream would quietly shrink the measured payload and turn the budget green — the exact failure being fixed. The config counts `rel="modulepreload"` occurrences and throws unless it resolved every one plus exactly one entry script. Verified by mangling `index.html` two ways: repointing one preload outside `/assets/`, and renaming `href` to `data-href`. Both throw with `matched 1 entry script(s) and 19 of 20 modulepreload(s)`.

Attribute patterns require preceding whitespace rather than `\b`, because `\bhref` also matches `data-href` (the hyphen is a non-word character) — the first draft of the guard missed the rename case for exactly that reason.

**Not done:** no attempt was made to *reduce* initial JS. 240 kB records where the app actually is; trimming toward the old 210 kB figure is separate, optional work.

## Initial-JS re-baseline — 2026-07-26 (TanStack Start cutover)

Two changes, one forced and one measured.

**The derivation source moved from HTML to the build manifest.** Start renders the document per request, so `dist/index.html` no longer exists at build time and the parse above had nothing to read. `.size-limit.cjs` now loads `dist/client/.vite/manifest.json` (`build.manifest: true` added to vite.config.ts) and walks the single client entry through its transitive static `imports`. `dynamicImports` are deliberately not walked — those are the lazily-fetched route chunks.

The walk finds **21 chunks**, the same count the HTML parse found. That agreement is the evidence the swap is faithful rather than merely plausible, and it is worth re-checking if the number ever moves without a matching code change.

**The guard survived the rewrite in spirit.** It can no longer count `modulepreload` tags, so it asserts the manifest contains exactly one `isEntry` chunk instead. The failure it defends against is unchanged: `size-limit` silently ignores a path that matches nothing, so a manifest-shape change upstream would otherwise shrink the measured payload and turn the budget green.

| Measure | Value |
|---|---|
| Initial JS before the cutover (2026-07-25 method) | 229.53 kB gzip |
| **Initial JS after the cutover** | **241.65 kB gzip** |
| Delta attributable to the Start runtime | **≈ +12.1 kB gzip** |
| Limit (set 2026-07-26) | 250 kB gzip (~3.3% headroom) |
| Recharts lazy chunk | 68.25 kB gzip (limit 85 kB, unchanged) |

The ceiling moved 240 → 250 kB because the cost buys server rendering, which is the entire point of the migration; it is not a regression to chase. Headroom is deliberately similar to what 240 kB gave, so the budget still bites on the next unplanned addition. The two figures come from different derivation methods (HTML tags vs manifest walk), so treat the delta as approximate — the unambiguous part is that the payload crossed the previous ceiling.

**Worth re-measuring after chunk 4.** Making virtualizers, portals, and charts render server-side changes what ships in the initial payload in both directions: more content in the HTML, and possibly more or less JS depending on how each surface is gated.

## Re-baseline — 2026-07-27 (Start chunks 4b + 5)

| Measure | 2026-07-26 (cutover) | After 4b | After 5 | Limit |
|---|---|---|---|---|
| Initial JS | 241.65 kB | 243.13 kB | **244.34 kB** | 250 kB |
| Recharts lazy chunk | 68.25 kB | 68.25 kB | 68.25 kB | 85 kB |

+2.7 kB across the two chunks, against 5.7 kB of headroom left. 4b's share is the `initialRect` plumbing and `use-hydrated`; 5's is `route-error.tsx`, `site-url.ts`, and the shell's canonical component — all of which land in the entry graph because the router and the shell reach them on every route. Nothing here is a candidate for trimming; the next unplanned addition is what the budget is now defending against.

**Layer/paint probe, warm dev server, 3-run bracket.** Both scenarios the chunks touched are comfortably inside the budgets in [repo-conventions.md § "Layer-count + paint budget per route scenario"](../../repo-conventions-web.md#layer-count--paint-budget-per-route-scenario), and both read *better* than the 2026-06-10 baselines:

| Scenario | Layers (budget) | Load raster (budget) | Long tasks | Dropped |
|---|---|---|---|---|
| lol-overview | 13–16 (≤ 30) | 43–50 ms, median 44 (≤ 150) | 1 | 0 |
| recap | 15 (≤ 20) | 98–121 ms, median 115 (≤ 220) | 0 | 0 |

Recorded baselines were 24 layers / ~100 ms and 13 layers / ~195 ms respectively. The improvement is consistent with a server-rendered first paint that is no longer thrown away and re-rendered — chunk 4b found every route was failing hydration — but the probe cannot attribute it, and the pre-SSR numbers were captured on a different app shape. **Do not lower the budget rows on the strength of this**; treat it as headroom, not as a new floor.
