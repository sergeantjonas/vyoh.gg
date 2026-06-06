# Editorial typography pass

**Status:** Shipped 2026-05-27 — all chunks landed, then a same-day cross-app extension sweep, then a same-day primitive bifurcation when visual review revealed the cross-app sweep was using one primitive for two structural roles. Final state: **two header primitives** that mirror the industry-standard `<h2>` section divider vs `CardTitle` distinction (Primer / Carbon / shadcn/ui — see [02-design-systems.md §6](~/.claude/knowledge/frontend-2026/02-design-systems.md)). `SectionTitle` (`font-semibold text-foreground`, more prominent) for ~23 page-zone dividers on page background; `CardTitle` (`font-medium text-foreground/70`, quieter) for 4 sites inside card chrome (Steam `game-about-block`, `game-unlock-timeline`, `achievement-panel` ×2). Convention codified in [docs/repo-conventions.md § "Header primitives: `SectionTitle` vs `CardTitle`"](../../repo-conventions.md). KDA / win-rate / LP-delta call-site sweep landed in the same arc (10 + ~25 + 4 sites); only sites with dual numeric+display use, percentage-points (pp) deltas, or CSS-width dependencies were left to [quick-wins.md](quick-wins.md). MatchHero + bento + trend ConclusionCard surfaces intentionally not migrated — see per-chunk notes. Part of [elevation-arcs.md](elevation-arcs.md) Tier 2.

**Follow-on arc:** the typography sweeps surfaced layout-level inconsistencies the typography primitives can't resolve (Steam game-detail flat-cards vs LoL profile grouped-sections; match-detail chart sections bare vs Steam in-chrome). Those are scoped as [page-composition.md](page-composition.md) — decides per-surface IA (when to group cards under dividers vs flat) and container convention (chrome around section bodies vs bare), then sweeps.

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

### Chunk 6 — Section title pass ✅ 2026-05-27

Landed as `SectionTitle` primitive in `apps/web/src/components/ui/section-title.tsx` (`text-sm font-medium uppercase tracking-[0.2em] text-foreground/70`, defaults to `<h3>`, `as` prop for `h2`/`h4`). Three-test file alongside.

**Audit revealed three distinct slots, not two as initially framed:**

- **Slot A — Section title** (introduces a substantial card body): ~20 LoL `<h3>`s. Currently sentence-case `text-sm font-medium [text-muted-foreground]`. **Migrated** to `SectionTitle`.
- **Slot B — Tile/chip caption** (small label above a 1–2 line verdict in a 200–400px tile): ~14 Steam + home + `card-shell` `<h3>`s using `text-xs uppercase tracking-wide text-muted-foreground`. **Intentionally untouched** — bumping these to 14px `tracking-[0.2em]` would collapse the bento tile hierarchy (caption would compete with the 16px verdict line below).
- **Slot C — Pair caption** (HeroLabel, `tracking-[0.18em]`): already shipped in Chunk 2; distinct from slot A on purpose.

The earlier "LoL vs Steam" framing was misleading — Steam doesn't really have slot-A surfaces, it has slot-B captions on bento-style tiles that are already aligned with home. Migrated surfaces in slot A: profile-role-strip, profile-synergy (×2), profile-duos (×2), profile-queue-distribution, profile-activity-calendar, profile-pregame-ritual, profile-post-game, match-event-timelines, match-lane-phase, match-spell-casts, match-skill-order, match-build-order, match-detail-view (team-section header w/ inline Win/Loss + gold-lead chips, preserved via `className` passthrough), match-gold-lead, match-owner-stats, match-damage-profile.

**Intentional skips:** patches-page `<h3>{group.name}</h3>` and `<h3>{group.champion}</h3>` are list-row item titles, not section titles — rendering `R Y Z E` editorial-caps would be ridiculous. Each h3 labels one row, not a section.

