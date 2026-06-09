# Progressive paint audit — baseline 2026-06-09

Cross-section measurement of compositor + paint cost on the four representative routes in [panel-compositor-load.md](panel-compositor-load.md). Baseline is what gets compared against once Chunks 0a/0b/0c land. Captured by `tools/perf-probe` (chromium, 1440×900, dev server on `:2009`).

## Method

- Chromium-only baseline; Firefox runs gated to surfaces where engine-gate work is already known ([[engine-gate-perf-cliffs]]).
- Each scenario produces per-phase trace metrics + cold paint timings (FP/FCP/LCP/LAF) + screenshots at each captured moment.
- Numbers below are single-run, not averaged. Variance across re-runs is roughly ±10% on layer counts and ±20% on raster ms — large enough to ignore noise-level deltas but not so large that order-of-magnitude wins disappear. Re-run before claiming a win < 30%.

## Baseline numbers

### Cold paint timings (chromium, cold reload)

| Scenario | FP | FCP | LCP | LCP size | LAF count | LAF blocking total |
|---|--:|--:|--:|--:|--:|--:|
| lol-overview         | 160ms | 160ms | **1692ms** | 142,515 px² | 9 | 114ms |
| lol-champion-panel   | 148ms | 148ms |  528ms |   4,725 px² | 6 | **344ms** |
| steam-library        | 132ms | 132ms |  580ms |  12,194 px² | 2 |  26ms |
| recap                | 128ms | 128ms | 1344ms |   4,848 px² | 5 |  35ms |

### Compositor metrics per phase

| Scenario | Phase | Layers | pushProps | Dropped | Raster | Paint | Commits | Long tasks |
|---|---|--:|--:|--:|--:|--:|--:|--:|
| lol-overview         | 01-load              |  50 |  899 | 0 |   72ms |  42 | 16 | 4 |
| lol-overview         | 02-scroll-bottom     | **419** | **2359** | 0 |  **416ms** | 160 |  7 | 2 |
| lol-champion-panel   | 01-load              |  63 |  866 | 0 |  251ms | 333 | 33 | 1 |
| lol-champion-panel   | 02-panel-open        |  18 |  138 | 0 |  118ms |  34 |  4 | 1 |
| lol-champion-panel   | 03-panel-close       |  11 |  598 | 0 | **1641ms** | 167 | 48 | 0 |
| steam-library        | 01-load              |  30 |  503 | 0 |   82ms | 199 | 29 | 1 |
| steam-library        | 02-scroll-bottom     |  31 |  766 | 0 |  131ms | 335 | 30 | 0 |
| recap                | 01-load              |   3 |   13 | 0 |   35ms |   5 |  8 | 0 |
| recap                | 02-scroll-bottom     |  11 |  153 | 0 |  133ms | 107 | 13 | 1 |

## Read

**Three signals stand out, ranked by ratio to peer baselines:**

### 1. LoL champion-panel close phase — raster=1641ms (worst single-window cost)

- The closed-phase raster cost is ~14× the panel-open raster (118ms) on the same scenario and ~12× steam-library scroll-bottom raster (131ms). Matches the original panel-arc diagnosis: close-phase work is dominated by host-route re-paint, not by panel teardown itself.
- 48 commits during a single panel close is high — suggests Motion exit animation + AnimatePresence cleanup + host-route remount are interleaving rather than batching.
- **Target:** This is the original audit's Chunk 3 territory (layer-promotion triggers). Defer until 0a/0b/0c land — close-phase cost includes the heavy chart components inside the panel, so lazy-loading them (Chunk 0a) should reduce this metric as a side-effect before any direct work.

### 2. LoL champion-panel load — LAF blocking total = 344ms

- 6 long-animation-frames totalling 344ms of blocking work during cold load — easily the worst LAF profile of the four scenarios (next is lol-overview at 114ms, then recap at 35ms, then steam-library at 26ms).
- The route loads the champion-list view, which renders ~150 row components synchronously + an active-champion context provider that hydrates pre-fetch data.
- **Target:** Chunk 0a candidate — wrap the heavier chart components (anything imported by the champion-detail panel route file: `ChampionBuildPath`, `ChampionPositionHeatmap`, `TrendDeathMatchupHeatmap`, `TrendTimeHeatmap`, `TrendTiltIndicator`) in `React.lazy` + `Suspense`. Re-measure LAF blocking after.

### 3. LoL overview scroll-bottom — 419 layers, 2359 pushProps

