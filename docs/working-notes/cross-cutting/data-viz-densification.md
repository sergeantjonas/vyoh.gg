# Data-viz densification

**Status:** Planned. Part of [elevation-arcs.md](elevation-arcs.md) Tier 2. Three related moves that together transform the app's flattest surfaces (stat lists, match tables, text-heavy data displays) into the most-information-per-pixel:

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
| Profile hero KPI strip | LP delta last 14 days | **Blocked** — no LP history persisted. Riot doesn't expose per-match LP delta, would need backfill via league-V4 polling. Skip until a data source exists. |
| Match list row | gold-lead delta over the match | **Blocked** — `MatchSummary` carries only the scalar `teamGoldDiffAt15` (one number, not a series). Sparkline needs a timeline; would require persisting goldDiff samples per minute in the match record. File follow-up before picking up. |
| Trends summary cards | each metric's trend across selected range | **Per-card design call** — every trend card already owns a chart (Recharts LineChart for WR trajectory, etc). Sparkline replaces only where the card currently shows just a number + sub-text. Re-survey when picking up. |
| Steam library tile | playtime last 30d distribution | **Blocked** — Steam API exposes `playtime_forever` + `playtime_2weeks` scalars, no per-day distribution. Need a poller writing daily snapshots to our own table. File follow-up. |
| Champion grid item | win rate trend last 10 games on that champ | ✅ shipped 2026-05-27 — extended `ChampionStats` with `recentWinRates: number[]` (cumulative WR over the last up-to-10 chronological games per champion). Wired into `ChampionTable` row beside the WR%/KDA line, stroke tinted to emerald/red on win-rate sign. |

**Survey result (2026-05-27):** Two of the six surfaces are shipped (champion-detail K/D/A + champion grid). The remaining four are blocked on missing data sources (LP history, gold-lead timeline, Steam daily playtime) or per-card design decisions.

For data sources that don't already exist, file a follow-up note rather than expanding this arc — the sparkline component is the unit of work; consumers come incrementally.

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

### Chunk 2 — Sparklines in match list

- Add gold-lead-over-time sparkline per row.
- Data: derive from existing timeline data if loaded, otherwise add a `goldLeadTrend: number[]` field at the API mapper level.
- This may require a `apps/api/src/lol/match-mapper.ts` change — be careful, scope explicitly.

### Chunk 3 — `:has()` pattern starter pack

- Add the 3 most-applicable rules to `apps/web/src/styles/globals.css` (or a dedicated `interactions.css`).
- Apply data attributes where needed (`data-remake-badge`, `data-route-active`).
- Visual verification of each rule firing.

### Chunk 4 — Ambient hue drift on match rows

- Add the `@property` registration + the data-attribute-targeted rules.
- Modify [match-list.tsx](../../../apps/web/src/lol/matches/match-list.tsx) to set `data-outcome={...}` on each row.
- Visual verification on long lists — does the cumulative tint feel too saturated when many rows are visible? Adjust opacity if so.

### Chunk 5 — Roll sparklines into Profile + Trends + Steam

- Apply to surfaces listed in Part 1's table.
- Each surface gets one commit.

### Chunk 6 — Sparkline accessibility pass

- Each sparkline has an `aria-label` describing the trend ("KDA over last 10 games: 2.1 to 3.4, generally upward").
- Tooltip on hover for full series.
- Axe scan addition per [repo-conventions.md §Axe-scan](../../repo-conventions.md).

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
