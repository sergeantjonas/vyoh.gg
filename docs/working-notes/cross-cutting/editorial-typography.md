# Editorial typography pass

**Status:** Active — Chunk 1 verified 2026-05-27 (Geist axis inventory pinned below). Part of [elevation-arcs.md](elevation-arcs.md) Tier 2. Lean into the Geist Variable font's `wght` axis for hero numbers and section headlines, with subdued label treatment paired beneath. Recruiter-scan signal in 4 seconds.

## Geist variable axes (verified 2026-05-27, Chunk 1)

Source: `apps/web/node_modules/@fontsource-variable/geist/metadata.json` (`@fontsource-variable/geist@5.2.8`, Geist v4, 2025-09-11).

- `wght`: 100–900, step 1, default 400 — **continuous, supports 380 and 720 directly**.
- `opsz`: NOT exposed. Drop all optical-size language from this note; rely on weight + size only.
- `slnt` / `ital`: NOT exposed (single `"normal"` style). No italic axis to lean on.

Subsets shipped: cyrillic, latin, latin-ext. Loaded via `@import "@fontsource-variable/geist"` in `apps/web/src/index.css:4`; `--font-sans: "Geist Variable", sans-serif` declared at `index.css:151`.

The Chunk 2 component design is unchanged for weight (720/380) and tracking. Any `font-variation-settings: "opsz" ...` declarations must be omitted.

Read this before adding any new hero stat, headline, or section title; pick from the established type ramp rather than inventing new sizes/weights ad-hoc.

KB anchors: [01-css-and-styling.md §typography](~/.claude/knowledge/frontend-2026/01-css-and-styling.md), [02-design-systems.md §typography tokens](~/.claude/knowledge/frontend-2026/02-design-systems.md).

---

## Why

The audit (2026-05-23) found:

- Geist Variable is loaded but typographic *contrast* is flat — most numbers render at the same weight as labels (semibold).
- Hero numbers (KDA, win rate, LP delta, playtime hours) are big but not dramatic. The unbalanced relationship between bold numbers and subdued labels is where editorial design lives.
- Section titles use uppercase tracked headers (0.2em letter-spacing) — already good. But they don't differentiate stream-level (LoL/Steam section) from sub-section (KDA breakdown), and the rhythm reads samey across the app.

The cost is one stylesheet pass + a small component (`<HeroNumber>` and `<HeroLabel>`) for the most-repeated pattern. The payoff is the first thing a reviewer feels without naming.

---

## What this is NOT

- **Not a font swap.** Geist stays. Geist Variable v4 exposes `wght` only (no `opsz`, no italic) — design relies on weight + size alone.
- **Not a full type-scale overhaul.** Most body text is already fine. This arc targets hero numbers, section headlines, and labels — the three rungs where contrast pays off.
- **Not a dark/light mode tweak.** Independent of palette.

---

## Type ramp targets

Three rungs with deliberate axis usage:

### Hero numbers (KDA, win rate, LP delta, playtime hours)
- **Size**: clamp(2.5rem, 5vw, 4rem) for top-level hero; clamp(1.75rem, 3vw, 2.5rem) for inline secondary.
- **Weight**: 720 (heavier than the default 600 semibold; Geist `wght` axis 100–900 verified).
- **Tracking**: `-0.02em` (tight, editorial).
- **Tabular numerals**: `font-variant-numeric: tabular-nums;` — non-negotiable for stat displays (column alignment).
- **Line height**: 1 (flat, magazine-style).

### Hero labels (paired with hero numbers)
- **Size**: 0.6875rem (11px).
- **Weight**: 380 (lighter than the default 400; Geist `wght` axis supports it directly).
- **Tracking**: `0.18em`.
- **Transform**: uppercase.
- **Color**: `text-muted-foreground/80`.
- **Line height**: 1.2.

### Section titles
- **Size**: 0.75rem (12px) for sub-section, 0.875rem (14px) for section.
- **Weight**: 500.
- **Tracking**: `0.2em` (matches existing rhythm).
- **Transform**: uppercase.
- **Color**: `text-foreground/70`.

Body, navigation, table content stay on the current rules.

---

## New primitives

### `<HeroNumber>` / `<HeroLabel>`

New file `apps/web/src/components/ui/hero-number.tsx`:

```tsx
export function HeroNumber({ children, size = "lg", className, ...rest }) {
  return (
    <span
      className={cn(
        "block tabular-nums tracking-[-0.02em] leading-none font-[720]",
        size === "lg" && "text-[clamp(2.5rem,5vw,4rem)]",
        size === "md" && "text-[clamp(1.75rem,3vw,2.5rem)]",
        className,
      )}
      {...rest}
    >
      {children}
    </span>
  );
}

export function HeroLabel({ children, className, ...rest }) {
  return (
    <span
      className={cn(
        "block uppercase text-[11px] tracking-[0.18em] font-[380] text-muted-foreground/80 leading-tight",
        className,
      )}
      {...rest}
    >
      {children}
    </span>
  );
}
```

Composition: `<HeroLabel>KDA</HeroLabel><HeroNumber>3.42</HeroNumber>`. The label *above* the number reads as a magazine caption; below it reads as a chart legend. **Above** by default; component supports `<HeroPair label="KDA" value={3.42} />` for the inverted convenience.

`CountUp` ([count-up.tsx](../../../apps/web/src/components/count-up.tsx)) wraps `HeroNumber` cleanly — `<HeroNumber><CountUp value={3.42} decimals={2} /></HeroNumber>` — without changes to either.

