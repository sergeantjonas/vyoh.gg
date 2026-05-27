# Data-viz densification

**Status:** Arc shipped 2026-05-27. Part 1 (inline sparklines) across 5 of 6 surveyed surfaces — see the "Where to apply" table below. Part 2 (`:has()` affordances) as a sibling-dim pattern on match list, champion table, and Steam library (list + grid). Part 3 (ambient hue drift) on match-list rows. Chunk 6 closed with sparkline tooltip support + axe scan on the primitive; tooltip rolled out on standalone surfaces (profile rank tile, champion-detail K/D/A tiles) and intentionally skipped on sparklines nested inside other popovers/hovercards (match-row, champion-table rows, Steam tile/row).

Part of [elevation-arcs.md](elevation-arcs.md) Tier 2. Three related moves that together transform the app's flattest surfaces (stat lists, match tables, text-heavy data displays) into the most-information-per-pixel:

1. **Inline `<svg>` sparklines** on stat cells next to numbers (24×8 polyline, no Recharts).
2. **`:has()` parent-aware affordances** — cards, rows, grids that style themselves based on descendant state (`:has(.remake-badge)`, `tbody:has(tr:hover) tr:not(:hover)`).
3. **Match-outcome ambient hue drift** — subtle hover-triggered hue shift on win/loss rows via OKLCH relative color (slow, calm, not jarring).

Read this before adding any new stat cell, list row, or data table; pick from these patterns instead of plain text.

KB anchors: [01-css-and-styling.md §`:has()`](~/.claude/knowledge/frontend-2026/01-css-and-styling.md), [01-css-and-styling.md §OKLCH](~/.claude/knowledge/frontend-2026/01-css-and-styling.md).

---

## Why

Audit verdict on data surfaces:

> "Match stats lists: Text-heavy tabular data (KDA, CS, gold) rendered as plain divs with spacing — no sparkle or data-viz micro-moments."

Three reads support the densification:

- **Sparklines.** A trend visible inline next to a number doubles the information without doubling the space. Dense data UIs without sparklines feel like spreadsheets; with them they feel like Bloomberg.
- **`:has()`** is the cheapest "parent-aware" we've ever had on the web. The audit found a perfect candidate (cards that should tint when they contain a `.remake-badge`). Costs 3 lines of CSS each, looks authored.
- **Ambient hue drift** turns the lifeless `bg-green-500/5` win-row tint into something that *responds* to focus — slow OKLCH hue shift over 1.2s on hover, subtle but present. Cousin to the existing "card-breathe" idea but row-scoped.

All three are CSS-only or trivial SVG. No JS for #2 and #3; #1 is a 30-line component.

---

## Part 1 — Inline sparklines

### Pattern

```tsx
export function Sparkline({
  data,
  width = 48,
  height = 12,
  stroke = "currentColor",
  className,
}: SparklineProps) {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const step = width / (data.length - 1);
  const points = data
    .map((v, i) => `${(i * step).toFixed(1)},${(height - ((v - min) / span) * height).toFixed(1)}`)
    .join(" ");
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className={cn("inline-block align-middle", className)}
      aria-hidden="true"
    >
      <polyline
        points={points}
        fill="none"
        stroke={stroke}
        strokeWidth={1}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
```

Variations as needed: filled area version (with `<polygon>` + accent-muted fill), endpoint dot version, baseline-line version (`<line>` at y=baseline overlaid). Keep the prop surface tiny.

### Where to apply

