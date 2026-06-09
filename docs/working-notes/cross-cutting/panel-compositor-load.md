# Panel compositor load on Chrome

**Status:** First fix shipped 2026-06-09. Documents the diagnosis arc that surfaced the LoL champion / match detail panel's open/close glitches on Chrome, the architectural fix (decoupling backdrop claim from theme cascade), and the broader audit it implies for the rest of the app.

Read this when: a panel/overlay surface feels glitchy on Chrome but not Firefox, scoping perf work on any detail panel, considering adding a new `bg-card/* backdrop-blur-*` cluster, or evaluating whether a panel needs a page-wide backdrop claim.

KB anchors: [03-motion.md](~/.claude/knowledge/frontend-2026/03-motion.md), [05-perf.md](~/.claude/knowledge/frontend-2026/05-perf.md). Pairs with [safari-vt-snapshot-cost.md](safari-vt-snapshot-cost.md), which documents the same shape of problem from a different angle (WebKit snapshot capture on dense DOM).

---

## Symptom

Opening the LoL champion-detail panel from the champions list — and closing it again — produced visible glitching on Chrome:

- Frosted tiles inside the panel flickered "into black and back to the splash" during the open morph.
- The hero card's transparent edges revealed the panel chrome backdrop mid-morph in a way that read as "the backdrop is popping up through the card."
- The list cards peeking out beside the panel had visible brightness shifts.
- On a hard refresh with a deep URL (`/lol/<slug>/champions/<key>`), random panel tiles painted while sibling tiles stayed dark for one or two frames, then caught up.

Critically: **none of this reproduced on Firefox.** The Steam library → game-detail panel on the same Chrome did not reproduce it either.

That cross-engine + cross-section asymmetry, observed late in the diagnosis, is what eventually pointed at the correct root cause.

---

## Diagnosis

Captured a Chrome DevTools Performance trace via Playwright + CDP (`Tracing.start` with `devtools.timeline` + `disabled-by-default-cc.debug` categories), recording the open and close windows on both LoL champion and Steam library scenarios back-to-back. Counted unique compositor layer IDs and dropped frames per window.

Numbers from one representative run (open phase, panel mounting):

| Metric                          | LoL champion | Steam library | Δ              |
|---------------------------------|-------------:|--------------:|---------------:|
| Unique GPU layers (open)        |          275 |            69 | LoL ~4× higher |
| Unique GPU layers (close)       |          233 |            21 | LoL ~11× higher|
| `UpdateLayer` events (open)     |          650 |           221 | +429           |
| `UpdateLayer` events (close)    |          505 |            71 | +434           |
| **DroppedFrame** events (open)  |           21 |            12 | +9             |
| RasterTask total time (open)    |       389 ms |        158 ms | +232 ms        |
| FunctionCall total time (open)  |       366 ms |        159 ms | +207 ms        |
| Paint events (close)            |           28 |             9 | +19            |

Chrome's compositor scales nonlinearly with layer count. Somewhere between Steam's ~70 layers and LoL's ~275 you cross from "smooth" into "raster pipeline can't keep up," and frames start dropping at the peak commit moment. Firefox's compositor handles the same layer load without visible drops, which is why the symptom is Chrome-only.

The 11× gap on close is the most diagnostic number: 233 active layers vs 21 *after the panel is already gone*. The LoL list page itself is layer-heavy before any panel is involved. Each `.themed-card-interactive` row contributes via `isolate` + `overflow-hidden` + `transition-[transform,...]` + the Motion `m.li` wrapper's implicit `will-change: transform`. Plus per-row Sparkline SVGs, WinRateBars, Radix tooltip portals. The panel then piles 20+ `bg-card/60 backdrop-blur-sm` tiles on top of that base — every `backdrop-filter` always promotes to its own compositor layer.

### What ruled out the false leads

Each hypothesis was tested with a code change and re-measured before being discarded:

1. **View Transitions API contributing to the load** — gated off for the click handler, no change in the close-phase numbers (which run no VT). VT adds work during the open transition specifically, but it's not the dominant cost.
2. **Naming the source element instead of the card div** (matching Steam's `<img>` named-element pattern) — would help VT snapshot complexity, but doesn't move the steady-state layer count.
3. **`content-visibility: auto` on below-fold panel sections** — Chrome's CV threshold is ~2 viewport heights. The panel's total scroll height is ~2000-2500px, so most "below-fold" sections are within 1800px of the viewport and Chrome still paints them. CV-auto helped on the long champion-table list (rows 5000+px down) but didn't help short below-fold panels.
4. **React-based deferred mount via `requestAnimationFrame` chain** — caused visible pop-in for the deferred sections *during* the morph window. Worse UX even if metrics improved marginally.
5. **The SplashProvider's `AnimatePresence` crossfade itself** — long suspected because the crossfade animates opacity on multiple nested `<m.div>`s for ~700ms and overlaps with everything else during open/close. **This turned out to be the actual root cause** — see fix below.

### What actually caused the visible glitching

Two factors compounding:

- **The base layer count is structurally higher in LoL than Steam.** That's not directly fixable without visual regression and isn't the immediate trigger.
- **The SplashProvider claim from inside the panel triggered a multi-layer AnimatePresence crossfade in the page-wide backdrop on every open and close.** The crossfade ran ~700ms with four nested opacity timelines (parent `m.div` enter, parent `m.div` exit on the previous champion, inner bg `<m.img>` opacity 0→0.2 over 500ms, inner fg `<m.img>` opacity 0→0.14 over 500ms), plus an infinite drift transform on the splash, all stacked in the backdrop portal at `-z-10`. This stack is what Chrome's compositor couldn't keep up with at LoL's panel's layer density.

Firefox handled the same crossfade fine (its compositor is more forgiving on opacity-stacked work). Chrome with the LoL panel's layer floor + the crossfade load tipped over.

The Steam panel works on Chrome with comparable backdrop claim machinery (`useSteamGameBackdrop`) because Steam's base layer count is ~70 vs LoL's ~275 — same crossfade work, much smaller layer floor under it.

---

## Fix

Architectural: **decouple the page-wide backdrop claim from the theme cascade.** Panels should claim their theme directly via `useThemeColor` without going through the SplashProvider's backdrop-claim system. The panel's own `chromeBackdropUrl` (or equivalent baked-in panel-chrome backdrop) carries the visual; no page-wide backdrop change is necessary.

Concretely:

- [apps/web/src/lib/use-theme-color.ts](../../apps/web/src/lib/use-theme-color.ts) — captures the prior `--theme-color` inline value on mount and restores it on unmount, mirroring the existing meta-tag save/restore. Lets a panel cleanly override the parent's theme for its lifetime, and the previous claim returns when the panel closes — without forcing the parent to re-run any effect.
- [apps/web/src/routes/lol/$accountSlug/champions/$championKey.tsx](../../apps/web/src/routes/lol/$accountSlug/champions/$championKey.tsx) — replaced `useSplashChampion(championKey)` with `useThemeColor(championTheme(championKey).dominantHex)`. The panel chrome's HD splash still loads via the existing `chromeBackdropUrl` mechanism (baked-in background-image, no AnimatePresence involved).
- [apps/web/src/routes/lol/$accountSlug/matches/$matchId.tsx](../../apps/web/src/routes/lol/$accountSlug/matches/$matchId.tsx) — same swap for match-detail.
- [apps/web/src/routes/steam/library/$appid.tsx](../../apps/web/src/routes/steam/library/$appid.tsx) — `useSteamGameBackdrop` removed. The page background stays on the animated profile background while the panel is open. Theme cascade was already on `useThemeColor` directly and stays.

User-confirmed visual result: the LoL champion-detail panel glitching disappeared completely after the SplashProvider claim was dropped, before any other refactor. The decoupled architecture is the fix; the test we ran first ("drop the claim, see if it fixes anything") was the load-bearing experiment.

---

## Generalised rule

> **A panel should not claim the page-wide visual backdrop. The page-wide backdrop belongs to the surface beneath the panel — the parent route, the section index, the list — and it should not change when a panel opens or closes.**
>
> Panels carry their own chrome (their own splash, their own gradient, their own bg-card surface). The page backdrop staying put is correct, not a regression.

Corollary: theme-cascade-via-backdrop-claim is the wrong coupling. The two concerns should travel through separate channels. Panels claim theme via `useThemeColor` directly. Backdrop ownership stays with surfaces that own the page-wide visual.

The accidental coupling in SplashProvider was load-bearing for theme cascade but punitive for compositor load. Splitting them lets each operate at its right scope.

---

## Universal optimization pass

The panel arc is the diagnosis that surfaced the problem, but the underlying lesson — *Chrome's compositor scales nonlinearly with GPU layer count, and we tend to commit a lot of layers in single frames* — applies to the whole app, not just panels. The panel had the loudest symptom because the AnimatePresence crossfade compounded with an already-dense layer floor. Other surfaces aren't symptomatic *yet* but carry similar shape: long lists with per-row layer promotion, frosted-tile clusters above the fold elsewhere, heavy charts on the Trends tab and recap chapters. If the panel surfaced the issue at 275 layers, anywhere we approach that count is worth a look.

This section is the audit queue, ranked by signal. Items are independent — each can be picked up alone.

### Measurement protocol (applies to every chunk below)

Every chunk in this audit is gated on a before/after measurement. The discipline isn't optional — the panel arc's load-bearing lesson was that hypothesis-without-measurement burned a session and a half on the wrong fix (`[[feedback_instrument_before_hypothesise]]`). Repeating that here would forfeit the entire point of doing this as an audit instead of intuition-driven cleanup.

**Tooling.** Playwright 1.60 + Chromium (already in devDependencies) drives every measurement. Three artefacts per chunk:

1. **Compositor metrics** via CDP `Tracing.start` with `disabled-by-default-cc.debug` + `devtools.timeline` categories. Extract: unique GPU layer count (open + close + steady state where relevant), `UpdateLayer` event count, `DroppedFrame` count, RasterTask total ms, Paint event count. Same shape as the panel-arc trace numbers in the table above.
2. **Paint timing** via CDP `Performance.getMetrics` + `PerformanceObserver` for `first-paint`, `first-contentful-paint`, `largest-contentful-paint`, `long-animation-frame`. Recorded on cold-load and on each major interaction (route nav, panel open, tab switch).
3. **Visual regression** via `page.screenshot()` at fixed viewport sizes (1440×900 desktop, 390×844 mobile) for: cold-load steady state, mid-transition frame (captured via CDP `Page.startScreencast` at 250ms window), and post-interaction steady state. Diffed pixel-by-pixel; any unintended drift gets flagged before the chunk lands.

Builds the tool first (Chunk 0 below), then every subsequent chunk reuses it. The tool lives at `tools/perf-probe/` mirroring `tools/champion-assets/`'s workspace package shape.

**Tool + baseline shipped 2026-06-09** ([commit `9cf6772e`](#) — perf-probe), with the cross-scenario baseline numbers + ranked attack order written up in [progressive-paint-audit.md](progressive-paint-audit.md). **Read that doc before starting any 0a/0b/0c work** — the order ("0c first, then 0a, then 0b") is data-driven and beats intuition.

**Scenarios.** Each chunk targets a representative scenario set. Minimum baseline coverage:
- `/lol/<slug>` (overview, dense list) — Chrome + Firefox
- `/lol/<slug>/champions/<key>` (panel open, theme cascade) — Chrome
- `/steam` (virtualised library, low layer count baseline) — Chrome
- `/` (recap, atmosphere + multi-chapter) — Chrome + Firefox

Add scenarios as a chunk requires.

**No-regression bar.** A chunk ships only if all three artefacts show net-positive or net-neutral movement:
- Compositor metrics: layer count down or equal; dropped frames down or equal.
- Paint timing: FCP/LCP down or within ±5% (noise tolerance); no new long-animation-frame entries above 100ms.
- Visual regression: pixel diff zero on steady states; mid-transition frame visually equivalent (subjective sign-off, the diff isn't expected to be pixel-zero mid-animation).

Any chunk that fails one of these gets reverted and re-scoped, not papered over.

### Paint scheduling / progressive mount (foundation)

The original audit queue (below this section) is all about *what* commits to the compositor. This section is about *when* it commits. The two compound: a frosted tile that mounts when the user scrolls near it isn't paying any layer cost during initial paint, regardless of how many frosted layers it ultimately carries. Paint-scheduling wins are foundational because they shrink the universe the rest of the audit operates on.

Current gaps observed before measurement (to be confirmed in Chunk 0):

- **Route-level code splitting is uneven.** Some heavy modules (Recharts, Shaka player, command palette dialog body) are pulled into the critical-path bundle even when the active route doesn't need them. The LoL Trends tab pulls Recharts on every LoL route; the recap pulls every chapter's dependencies into the first commit.
- **No Suspense priority bands.** Every component on a route mounts in a single React commit. There's no streaming hero-first → primary → below-fold split, even when the route has obvious banding (recap chapters, LoL profile season-history, Steam game-detail trophy case).
- **`React.lazy` is used inconsistently.** Some heavy below-fold components are lazy (Shaka video player); many aren't (per-tab content, per-chapter content, detail-panel internals when the panel is closed).
- **`content-visibility: auto` is currently applied at row level, not section level.** Row-level CV was the panel-arc fix for champion-table; the same property on whole below-fold sections (recap chapter 4, profile season-history when offscreen) would let Chrome skip both layout and paint until the user scrolls near.
- **`fetchpriority` / `decoding="async"` discipline is partial.** Splash hero images are sometimes marked correctly (resolver outputs in some paths), sometimes not. Below-fold images don't systematically opt into `loading="lazy"` + `decoding="async"`.
- **No idle-time mount strategy.** Non-interactive widgets (sparklines, in-card charts, atmosphere effects) mount synchronously in the first commit. `requestIdleCallback` / `startTransition`-based deferral would let the critical path complete first.

**Chunks land in this order:**

- **Chunk 0a** — `React.lazy` on the heaviest below-fold consumers. Targets: Trends tab (Recharts surface), recap chapters past chapter 1 (each chapter is a discrete `m.section`), match-detail tab content past the default tab, command palette dialog body (heavy on first open).
- **Chunk 0b** — Section-level `content-visibility: auto` on below-fold *sections* (not just rows). Targets: recap chapters 4+, LoL profile season-history, Steam game-detail trophy case, achievement panel collapsed view.
- **Chunk 0c** — `fetchpriority="high"` on hero/above-fold images, `decoding="async"` everywhere, `loading="lazy"` on confirmed below-fold images. Routed through `apps/web/src/lib/image-proxy*.ts` outputs so the policy is uniform.

The not-during-panel-morph caveat from the original diagnosis still holds: deferred mount *inside* a panel during its open animation caused visible pop-in (false-lead #4 in the diagnosis). Paint-scheduling lazy mount is for *unmounted-at-route-entry* surfaces, not for in-flight animations.

### Long lists (highest expected win)

`content-visibility: auto` + `contain-intrinsic-size` shipped on champion-table rows (close-phase layers dropped 233 → ~60 in the trace). Same pattern is worth applying anywhere a list renders dozens of items but only a handful are in the viewport. Each `m.li` typically carries 4-6 compositor layers (card + splash img + gradient overlay + sparkline SVG + maybe a tooltip portal); off-screen rows are pure waste on Chrome.

Candidates:
- **[match-list.tsx](../../apps/web/src/lol/matches/match-list.tsx)** — already partially virtualized (see `match-list-virtual.tsx`), but the non-virtualized fallback path is heavy. CV-auto on the `m.li` is additive to virtualization and helps the moments where DOM is still in-flight.
- **[library-row.tsx](../../apps/web/src/steam/library/library-row.tsx) + [library-tile.tsx](../../apps/web/src/steam/library/library-tile.tsx)** — both go through TanStack Virtual today (`library-list-virtual.tsx`, `library-grid-virtual.tsx`). Virtualization already drops most off-screen items from the DOM, but for the visible buffer (overscan items) CV-auto gives an extra cushion. Probably small win; cheap to try.
- **[patches-page.tsx](../../apps/web/src/lol/patches/patches-page.tsx)** — patch-by-patch list with per-group tiles. Each list group renders a chip strip. Not huge counts but per-tile cost adds up.
- **[recent-unlocks-virtual.tsx](../../apps/web/src/steam/achievements/recent-unlocks-virtual.tsx)** and the rest of the Steam achievements feed — already virtualized; same overscan-cushion point as library.
- **Recap step lists and rank-arc rows on [home/](../../apps/web/src/home/) chapters** — many rows with splash backgrounds; the recap is one of the heavier surfaces in the app.

### Frosted-tile density

Every `backdrop-filter` value other than `none` promotes a compositor layer. The frosted-tile sweep ([d91d3cf5](https://github.com/jonas-vyoh/vyoh.gg/commit/d91d3cf5)) was a deliberate visual choice and the right call for headline tiles; but it propagated into clusters of small repeating chips where the glass effect is barely perceptible and each chip is a free GPU layer.

Worth auditing:
- **LoL champion-detail panel** (already on the watchlist) — per-patch grid × 6, matchup grid × 8+, top items × variable, weakest-matchup chip, patch-drift chip. ~20 frosted tiles. Headline tiles (DeltaTile, Win-Rate Trend, Build Path) stay frosted; small chips drop to `bg-card/50`.
- **LoL Trends tab** — heatmaps + tilt indicator + time heatmap. Used to use `frosted` exclusively (rendered through `CardShell` with `frosted={true}` from panels), but the Trends-tab path renders them bare. Worth confirming none of the chart-internal tiles are frosted redundantly.
- **Steam game-detail panel body** — `GameAboutBlock`, `GameUnlockTimeline`, `AchievementPanel`, `CompletionVerdictCard`, `RarestUnlockCard`, `LastProgressedCard`, `RaritySignatureCard`, `TimeTo100Card`. Each is its own card; some have frosted children. Steam panel didn't symptomatic in our trace (~69 layers), so the headroom is fine — but worth re-auditing once it grows.
- **Recap chapters with frosted overlays** — atmosphere-overlay tiles intentionally bleed-through the page backdrop. Audit whether the recap is over-frosted given the splash backdrop already provides the visual.
- **Command palette** — `bg-popover/95 backdrop-blur-md` on the dialog. Single surface, low concern.

### Layer-promotion triggers on shared row classes

`championCardBaseClassName` in [champion-card.tsx](../../apps/web/src/lol/champions/champion-card.tsx) carries `isolate` + `overflow-hidden` + `transition-[transform,border-color,box-shadow]`. The combination promotes a compositor layer per row even when no animation is running. Same template is the basis for match-row, so the audit catches both.

- **Is `isolate` load-bearing?** It creates a stacking context. If no descendant is using positive `z-index` to escape the row, `isolate` is unneeded and removing it cuts per-row layer cost.
- **The `transition-[transform,...]` declaration** — could the transition target be narrowed (e.g. just `border-color` + `box-shadow`, drop `transform`) without losing the hover lift? `hover:-translate-y-0.5` would still apply instantly; only the eased transition would go.
- **Motion `m.li` wrappers** — Motion adds `will-change: transform` by default while animatable properties are tracked. For static list items that only animate on entrance (the staggered fade-in), the perpetual `will-change` keeps the layer promoted forever. Consider switching to plain `<li>` via Motion's `onAnimationComplete` clearing the `will-change`. Or use CSS-keyframe entrance instead of Motion, which doesn't promote.

Similar shape worth auditing on:
- **`tile` classes** in [library-tile.tsx](../../apps/web/src/steam/library/library-tile.tsx) (perspective + transform-style for the tilt effect)
- **`themed-card-interactive`** generally — used across champion-table, match-row, and possibly elsewhere
- **`.match-row`** and **`.library-tile`** rest-state shadow declarations (each shadow is potentially a layer trigger)

### Other panel/overlay surfaces

Apply the panel rule (no page-wide backdrop claim from inside the panel) anywhere it isn't already true. Done for LoL champion-detail, LoL match-detail, Steam game-detail. To audit:

- **Command palette dialog** — does it claim anything page-wide?
- **Any future modal / drawer / sheet** — bake the rule into the convention so it doesn't reappear.
- **Tooltip / popover surfaces** — Radix portals; they don't claim backdrop, but worth a visual confirmation if any newly-introduced one does.

### Other ambient-layer surfaces

Beyond panels, several surfaces drive the page-wide visual via opacity / blend / nested motion. None are urgent; worth a review pass:

- **SplashProvider's `ChampionSplashLayer`** — four nested `<m.div>`s with opacity animations + an infinite drift transform. Crossfade now only fires on top-claim changes from non-panel sources (account overview, recap, live tab), which are rarer. But the per-paint cost of the layer itself isn't free. Worth reviewing whether the drift animation needs to be infinite, or whether the bg/fg opacity animations are both load-bearing or one could be merged.
- **Steam profile backdrop** — animated profile-background system (`profile-backdrop.tsx`). Already designed with care (ref-counted leasing, no fade on the game backdrop swap to avoid VT-race), but the *animated* default profile background is real continuous compositor work. Probably worth re-confirming the animation isn't running while panels are open.
- **Atmosphere layer** — `AtmosphereProvider/Layer` on the recap arc. Multi-claim system already; check whether competing claims are doing extra crossfade work.

### Tooling (Chunk 0 — runs first)

Status upgraded from "not urgent" to **prerequisite for every other chunk in this queue**. The measurement protocol above gates each chunk on a before/after artefact; nothing else in this audit ships until the tool that produces those artefacts exists.

- **`tools/perf-probe/`** — new workspace package mirroring `tools/champion-assets/`'s shape (private `@vyoh/tools-perf-probe`, `tsx`-driven). Exposes a CLI: `pnpm --filter @vyoh/tools-perf-probe probe -- --scenario <name> [--browser chromium|firefox] [--baseline|--compare]`. Each scenario is a `{ url, openSelector?, closeSelector?, screenshotMoments }` record from a single `scenarios.ts` file. Output goes to `tools/perf-probe/runs/<scenario>-<browser>-<timestamp>/` containing: `metrics.json` (layer counts, paint timings, dropped frames), `trace.json` (raw CDP trace for DevTools import), `screenshots/*.png` (per-moment captures), and `console.log` (browser console + network failures).
  - Implementation: Playwright `chromium.launch()`, `context.newCDPSession()`, `Tracing.start` with `devtools.timeline` + `disabled-by-default-cc.debug` categories, `PerformanceObserver` injected via `page.addInitScript` for paint timing, scroll-and-screencast for mid-transition frames.
  - Comparison mode: `--compare <baseline-run>` diffs latest metrics against a baseline run directory and writes a markdown report flagging movement that crosses the no-regression bar.
- **Layer-count budget in [repo-conventions.md](../repo-conventions.md).** Lands in Chunk 6 once the probe has produced enough data points to calibrate the threshold. Initial draft: "A new surface added to the app should not push any of the baseline scenarios over their committed layer count by more than ~50. Run `pnpm --filter @vyoh/tools-perf-probe probe -- --compare` before any PR that adds layer-promoting CSS (`backdrop-filter`, `will-change`, `transform: translateZ(0)`, `isolate` with no descendant escape, `transition` targeting `transform`) or new motion components." The exact threshold is engine-specific and approximate, but having a budget makes the trade-off explicit when reviewing changes.

### What this *doesn't* require

- **Engine bypasses.** We were about to add a Chrome-only VT bypass before realising the backdrop claim was the actual problem. The fix that worked is engine-uniform — same code runs on Chrome and Firefox, both are smooth. The pattern of "Firefox bypass, WebKit bypass, now Chrome bypass" was a wrong signal: what it actually indicated is that we were treating the symptom (engine reacts differently to dense compositor load) instead of the cause (the load itself was avoidable). Apply this lens before reaching for `isWebKit()` / `isFirefox()` gates in future cases.
- **Removing the frosted aesthetic.** Visual identity holds. The fix preserves panel chrome, splash backdrops, theme cascade, frosted-glass tiles. What it removes is one specific coupling. Same posture for the audit above: nothing on the list requires dropping a visual choice, only reviewing whether each visual choice is paying for itself in layer cost.

---

## Audit trail

- 2026-06-08 / 2026-06-09: Two-session arc cycling through theories (root pseudo crossfade, named-element complexity, AnimatePresence splash crossfade, layer count). Each theory eliminated one mechanism but not the visible symptom, until the Steam-vs-LoL behavioral asymmetry was observed and the perf trace was captured. Documented retrospectively to capture what worked and what didn't — the false leads matter because they're the most likely shape future investigations will take.
- The load-bearing experimental step that resolved the diagnosis: the user requested "drop the splash claim and see if that fixes it." It did. Everything else this session was either preparation (decoupling theme cascade so the drop wouldn't regress) or generalising (applying the same change to match-detail + steam game-detail).
- Calibration note: confidence cycling through theories without empirical verification is the failure mode this thread exposed. Capturing a perf trace + comparing surfaces side-by-side is the diagnosis pattern that should be reached for earlier in similar future investigations.
