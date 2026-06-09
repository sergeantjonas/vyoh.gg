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