| Surface | Data | Notes |
|---|---|---|
| Champion detail stat row | last-10 KDA per stat | ✅ shipped 2026-05-27 — wired in `routes/lol/$accountSlug/champions/$championKey.tsx` per-game K/D/A tiles. Data sourced from `ChampionDetailStats.matchHistory` (extended with per-game K/D/A in the same chunk). |
| Profile hero KPI strip | LP delta last 30 days | ✅ shipped 2026-05-27 — initial "blocked" reading was wrong. `RankSnapshot` (added 2026-05-08) already persists per-puuid LP history; the existing `useRankHistory` hook in [profile-lp-history.tsx](../../../apps/web/src/lol/profile/profile-lp-history.tsx) was already pulling 30/90-day windows. Lifted that to the route, projected normalized LP per queue, passed into `ProfileRankTiles` as `recentLpByQueue`. Shares the TanStack Query cache key with the deeper LP-history chart on the same page, so the second consumer is free on the wire. Stroke tinted to the rank's tier color. |
| Match list row | gold-lead delta over the match | ✅ shipped 2026-05-27 — needed full ingest-time persistence. Added `teamGoldDiffSeries Int[]` to the `Match` Prisma model + migration, extended `riotTimelineToSummaryMetrics` to emit one (user-team − enemy-team) value per frame, threaded through `lol.service`'s two select projections and the shared `MatchSummary` type. Match-row meta line renders an inline `Sparkline` tinted emerald/red on win/loss when the series carries ≥5 frames. `backfill-team-gold-diff-series.ts` replays `MatchTimelineCache` to seed existing `hasTimeline=true` rows without a Riot refetch. |
| Trends summary cards | each metric's trend across selected range | ⏸ **Deferred (2026-05-27 re-survey).** Survey result: not a clean densification target. Every card either already owns a chart (`trend-kda` uses Recharts LineChart, `trend-wr-trajectory` and `trend-session-fatigue` ship bespoke inline SVGs with reference lines), or uses richer custom evidence than a sparkline could replace (`trend-comeback-resilience`/`trend-tilt-indicator`/`trend-first-blood-conversion`/`trend-game-length` use diverging bar pairs with comparison anchors; `trend-highlight-reel` is raw counts where a trend line wouldn't carry meaning). The single clean fit is `trend-streak`, but it sits directly next to `MatchRecord` in [profile-recent-form.tsx](../../../apps/web/src/lol/profile/profile-recent-form.tsx) which already renders the per-game pip pattern — adding a sparkline would duplicate. Closing this row of the arc; revisit only if a new trends card is added that lands as "one big number" without its own chart. |
| Steam library tile | playtime last 30d distribution | ✅ shipped 2026-05-27 — `SteamPlaytimeSnapshot` (daily, keyed by `appid, snapshotDate`) was already wired by the existing poller. Added `buildRecentPlaytimeSeries` helper in `owned-games.service.ts` that diffs consecutive `playtimeForeverMinutes` snapshots per appid (clamps negatives for family-share/refund resets), 30-day window query, projected onto each `SteamOwnedGame` as `recentPlaytimeMinutes: number[]`. Tile renders foreground/60, row renders white/85 over the hero. |
| Champion grid item | win rate trend last 10 games on that champ | ✅ shipped 2026-05-27 — extended `ChampionStats` with `recentWinRates: number[]` (cumulative WR over the last up-to-10 chronological games per champion). Wired into `ChampionTable` row beside the WR%/KDA line, stroke tinted to emerald/red on win-rate sign. Threshold bumped to `length >= 5` after a 2-game flat-baseline rendering was noticed. |

**Survey result (2026-05-27, final):** Five of six surfaces shipped. The "trends summary cards" row turned out to be a non-fit after re-survey rather than a follow-up — every trend card already carries chart-level evidence or sits adjacent to the same data in another component, so a sparkline would clutter rather than densify. Three of the rows initially recorded as "blocked" (LP delta, gold-lead, Steam playtime) had data sources that already existed and just hadn't been wired through.

**Lesson:** When a survey row reads "blocked on missing data source", verify by reading the Prisma schema first. Three of three "blocked" readings in this arc were wrong — the data was already there, just one or two layers away from the consumer surface.

### Color: tie to theme

`stroke="var(--theme-strong)"` by default — the sparkline picks up the route's accent from [accent-color-system.md](accent-color-system.md). Per-surface overrides where the meaning demands it (win rate sparkline can be `var(--theme-strong)`; loss rate can stay neutral).