**Cross-app extension sweep (same day, post-visual-review):** initial scope-correction missed Steam slot-A surfaces because their text classes (`text-xs uppercase tracking-wide text-muted-foreground`) matched the slot-B audit pattern, causing all Steam `<h3>`s and `<h2>`s to be classified as tile captions. Visual review showed Steam game-detail "About this game" + "Unlock Timeline", Steam profile "Trophy case", and the achievements page sections all functionally introduce substantial card bodies and should be slot A. Extended sweep migrated 6 Steam surfaces to `SectionTitle`: game-about-block (h2), trophy-case-strip (h2), game-unlock-timeline (h3), hundred-percent-hall (h2 with badge count child), rarest-section (h2 with badge count child), achievement-panel (×2 h2 — empty-state + populated). Skipped: now-playing chip (chrome on dark hero overlay), recent-unlocks-virtual list-row group dividers ("Today" / "Yesterday"), CardShell primitive (mode-dependent between slot A and slot B; per-use migration is wrong scope), home bento tiles. Lesson for future audits: don't classify slot by text class signature alone — check what body the header introduces.

**Primitive bifurcation (same day, post-cross-app sweep):** second visual review surfaced a deeper inconsistency — the same `SectionTitle` primitive was being used for two structurally different roles. Some sites were page-zone dividers sitting on the page background (LoL `Pre-game`, `Roles`, Steam `Trophy case`); other sites were headers sitting inside card chrome (Steam `About this game` in a `rounded-lg border bg-card/50 p-4` wrapper). Industry-standard slot pattern (Primer, Carbon, shadcn/ui — KB §6) distinguishes these as separate primitives. Bifurcation landed: `SectionTitle` upgraded to `font-semibold text-foreground` (more prominent — commands the region it divides), `CardTitle` introduced with the old quieter treatment (`font-medium text-foreground/70` — fits inside chrome). Four sites migrated to `CardTitle`: game-about-block, game-unlock-timeline, achievement-panel (×2). `profile-recent-form` (previously orphaned at the old slot-B treatment `text-xs uppercase tracking-wide`) also migrated to `SectionTitle` so it matches its `Pre-game` / `Post-game` page-zone-divider siblings. Convention written to [docs/repo-conventions.md § "Header primitives"](../../repo-conventions.md) so future surfaces pick the right primitive by structural test (does the header sit inside `rounded-lg border bg-card/…` chrome?), not by content feel. Lesson for future design-system work: one primitive per semantic role, even when usage counts are unbalanced — deferring the bifurcation means re-doing the sweep when the second use-case appears.

**Third-round sweep (same day, post-bifurcation):** third visual review surfaced sites that all earlier audits had missed. Causes: (a) they used `<span>` / `<p>` instead of `<h2>` / `<h3>` so the heading-tag regex skipped them, (b) they used `text-sm font-medium` *without* `text-muted-foreground` so the LoL-pattern regex missed them, (c) they were rendered transitively through a shared layout primitive (`CardShell`) instead of directly. Three categories landed:

- **`match-review-view.tsx` four sites** (Highlights, Your baseline, Decision quality, Gold lead) — sentence-case `<span>` / `<p>` headers on the Match-detail Review tab. They were structurally equivalent to the BUILD ORDER / SPELL CASTS / etc. headers on the Your Game tab but rendered with the *old* sentence-case `text-sm font-medium` idiom that pre-dated SectionTitle. Migrated to `SectionTitle` (page-zone dividers on page background). Headers with inline subtitle siblings (Your baseline / Gold lead) wrap SectionTitle in a flex `<div>` rather than nesting the subtitle inside.
- **`card-shell.tsx` internal `<h3>` migrated to `CardTitle`** — upgrades ~45 chip surfaces transitively (Steam profile bento chips, Steam game-detail metric tiles, LoL trend ConclusionCards, LoL champion-detail FactCards). All these chips wrap in `rounded-lg border bg-card/50 p-4` chrome → CardTitle is the correct primitive. Single change point in CardShell propagates to every consumer.
- **`status-page.tsx` four `<h2>`s** (Rate limiter — app windows, Rate limiter — method families, Recent ticks, Match sync) — used `text-sm font-semibold uppercase tracking-wide text-muted-foreground`, *almost* the new SectionTitle treatment but with the wrong tracking and color. Migrated to `SectionTitle as="h2"` so the status page joins the editorial rhythm of the rest of the app.