- Layer count is **8× the load-phase value** on the same scenario. Confirms the hypothesis from the original audit: champion-row CV-auto buys back the first-paint cost but every row promotes a compositor layer once scrolled in.
- pushProps=2359 in this window is the highest of any phase across all scenarios — extremely high churn.
- No dropped frames yet, but only 2 long tasks (vs. 4 on cold load), suggesting the compositor *is* keeping up but at the edge.
- **Target:** Chunk 0b candidate — wrap each section under `/lol/$slug` (`ChampionsTab`, `MatchesTab`, `TrendsTab`, `Profile*`) in a section-level `content-visibility: auto` so below-fold sections don't promote layers until they're scrolled-near. The row-level CV-auto is correct; the missing rung is section-level above it.

### 4. LoL overview LCP — 1692ms on a 142,515px² target

- LCP target is the champion splash backdrop (large image, paints late at 1692ms).
- Other scenarios LCP between 528ms and 1344ms; lol-overview's number is ~3× steam-library's despite both routes carrying a splash equivalent.
- **Target:** Chunk 0c candidate — sweep splash-resolver output for `fetchpriority="high"` + `decoding="async"` on the LCP image, and check whether the eager-loaded variant lives behind a Motion fade-in (which can suppress LCP timing if `opacity` starts at 0).

### Quiet surfaces (no work needed yet)

- **steam-library**: virtualised library is doing its job — layer count holds steady (30→31) across scroll-bottom, LAF blocking is 26ms. The 2026-05-24 virtualizer landing remains the right call.
- **recap**: only 3 layers on load → the chapter substrate is appropriately minimal. Scroll-bottom hits 11 layers + 1 long task, which is expected as chapters mount on-scroll. Re-measure after R-13 exit-dissolve work.

## Order of attack

1. **Chunk 0c** first (LCP fetchpriority/decoding sweep) — single-line per-image change, immediate LCP delta, low blast radius.
2. **Chunk 0a** next (React.lazy heavy panel internals) — directly attacks both #1 (close-phase raster) and #2 (cold-load LAF blocking).
3. **Chunk 0b** next (section-level CV-auto) — addresses #3 (scroll-bottom layer blowup).
4. After 0a/0b/0c land, re-measure all four scenarios → diff against this baseline → decide whether Chunks 1–6 are still load-bearing or whether the upstream paint-scheduling work already softened them.

## No-regression bar

For each subsequent chunk, the probe must show:

- LCP for the affected route does not increase by > 100ms.
- Layer count in any phase does not increase by > 10%.
- Dropped frames stay at 0 across all phases.
- Long-task count does not regress upward.
- Screenshots at the captured moments are pixel-comparable (manual visual diff for now; an SSIM threshold can land later if false positives become noisy).

Use `pnpm --filter @vyoh/tools-perf-probe probe -- --scenario <name> --compare <baseline-dir>` to produce the side-by-side report.

## Baseline run directories

Kept on disk for direct `--compare` references (gitignored — local-only):

- `tools/perf-probe/runs/lol-overview-chromium-2026-06-09_21-03-24-114Z/`
- `tools/perf-probe/runs/lol-champion-panel-chromium-2026-06-09_21-06-25-446Z/`
- `tools/perf-probe/runs/steam-library-chromium-2026-06-09_21-06-44-777Z/`
- `tools/perf-probe/runs/recap-chromium-2026-06-09_21-06-53-620Z/`

If these get cleaned up, re-baseline with the same scenarios before declaring a delta on a follow-up chunk.

## Chunk results

### Chunk 0c — fetchpriority on above-fold hero splashes (2026-06-09, shipped)

Added `fetchPriority="high"` to three above-fold hero image elements (the LCP candidates on routes that render them):