> **Note (2026-05-26):** accent-color-system shipped under the `--theme-*` namespace (not `--accent-*` as originally planned — `--accent` is reserved by shadcn for neutral hover surfaces). The available tokens are `--theme-color` (primitive), `--theme-fg`, `--theme-muted`, `--theme-strong`, `--theme-ring`, with corresponding Tailwind utilities `bg-theme`, `text-theme-fg`, `ring-theme-ring`, etc. Every `var(--accent…)` reference further down in this file should be read as `var(--theme…)`. This arc is the natural pickup site for the deferred Chunk 5 sweep — when implementing the sparkline strokes, hover sheen, focus rings, etc., wire them to `var(--theme-strong)` / `var(--theme-ring)` directly.

### Tooltip with full series

On hover, show a small Radix tooltip with the underlying numeric series + period label. Pattern already established in [repo-conventions.md §TooltipPrimitive](../../repo-conventions.md) — wrap the `<svg>` in `TooltipPrimitive.Trigger`.

---

## Part 2 — `:has()` affordances

### Patterns to ship

```css
/* Card tints when it contains a remake badge */
.match-row:has([data-remake-badge]) {
  background: color-mix(in oklch, var(--background) 92%, var(--muted) 8%);
  opacity: 0.85;
}

/* Sibling dim when one row is hovered */
.match-list:has(.match-row:hover) .match-row:not(:hover) {
  opacity: 0.6;
  transition: opacity 220ms ease-out;
}

/* Bento grid lifts focused tile, desaturates others */
.bento-grid:has(.tile:focus-visible) .tile:not(:focus-visible) {
  filter: saturate(0.6);
  opacity: 0.7;
}

/* Champion card highlights when its detail panel is the active route */
.champion-card:has([data-route-active="true"]) {
  outline: 2px solid var(--theme-ring);
}

/* "Has new data" card pulses subtly */
.section-card:has([data-fresh="true"] .badge) {
  animation: fresh-pulse 2s ease-in-out infinite;
}
```

Each is 3–6 lines. Each adds an obvious "designed" moment without adding behavior.

### Where to apply

Sweep the app for parent-aware moments that today require JS state propagation:
- Match row's win/loss styling probably already uses class; `:has()` could simplify the hierarchy.
- Trends grid where one card is the "primary" verdict and others are supporting — supporting cards desaturate when primary is hovered.
- Profile sections with sub-tabs — parent gets a different border-color when sub-tab is `aria-selected`.

Document each addition with the WCAG implication: `:has()` affordances must not be the **only** way the user knows about state (still need explicit label or class). They're enhancement, not communication.

---

## Part 3 — Match-outcome ambient hue drift

### Pattern

```css
.match-row {
  --row-tint: transparent;
  background: var(--row-tint);
  transition: --row-tint 1200ms cubic-bezier(0.4, 0, 0.2, 1);
}

.match-row[data-outcome="win"] {
  --row-tint: oklch(from var(--theme-color) 0.5 0.12 145deg / 0.04); /* green-shifted */
}
.match-row[data-outcome="win"]:hover {
  --row-tint: oklch(from var(--theme-color) 0.55 0.16 145deg / 0.10);
}

.match-row[data-outcome="loss"] {
  --row-tint: oklch(from var(--theme-color) 0.5 0.10 25deg / 0.03); /* red-shifted, fainter */
}
.match-row[data-outcome="loss"]:hover {
  --row-tint: oklch(from var(--theme-color) 0.55 0.14 25deg / 0.08);
}

.match-row[data-outcome="remake"] {
  --row-tint: oklch(from var(--muted) l c h / 0.04);
}

@property --row-tint {
  syntax: '<color>';
  initial-value: transparent;
  inherits: false;
}

@media (prefers-reduced-motion: reduce) {
  .match-row { transition: none; }
}
```

The `@property` registration is what makes `--row-tint` animatable as a color. Without it, CSS treats it as a discrete value and the transition snaps.

### Where to apply

- Match list rows (primary surface).
- Champion grid items: shift green for high-WR champs on hover, red for low-WR.
- Trends `ConclusionCard`: shift toward verdict color (positive verdict = green-shifted accent, negative = red-shifted).

### Why this isn't loud

The opacities (`0.04 → 0.10` range) are deliberately small. The motion happens over 1.2s — long enough that it reads as "the row warming up" rather than a flash. Loud is not allowed per [motion-backlog.md](motion-backlog.md); this is the lowest-amplitude version of the idea.

---