**Lessons consolidated for future audits (added to [docs/repo-conventions.md § "Header primitives"](../../repo-conventions.md)):** (1) don't grep for header patterns by text-class signature — grep for *roles* (introducing a substantial body). (2) check `<span>` and `<p>` too, not just `<h2>` / `<h3>`. (3) check shared layout primitives like `CardShell` once and propagate via that single change point. (4) the chrome test (`rounded-lg border bg-card/…` immediately around the header → CardTitle, else SectionTitle) is the mechanical rule; everything else is judgment around it.

### Chunk 7 — Number formatting consolidation ✅ 2026-05-27

Helpers landed in `packages/shared/src/format.ts` (existing file, not a new directory — the audit found `formatDuration`, `formatGold`, `formatPlaytime*`, `formatHoursMinutes` already there):

- `formatKda(ratio)` — two decimals (`3.42`).
- `formatLpDelta(delta)` — explicit `+` for ≥ 0 (`+24`, `+0`, `-15`). Zero renders as `+0` for tabular column alignment.
- `formatPercent(ratio, decimals = 0)` — whole percent by default (`58%`), optional decimals for sub-point precision (`58.3%`).

All three exported via `packages/shared/src/index.ts`; 13 new tests added covering rounding behavior, sign semantics, and decimal precision. `formatKda` test uses `1.234`/`1.236` rather than `.005`/`.015` edge values — IEEE 754 representation makes `.x15` test cases non-deterministic.

**Call-site migration landed in this arc (2026-05-27, expanded from the original 5/4/20+ note estimates):**

- **KDA: 10 sites swept** across `recap-champion.tsx`, `recap-signature-game.tsx`, `profile-now-playing.tsx`, `trend-kda.tsx` (×3), `match-review-view.tsx`, `_shared/ui/match-record.tsx`, `routes/lol/.../champions/$championKey.tsx` (×2). All mechanical — every site was `value.toFixed(2)` shape.
- **LP delta: 4 sites swept** (`match-row.tsx`, `_shared/ui/match-record.tsx`, `routes/lol/.../$matchId.tsx`, `recap-rank-arc.tsx`). The three `> 0 ? "+" : ""` sites now render zero as `+0` (intended improvement — column alignment was the helper's whole point). `match-row.test.tsx` updated to assert `"+0 LP"`. recap-rank-arc was already `>= 0`, so it's a no-op semantically.
- **Win-rate percent: ~25 sites swept** in `trend-death-timing.tsx` (8), `trend-worst-matchup.tsx`, `profile-role-strip.tsx` (2), `profile-duos.tsx`, `profile-now-playing.tsx`, `profile-synergy.tsx` (3), `profile-rank-tile.tsx`, `match-review-view.tsx` (2), `recap-duo-of-year.tsx`, `recap-champion.tsx` (2 uses).

**Remaining percent sites NOT swept** — left in [quick-wins.md](quick-wins.md) for a focused follow-up because each needs per-site judgment:

- Sites where `const pct = Math.round(x * 100)` is used both numerically AND for display (`Math.abs(pct) < 4`, `weight: pct + 5`, etc.) — keeping a single variable forces a refactor that's not purely mechanical. Examples: `recap-top-insight.tsx`, `recap-most-improved.tsx`, `recap-patch-verdict.tsx`, `trend-first-blood-conversion.tsx`, `trend-session-fatigue.tsx`, `trend-weekly-review.tsx`.
- Sites where the integer pct drives a CSS `width: ${pct}%` AND a display — `trend-first-blood-conversion.tsx` progress bars. Display can migrate; the CSS-width path stays numeric.
- `pp` (percentage-points) deltas — these are not 0–1 ratios; the helper's `(ratio * 100).toFixed(0)` shape doesn't fit. Don't sweep; they remain inline integer formatting.
- `profile-stats-bar.tsx:52` — `<CountUp to={Math.round(s.winRate * 100)} />%` — CountUp wraps the number, can't take a pre-formatted string. Skip unless CountUp gains a formatter prop.
- `profile-post-game.tsx`, `match-damage-profile.tsx` — `pct` stored on objects used downstream as numeric values. Skip.

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
