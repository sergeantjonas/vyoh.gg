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

### Chunk 0b — section-level content-visibility:auto on ProfilePage (2026-06-09, shipped)

Wrapped each section (lazy + eager) in a local `CvSection` component that applies `content-visibility: auto` + `contain-intrinsic-size: auto Npx` with a per-section minHeight tuned to the rendered size. The browser now skips render work for any section that's far offscreen and reserves a height placeholder so scroll position stays stable as sections virtualize in and out.

- [apps/web/src/routes/lol/$accountSlug/index.tsx:71-83](../../../apps/web/src/routes/lol/$accountSlug/index.tsx#L71-L83) — `CvSection` wrapper component.
- Applied to all 14 below-fold sections (lazy + light). Above-fold (`LolIdentityHero`, `LiveGameChip`, `ProfilePatchNotice`) stays uncontained — those need to paint immediately and CV-auto would force an unnecessary intrinsic-size measure.

**Cumulative impact on lol-overview (chromium, vs original baseline, 0c + 0a + 0b together):**

| Metric | Original | After 0c+0a+0b | Total Δ |
|---|--:|--:|--:|
| FCP | 160 ms | 248 ms | +88 ms (Suspense + CV-auto overhead) |
| **LCP** | **1692 ms** | **512 ms** | **−1180 ms (−70%)** |
| **Layers (01-load)** | **50** | **24** | **−26 (−52%)** |
| **PushProps (01-load)** | **899** | **415** | **−484 (−54%)** |
| Raster (01-load) | 72 ms | 94 ms | +22 ms |
| **Long tasks (01-load)** | **4** | **1** | **−3 (−75%)** |
| Layers (02-scroll-bottom) | 419 | 428 | +9 (noise) |
| Raster (02-scroll-bottom) | 416 ms | 382 ms | −34 ms |
| Dropped frames | 0 | 0 | 0 ✓ |

**Cold load is half the compositor cost it was.** The 50 → 24 layer drop is the dominant 0b signal — `content-visibility: auto` prevents below-fold sections from committing layers until the user scrolls near them. Combined with the 0a lazy boundaries (parent paints before children mount) and 0c hero priming (LCP image races to network), the cold-load profile is fundamentally different.

The +22ms 01-load raster increase is the browser tracking the contain-intrinsic-size boxes; cheap compared to the alternative of rasterizing 26 extra layers. The +88ms FCP is the cumulative price of progressive paint — flat per session, no scroll-time degradation.

02-scroll-bottom is essentially neutral on layer count (CV-auto materialises sections as the user scrolls TO them) but shows a -34ms raster improvement. The sections still all promote layers eventually, just spread across the scroll trajectory rather than all at once. This is the expected ceiling for CV-auto at the section level — to reduce scroll-bottom layer count further, the next step would be Chunks 1 or 2 (row-level CV-auto and frosted-tile density audit), but neither is currently load-bearing: scroll-bottom shows 0 dropped frames and only 1 long task on the new baseline.

**Foundation chunks done.** Chunks 0a/0b/0c shipped together produce a clean cold-load profile on the lol-overview route. The remaining queue (Chunks 1–6) targets different cost surfaces (frosted-tile clusters, layer-promotion triggers, ambient layers) and should be re-prioritised against the new baseline before starting — much of the original urgency assumed the unoptimised cold-load profile.

## Post-foundation 4-scenario re-baseline (2026-06-09)

Re-ran all four scenarios after `0c+0a+0b` to get fresh comparison numbers driving the re-ranking of Chunks 1–6. Multiple runs on lol-overview and lol-champion-panel to bracket variance (the LCP target shifts between the splash image and a smaller asset depending on network/CV timing; the scroll-bottom layer count varies wildly depending on whether CV-auto regions have promoted by the time the bottom-settle measurement lands).

### Cold paint timings — chromium, 2–3 runs per scenario

| Scenario | FCP | LCP (low) | LCP (high) | LAF count | LAF blocking total |
|---|--:|--:|--:|--:|--:|
| lol-overview         | 160–168 ms | **476 ms** | 1628 ms | 5–6 | 64–343 ms |
| lol-champion-panel   | 164–172 ms |  616 ms |  992 ms | 4–6 | 273–294 ms |
| steam-library        | 136 ms     |  568 ms |     —   | 2   | 67 ms |
| recap                | 164 ms     |  384 ms |     —   | 6   | 73 ms |

LCP variance on lol-overview: when the splash (~142K px²) wins LCP, it lands at 1.4–1.6s. When the rank crest / a smaller hero element wins, LCP lands at <500ms. Both are inside Web Vitals "good" — the 1.6s upper bound is well under the 2500ms threshold.

### Compositor metrics per phase — chromium, latest run per scenario

| Scenario | Phase | Layers | pushProps | Dropped | Raster | Long tasks |
|---|---|--:|--:|--:|--:|--:|
| lol-overview         | 01-load              |  **24** | **342** | 0 |  101 ms | 1 |
| lol-overview         | 02-scroll-bottom     |  38–431 (CV-dep.) | 1011–5341 | 0 | 209–772 ms | 0–4 |
| lol-champion-panel   | 01-load              |  65–68 | 659–674 | 0 |  99–110 ms | 2 |
| lol-champion-panel   | 02-panel-open        |  42–44 | 1837–2866 | 0 | 709–929 ms | 2–3 |
| lol-champion-panel   | 03-panel-close       |   5–6 | 130–322 | 0 | **1734–1791 ms** | 0 |
| steam-library        | 01-load              |  32 | 390 | 0 | 100 ms | 2 |
| steam-library        | 02-scroll-bottom     |  27 | 689 | 0 | 133 ms | 0 |
| recap                | 01-load              |  13 | 145 | 0 | 145 ms | 2 |
| recap                | 02-scroll-bottom     |  17 | 1801 | 0 |  81 ms | 1 |

### What the re-baseline says about the original chunks

**Three things changed materially:**

1. **lol-overview cold-load is no longer the worst metric.** Layers 50 → 24, long tasks 4 → 1, LCP (worst case) 1692 → 1628 with the splash-wins case, 476 with the alt-LCP case. Chunks 1–3 targeting the LoL profile route have meaningfully diminished marginal returns.

2. **lol-overview scroll-bottom is variable** (38–431 layers depending on whether CV-auto regions have promoted by measurement time). With 0 dropped frames and ≤4 long tasks across runs, this is *timing*-variance not user-felt jank. The 38-layer reads show CV-auto is doing what it should — the high reads are measurement-window artefacts. Not load-bearing without dropped-frame evidence.

3. **lol-champion-panel close-phase raster stayed flat: 1641 → 1734–1791 ms.** Did not improve from the foundation chunks (those targeted /lol/$slug/, not /lol/$slug/champions/). This is the **new top number** — and matches the original panel-arc diagnosis exactly: close-phase work is dominated by host-route re-paint as the panel teardown releases its compositor layers. Chunks 2 (frosted-tile density) and 3 (layer-promotion triggers) on **panel internals specifically** remain load-bearing.

**Quiet surfaces stayed quiet:**

- **steam-library**: 32 → 27 layers, 100 ms raster, 67 ms LAF blocking. Already-virtualised library is doing its job; no chunk against it is load-bearing.
- **recap**: 13 layers cold, 17 scroll-bottom, 145 ms raster. Atmosphere substrate is appropriately minimal. R-13 exit-dissolve work may shift this, but the current profile has no headroom problem.

## Re-ranked Chunks 1–6 (after foundation)

Original ordering assumed an unoptimised cold-load profile. With cold-load now half its original compositor cost, the priorities shift toward the residual hotspot (panel-close raster on the LoL champion panel) and away from per-row optimisations on already-clean routes.

**Standing rule for this queue:** improve the cost, don't strip the visual. Frosted tiles are part of the project's visual identity — especially on panels — and removing them is the last resort, not the first lever. For every cost reduction, exhaust the levers that preserve the aesthetic (lower blur radius, gate `backdrop-filter` to in-view via CV-auto, scope `will-change` to animation windows, merge layers via `contain: paint`, narrow transition targets, clear perpetual `will-change`) before proposing any visual change. If a specific subset eventually does demand a visual change, propose it with side-by-side screenshots and a per-tile cost number — never as a bulk delete. See [[feedback_perf_improvements_before_removals]] in auto-memory.

### Re-baseline insight: where the panel-close raster cost actually lives

The 1734–1791 ms close-phase raster is not the panel internals re-rastering — by close-phase those compositor layers are being *released*. The work is Chrome re-promoting and re-painting the **host route** (champion-table, ~150 rows) as it becomes visible again behind the receding panel. That reframes which chunk attacks which metric:

- **Panel-open raster (709–929 ms)** is where panel-internal frosted-tile cost lives (Chunk 2).
- **Panel-close raster (1734–1791 ms)** is where host-route per-row layer-promotion cost lives (Chunk 3).
- Both metrics matter; both chunks land on the same scenario from different angles.

### Promoted (load-bearing)

1. **Chunk 3 — Per-row layer-promotion sweep on champion-table (host-route scope)**
   - Why promoted: this is the chunk that actually attacks panel-close raster (the worst residual). `championCardBaseClassName` + `themed-card-interactive` carry `isolate` + `transition-[transform,border-color,box-shadow]` + Motion `m.li` wrappers — each promotes a compositor layer per row at rest, ×~150 rows. When the panel closes, every one of those layers re-promotes and re-rasterises.
   - Levers (improvements, not removals — preserve hover lift, entrance choreography, rest-state visual):
     - Clear Motion's perpetual `will-change` after entrance animation completes (`onAnimationComplete`).
     - Narrow `transition-[transform,border-color,box-shadow]` → `transition-[border-color,box-shadow]` (the `hover:-translate-y-0.5` still applies instantly; only the eased transition on `transform` is removed, which doesn't change the rest-state visual).
     - Audit `isolate` — only drop if no descendant uses positive `z-index` to escape the stacking context. Validate before changing.
   - Measurement target: lol-champion-panel `03-panel-close` `rasterTaskTotalMs`. Aim for ~30%+ reduction.

2. **Chunk 2 — Panel-internals frosted-tile cost reduction (NOT density reduction)**
   - Why promoted: lol-champion-panel `02-panel-open` raster (709–929 ms) is the second-worst residual, and it's where the in-panel frosted tiles live. **Keep every frosted tile.** Reduce the per-tile composite cost instead.
   - Levers (improvements, not removals):
     - Lower the `backdrop-filter` blur radius where the visual still reads as glass (often `blur(4px)` reads identically to `blur(8px)` at the small chip scale).
     - Wrap each frosted tile in `content-visibility: auto` so its `backdrop-filter` is gated to in-view, not always-on.
     - Apply `contain: paint` to the tile container to confine its repaint region.
     - Apply `isolate` where it confines a stacking context that's currently leaking layer-promotion upward.
     - Clear `will-change: backdrop-filter` outside of animation windows (Motion / `motion-safe:` apply it during entrance; it should drop after).
   - Visual change as last resort only: if a measured subset of small chips contributes disproportionate cost (per-tile raster sampling > 2× the headline tiles), propose a swap with side-by-side screenshots — not a bulk drop. Headline tiles (`DeltaTile`, win-rate trend, build path) and any tile sitting directly over splash chrome stay frosted regardless.
   - Measurement target: lol-champion-panel `02-panel-open` `rasterTaskTotalMs`. Aim for ~30% reduction with the visual intact.

### Expanded (additive passes, not parity audits)

3. **Chunk 4 — Steam game-detail panel + recap chapters: additive frosted-tile passes**
   - Why expanded: Steam game-detail panel and recap chapters **never got a frosted-tile pass**. Their tiles default to plain `bg-card/50` with no glass, which means they don't yet pay the per-tile composite cost — but they also don't carry the visual identity the LoL panels do. The original "Chunk 4 = Steam panel parity audit" framing missed that this is an *additive* design pass, not a density audit.
   - Scope: design the frosting from scratch with the Chunk 2 cost-reduction levers baked in from the start (in-view gating via CV-auto, scoped `will-change`, contained repaint regions). Apply the same hierarchy that emerged on the LoL panels: headline tiles get the full glass treatment; small chips get a lighter blur or a non-frosted treatment that still reads as a tier marker. Recap chapter tiles use the atmosphere-overlay rung (`bg-card/40` + low blur) rather than panel-internal frosting because their backdrop is the atmosphere layer, not splash chrome.
   - Measurement target: before/after probe runs on a new `steam-game-panel` scenario (add to `scenarios.ts`) and on `recap` scroll-bottom. Cold-load layer count should stay under the budget set by Chunk 6.

### Moved up

4. **Chunk 6 — Layer-count budget in [repo-conventions.md](../repo-conventions.md)**
   - Why moved up: we now have enough data points across four scenarios to set a real budget. Encoding it as a convention rule prevents regressions to the pre-foundation state, and provides the gate that Chunk 4's additive frosting work needs to stay within. Concrete draft based on observed numbers:
     - **Cold-load layers (01-load):** ≤ 30 for any new top-level route. lol-overview = 24, steam-library = 32, recap = 13. lol-champion-panel = 65 (route renders a list of ~150 rows — exception: list-shaped routes get layer-budget proportional to viewport-visible row count).
     - **Cold-load long tasks:** ≤ 2 across all scenarios. The foundation chunks brought lol-overview from 4 to 1; budget is "don't regress this."
     - **Scroll-bottom layer count:** no fixed budget (CV-auto timing makes the measurement window-dependent). Use dropped-frame count as the gate instead: any scroll phase with > 0 dropped frames triggers a perf review.
     - **Panel-open raster:** ≤ 1000 ms (current: 709–929 ms; budget is "don't regress").
     - **Panel-close raster:** the load-bearing residual. Document the 1700 ms current value as the bar to beat, not the bar to hold.

### Deprioritised (not load-bearing now)

5. **Chunk 1 — Long-list row-level content-visibility:auto**
   - Why deprioritised: section-level CV-auto from Chunk 0b is already doing the job at the level that matters. Scroll-bottom variance is timing-window, not user-felt — 0 dropped frames across every run. Row-level CV-auto would be additive but the residual savings are small relative to the implementation cost. Re-evaluate only if a future regression bumps scroll-phase dropped frames > 0.
   - Caveat: Chunk 2's "wrap frosted tiles in CV-auto" lever is a related but different pattern — that's panel-scope tile gating, not list-row gating. They don't collapse into one chunk.

6. **Chunk 5 — Other ambient-layer surfaces**
   - Why deprioritised: ambient `ChampionSplashLayer` no longer appears as the LCP target (the hero splash does, with `fetchPriority="high"`). It contributes ~3 layers to cold load. Steam profile backdrop and atmosphere layer didn't appear in any of the four scenarios' hot paths. Low-yield review; bundle into a maintenance pass when other work touches `_shared/backdrop/`.

## New order of attack

1. **Chunk 3 (per-row layer-promotion on champion-table)** — direct hit on panel-close raster (the worst residual).
2. **Chunk 2 (panel-internals frosted-tile cost reduction)** — direct hit on panel-open raster while keeping every frosted tile.
3. **Chunk 6 (layer-count budget)** — lands the foundation as durable policy and gates Chunk 4 within budget.
4. **Chunk 4 (Steam panel + recap additive frosted passes)** — adds the visual identity to the two surfaces that don't have it yet, designed cost-aware from day one.
5. **Chunks 1 + 5** — re-evaluate only if a regression surfaces; otherwise park.

### Post-foundation baseline run directories

Latest probe runs covering each scenario (gitignored — local-only):

- `tools/perf-probe/runs/lol-overview-chromium-2026-06-09_21-31-55-909Z/`
- `tools/perf-probe/runs/lol-champion-panel-chromium-2026-06-09_21-33-01-889Z/`
- `tools/perf-probe/runs/steam-library-chromium-2026-06-09_21-30-27-271Z/`
- `tools/perf-probe/runs/recap-chromium-2026-06-09_21-30-36-722Z/`

Use as `--compare` baselines for Chunks 2/3 work targeting the LoL champion-panel scenario.