## Chunked plan

### Chunk 1 — `Sparkline` primitive + first use ✅ shipped 2026-05-27

- `apps/web/src/components/ui/sparkline.tsx` + test (8 cases: empty/single, point count, x linear scaling, y inversion, flat-midline no-NaN, stroke default+override, aria-hidden/label gate, className merge). `data-slot="sparkline"`, default stroke `var(--theme-strong)`, `vectorEffect="non-scaling-stroke"`, `<title>` element + `role="img"` when `aria-label` provided.
- First use: champion-detail per-game K/D/A tiles (`routes/lol/$accountSlug/champions/$championKey.tsx`). Extended `ChampionDetailStats.matchHistory` with per-game `kills`/`deaths`/`assists`. Sliced last 10 games per stat, `text-theme-strong/70` + `stroke="currentColor"` for the tinted theme stroke.
- Surface survey done — see "Where to apply" table above. Champion grid is next-best pickup; the other four blocked on missing data sources.

### Chunk 2 — Sparklines in match list ✅ shipped 2026-05-27

- Landed via ingest-time persistence rather than at-request derivation: added `teamGoldDiffSeries Int[]` to the `Match` Prisma model (migration `20260527000000_match_team_gold_diff_series`), extended `riotTimelineToSummaryMetrics` to emit one (user-team − enemy-team) value per frame, threaded through `lol.service`'s two select projections and the shared `MatchSummary` type. Match-row meta line renders an inline `Sparkline` tinted emerald/red on win/loss when the series carries ≥5 frames.
- `apps/api/src/scripts/backfill-team-gold-diff-series.ts` replays existing `MatchTimelineCache` rows to seed `hasTimeline=true` matches without a Riot refetch. Run after build: `node dist/src/scripts/backfill-team-gold-diff-series.js`. Owner-run on 2026-05-27 — 534 of 534 timeline-projected rows populated.

### Chunk 3 — `:has()` pattern starter pack ✅ shipped 2026-05-27

- Shipped a single parent-aware sibling-dim rule applied to three list containers: match list (`.match-list`), champion table (`.champion-list`), and Steam library list + grid (`.steam-library`). When one card is hovered, the others fade to `opacity: 0.65` with a 220ms ease-out transition. Reduced-motion disables the transition only.
- Rule lives in [index.css](../../../apps/web/src/index.css) alongside the `--row-tint` block. Semantic classes added to the four parent containers ([match-list.tsx](../../../apps/web/src/lol/matches/match-list.tsx), [champion-table.tsx](../../../apps/web/src/lol/champions/champion-table.tsx), [library-list-virtual.tsx](../../../apps/web/src/steam/library/library-list-virtual.tsx), [library-grid-virtual.tsx](../../../apps/web/src/steam/library/library-grid-virtual.tsx)) and a `library-tile` class to the Steam tile/row wrappers ([library-row.tsx](../../../apps/web/src/steam/library/library-row.tsx), [library-tile.tsx](../../../apps/web/src/steam/library/library-tile.tsx)).
- Other patterns from the note skipped: `:has([data-remake-badge])` is redundant with the existing `data-outcome="remake"` attribute selector (direct selector beats `:has()` here); `:has([data-route-active])` and the fresh-pulse pattern need state wiring that isn't worth the lift for a starter-pack chunk. Two solid lists at three surfaces > three forced rules.

### Chunk 4 — Ambient hue drift on match rows ✅ shipped 2026-05-27

- `@property --row-tint` registered in [index.css](../../../apps/web/src/index.css) next to the existing `--sheen-extent` block; `.match-row` rules with win/loss/remake `data-outcome` selectors + `:hover` boost + `prefers-reduced-motion` transition disable.
- `data-outcome` set on the card root in [match-row.tsx](../../../apps/web/src/lol/matches/match-row.tsx) (`match.remake ? "remake" : match.win ? "win" : "loss"`); the `match-row` class is added on the same row so the CSS only targets match-list rows, not the shared `championCardClassName` consumers (champion table, etc.).
- Tint paints through the splash-side gradient where it's transparent (left ~10–45% of the card); the solid right portion of the gradient masks it from the stats column by design — splash side warms, text side stays clean.
- Visual verification still pending on long lists for cumulative-tint saturation; if needed, dial back the `0.04 / 0.10` win opacities first since the splash placeholder already contributes some theme-tint warmth.