### Where to apply

| Surface | File |
|---|---|
| Profile header KPI strip | `apps/web/src/lol/account/profile-*.tsx` |
| Match hero KDA + duration + queue | `apps/web/src/lol/matches/match-hero.tsx` |
| Champion detail hero stats | `apps/web/src/routes/lol/$accountSlug/champions/$championKey.tsx` |
| Trends summary cards | trends-related card components |
| Steam playtime hero on game detail | Steam game detail (when it exists) |
| Bento tile hero numbers on `/` | `apps/web/src/home/tile-*.tsx` |

---

## Chunked plan

### Chunk 1 — Verify Geist's variable axes ✅ 2026-05-27

Findings pinned in the Status section above. Geist Variable v4 exposes `wght` 100–900 continuous (step 1) and nothing else; no `opsz`, no italic. Design holds for the 720/380 weight pairing; optical-size language has been removed from the rest of this note.

### Chunk 2 — `HeroNumber` + `HeroLabel` primitives

- Implement the components per above.
- Tests: snapshot of rendered class lists; presence of `tabular-nums`; `CountUp` integration smoke test.

### Chunk 3 — Pilot on Profile header

- Replace one section of profile (KDA / WR / Games strip) with `<HeroPair>` usage.
- Visual verification: paired against the existing labels-above-numbers — does the new contrast read as deliberate or as a weight mismatch? If the latter, retune (likely the label color is too light or the number weight too heavy).

### Chunk 4 — Roll out to match hero + champion detail

- Match hero: KDA + queue + duration become hero-pair triples.
- Champion detail hero: aggregated win rate + games + average KDA.
- Verify the visual rhythm reads consistent across both pages.

### Chunk 5 — Trends + Bento ✅ 2026-05-27 (scope reshaped)

Adopted in profile-multikill-strip (Pentas/Quadras/Triples/Doubles/Best Spree) and profile-rank-tile (Tier+division as the hero, queue label as caption). Both used the same `text-lg font-semibold` + uppercase-tracked-label pattern as profile-stats-bar (Chunk 3).

**Bento + Trends finding (no edits):** the home bento tiles (TileWeeklyTotals, TileSessionLengths, TileChronotype, etc.) and the trend cards (ConclusionCard-based: TrendTiltIndicator, TrendWeeklyReview, etc.) communicate via *verdict sentences* ("5h 23m gaming", "75% of sessions are under 1h.", "Win rate drops 8% after a loss.") rather than isolated hero stat numbers. None of them use `text-2xl`-or-larger displays. Forcing HeroNumber would either break the sentence flow or require splitting verdicts into number + suffix pairs that read worse than the current treatment. The editorial-typography primitives stay scoped to KPI-strip and stat-tile surfaces; verdict-sentence tiles keep their `text-base font-semibold` rhythm.

### Chunk 6 — Section title pass

- Sweep section headlines across the app.
- Standardise on the two ramp rungs (12px sub, 14px section).
- Often this means tightening existing `<h2>`/`<h3>` styles, not adding new ones.

### Chunk 7 — Number formatting consolidation

- Side-quest that emerges naturally: shared formatting helpers in `packages/shared/src/format/` (per [repo-conventions.md §Cross-package utilities](../../repo-conventions.md)) for KDA (`3.42`), playtime (`1d 4h`), LP delta (`+24`), percentages (`58.3%`). Likely some already exist; consolidate per the same audit pattern that surfaced the 6 duration formatter copies in May 2026.
- Each formatter returns a string that's safe to pass into `<HeroNumber>`.
- Tests for each formatter.

---

## Files in scope

New:
- `apps/web/src/components/ui/hero-number.tsx` + test
- Possibly: `packages/shared/src/format/*` if consolidation surfaces (Chunk 7)

Modified:
- Profile header surfaces (Chunk 3)
- `apps/web/src/lol/matches/match-hero.tsx` (Chunk 4)
- `apps/web/src/routes/lol/$accountSlug/champions/$championKey.tsx` (Chunk 4)
- Trends summary cards (Chunk 5)
- `apps/web/src/home/tile-*.tsx` (Chunk 5)
- Section title sweep (Chunk 6) — many files, small per-file changes

---

## Risks / open questions

- **Geist axis exposure.** Resolved 2026-05-27 (Chunk 1): `wght` 100–900 continuous, no `opsz`, no italic. Design holds.
- **`tabular-nums` and CountUp.** CountUp animates a numeric value across frames. Each frame's rendered string may differ in width during animation. `tabular-nums` should pin the width per digit slot — verify the animation doesn't visibly jitter.
- **Accent color and number color.** Hero numbers default to `text-foreground`. Some surfaces may want `text-accent` to tie into the accent system from [accent-color-system.md](accent-color-system.md) — e.g. KDA on champion detail. Decide per-surface; document the rule.
- **i18n.** Different locales have different numeric conventions (comma vs. period decimal separator, narrow non-breaking space thousands separator). If i18n ever lands per [vnext-ideas.md](vnext-ideas.md), formatters must use `Intl.NumberFormat`. Note as a forward-reference.

---

## Reduced motion

No motion in this arc. Independent of `prefers-reduced-motion`.

`CountUp` already has a `SHOULD_ANIMATE` test bypass (per CLAUDE.md) and presumably honors reduced-motion at runtime — verify and document if it doesn't.