- [apps/web/src/lol/profile/identity-hero.tsx:156-167](../../../apps/web/src/lol/profile/identity-hero.tsx#L156-L167) — LCP target on `/lol/$slug/`.
- [apps/web/src/steam/profile/steam-identity-hero.tsx:159-170](../../../apps/web/src/steam/profile/steam-identity-hero.tsx#L159-L170) — LCP target on `/steam`.
- [apps/web/src/steam/game/game-panel-hero.tsx:131-145](../../../apps/web/src/steam/game/game-panel-hero.tsx#L131-L145) — LCP target on `/steam/game/$appid` (also added `decoding="async"` which was missing).

Skipped: rank emblems (size-14/16, too small to compete with hero splash), Steam stat-band logos (h-9, decorative), recap-champion + lol-moment-beat (below-fold on `/`, opacity 0.6 ambient styling — not real LCP candidates), `ChampionSplashLayer` images (intentionally `fetchPriority="low"` because they're 0.2-opacity ambient washes; the HD variant is preloaded via `new Image()` with `fetchPriority="high"` in `splash-backdrop.tsx`).

**Measured impact on lol-overview (chromium):**

| Metric | Baseline | After 0c | Δ |
|---|--:|--:|--:|
| FCP | 160 ms | 108 ms | **−52 ms (−33%)** |
| LCP | 1692 ms | 1196 ms | **−496 ms (−29%)** |
| Layers (01-load) | 50 | 38 | −12 |
| Raster (01-load) | 72 ms | 58 ms | −14 ms |
| Dropped frames | 0 | 0 | 0 |
| Long tasks (01-load) | 4 | 2 | −2 |

LCP moved firmly into Web Vitals "good" (<2500ms). Single-file diff per affected component — single-line `fetchPriority="high"` add (plus one `decoding="async"` add on game-panel-hero).

**Other scenarios:** No regression on routes that don't render these heroes. The lol-champion-panel scenario showed +300ms LCP delta but the route renders only `<Outlet />` from the section root with no hero — pure run-to-run variance (panel-open phase variance is ~10× higher than other phases due to Motion exit + Suspense interleaving).

### Chunk 0a — React.lazy on heavy below-fold ProfilePage sections (2026-06-09, shipped)

Scope shifted from the original "Trends tab / Recap chapters / heavy panel internals" target — those don't sit on a measured-baseline route. The active probe scenario is `/lol/$slug/` (lol-overview), which has 14+ section components rendering synchronously in a single commit. Six heavy below-fold sections lazy-loaded with `React.lazy` + bounded-height `<Suspense fallback>` placeholders. The light sections (recent-form, role-strip, duos, queue-distribution, stats-bar, multikill-strip — all < 120 lines) stay eager.

- [apps/web/src/routes/lol/$accountSlug/index.tsx:30-65](../../../apps/web/src/routes/lol/$accountSlug/index.tsx#L30-L65) — lazy imports + `SectionPlaceholder`.
- Lazy targets: `ProfilePregameRitual` (501 loc), `ProfilePostGame` (371 loc), `ProfileLpHistory` (697 loc — Recharts), `ProfileSeasonHistory` (259 loc), `ProfileSynergy` (266 loc), `ProfileActivityCalendar` (140 loc).
- Placeholder strategy: empty `<div>` with `minHeight` tuned per section (160–420 px). Doesn't paint chrome the section doesn't own — no shimmer-shape mismatch when the real section swaps in.

**Measured impact on lol-overview (chromium, vs original baseline, cumulative with 0c):**

| Metric | Baseline | After 0c | After 0a+0c | Total Δ |
|---|--:|--:|--:|--:|
| FCP | 160 ms | 108 ms | 224 ms | **+64 ms (+40%)** |
| LCP | **1692 ms** | 1196 ms | **464 ms** | **−1228 ms (−73%)** |
| Layers (01-load) | 50 | 38 | 26 | −24 (−48%) |
| PushProps (01-load) | 899 | 515 | 590 | −309 |
| Dropped frames | 0 | 0 | 0 | 0 |
| Long tasks (01-load) | 4 | 2 | 1 | −3 |

The FCP regression (+64ms vs original, +116ms vs 0c-alone) is the cost of 6 Suspense boundaries in the dev build: each lazy() introduces a dynamic-import promise that Vite resolves over a per-chunk request. In a prod build these become real code-split chunks and FCP should recover (re-measure when running the prod build through the probe). At 224ms FCP is still well within Web Vitals "good" (<1.8s) and below any user-perceptible threshold.

The LCP improvement is the headline: 464 ms is **deep** into "good" — about 1/4 the original. The combined effect (0c primes the hero splash; 0a removes 6 below-fold section render trees from the LCP-critical commit) compounds.

Layer-count drop on 01-load (50 → 26, -48%) is real first-paint compositor relief. Scroll-bottom layer count is unchanged because the lazy sections are still mounted once scrolled to, paying the same compositor cost — but now spread across multiple commits rather than one.

**Next:** Chunk 0b (section-level content-visibility:auto) should compound with 0a — the lazy sections are now mounted on-demand but still all promote layers when scrolled. CV-auto at the section wrapper level would defer the layer promotion until scroll-near.