### Chunk 5 — Roll sparklines into Profile + Trends + Steam ✅ shipped 2026-05-27

- Profile hero rank tile: 30-day normalized LP per queue from `RankSnapshot`, shares TanStack Query cache with the LP-history chart below.
- Steam library tile + row: 30-day per-game playtime series derived from `SteamPlaytimeSnapshot` diffs.
- Trends summary cards: deferred as a non-fit after re-survey — every card already owns chart-level evidence or sits next to the same data in another component. See the "Where to apply" table for the reasoning.

### Chunk 6 — Sparkline accessibility pass ✅ shipped 2026-05-27

- ✅ Each sparkline has an `aria-label` describing the trend (shipped with each surface; e.g. "win rate trend, last N games", "gold lead trend, N frames", "LP trend, last N snapshots", "playtime trend, last N days").
- ✅ Tooltip on hover for full series — `Sparkline` primitive grew an opt-in `tooltip?: React.ReactNode` prop ([sparkline.tsx](../../../apps/web/src/components/ui/sparkline.tsx)) that wraps the svg in `TooltipPrimitive` with a focusable `<button>` trigger so keyboard users can also reach it. Rolled out on the two standalone surfaces: profile rank tile ([profile-rank-tile.tsx](../../../apps/web/src/lol/profile/profile-rank-tile.tsx) — LP trend with first/last + min/max breakdown) and champion-detail K/D/A tiles ([routes/.../$championKey.tsx](../../../apps/web/src/routes/lol/$accountSlug/champions/$championKey.tsx) — full per-game values). Other surfaces (match-row, champion-table rows, Steam tile + row) were intentionally skipped because their sparklines live inside another popover/hovercard — nested triggers would race and conflict. Per-surface judgment, not a blanket rule.
- ✅ Axe scan wired into the Sparkline primitive's test suite ([sparkline.test.tsx](../../../apps/web/src/components/ui/sparkline.test.tsx)) covering both bare and tooltip-enabled variants. Tests also assert the tooltip-enabled variant renders a focusable `<button type="button">` with the svg inside.

---

## Files in scope

New:
- `apps/web/src/components/ui/sparkline.tsx` + test

Modified:
- `apps/web/src/styles/globals.css` (or a new `interactions.css`)
- Match list, profile, champion detail, trends, Steam library, bento tiles — many surfaces, small per-surface changes
- Possibly `apps/api/src/lol/match-mapper.ts` if gold-lead-trend isn't already exposed

---

## Risks / open questions

- **Sparkline polyline aliasing.** At 1px stroke width, diagonal lines anti-alias unevenly across browsers. `vectorEffect="non-scaling-stroke"` helps but doesn't eliminate. Acceptable trade-off; alternative (canvas at devicePixelRatio) is heavier.
- **`@property` browser support.** Chrome 85+, Safari 16.4+, Firefox 128+. Older browsers ignore the registration; the transition won't animate but the rule still applies (snaps). Document as graceful degradation.
- **`:has()` performance.** Modern browsers handle `:has()` well but extremely deep / broad selectors can be slow. Keep selectors to direct-descendant-ish patterns; avoid `*:has(*)` traversals.
- **Outcome data attributes.** Make sure `data-outcome` is set consistently across all match-row consumers (match-list, match-hero, recent-form pips). Add a shared helper in `packages/shared/src/lol/match-outcome.ts` per [repo-conventions.md §Centralise domain invariants](../../repo-conventions.md).
- **Sparkline test ergonomics.** Snapshot tests on SVG path strings are brittle. Test the count of points + min/max scaling instead.

---

## Reduced motion

- **Sparklines**: no motion.
- **`:has()` rules**: no motion (state-driven static styling).
- **Ambient hue drift**: `transition: none` in the reduced-motion block. Tints still apply but snap instantly. Information (win/loss tint) is preserved; only the transition is removed. See [reduced-motion-replacements.md](reduced-motion-replacements.md).
