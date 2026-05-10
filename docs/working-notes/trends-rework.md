# vyoh.gg — Trends-as-conclusions rework

Working plan for reframing the Trends page from a "raw stats dashboard" into a "what should I improve?" briefing. Read this when working on any of: trends page layout, time-window selector for trends, conclusion-card visual pattern, profile/trends content split, or any new trends insight tile.

This is a living plan, not a contract. Phases are sequenced so each one ships value on its own — don't block phase N on phase N+1's full scope. Companion to [views-roadmap.md](views-roadmap.md) (which originally established the Profile/Champion-detail tracks) and [match-depth-roadmap.md](match-depth-roadmap.md) (which informs the Phase T4 dependencies below).

---

## Premise

Trends today is six tiles of *raw data presented as charts*. The Profile page, by accident, is where the actual *conclusions* live (Weekly Review, Tilt, Game Length, Time Heatmap). This is misfiled.

The reframe:

- **Profile = identity + current state.** Snapshot of who you are right now. Rank, recent form, what you play, where you stand. No "improve here" copy.
- **Trends = conclusions + directional change.** "Your win rate is dropping," "you tilt after losses," "your strongest hour is Fri 8pm — exploit it." Every tile says something. Every tile suggests an action.

**The litmus test:** if a tile would still make sense after just 5 games, it belongs on Profile. If it requires meaningful sample to have anything to *say*, it belongs on Trends.

---

## Guiding principles

- **Every Trends tile is a conclusion, not a stat.** The form is *signal → reading → prescription*. No "here's your KDA chart" without a verdict attached.
- **Sample-size honesty.** Every conclusion carries a sample-size badge. Small samples render as "directional only"; large samples render as "confident." Trust calibration is part of the design, not a footnote.
- **Visual ambition is co-equal with analytical power.** This is a portfolio piece. Each conclusion card needs to look great AND say something substantive. Push the aesthetic; don't dilute the analysis to make components simpler.
- **Calm aesthetic still applies.** No celebratory primitives. The "you did well" tile uses the same restraint as the "you should improve here" tile. Conclusions are observations, not judgments-with-tone (cf. `feedback_calm_aesthetic`).
- **Time-shaped, not match-count-shaped.** Improvement is a temporal phenomenon — "this week vs. last week." The selector encodes that.
- **Reuse first.** Tilt, game-length, heatmap, weekly-review, KDA chart, streak chip already exist. The rework is mostly about moving and re-skinning, not rewriting.

---

## Current state inventory

Concrete inventory as of this doc's writing — useful so each phase below can describe a delta rather than restating the baseline.

**Trends page** ([apps/web/src/routes/lol/$accountSlug/trends.tsx](../../apps/web/src/routes/lol/$accountSlug/trends.tsx)) currently renders:

| Tile | File | Verdict |
|---|---|---|
| TrendStreak chip in header | [trend-streak.tsx](../../apps/web/src/lol/trends/trend-streak.tsx) | **Duplicate** — also on Profile via Recent Form |
| TrendSummaryCards (Record/KDA/Played) | [trend-summary.tsx](../../apps/web/src/lol/trends/trend-summary.tsx) | **Duplicate** — same numbers as ProfileStatsBar |
| MatchRecord pips | [match-record.tsx](../../apps/web/src/lol/_shared/match-record.tsx) | **Duplicate** — Recent Form on Profile |
| TrendActivity (365-day calendar heatmap) | [trend-activity.tsx](../../apps/web/src/lol/trends/trend-activity.tsx) | Profile-y — cadence snapshot, not a trend |
| TrendKda (KDA per-game line chart) | [trend-kda.tsx](../../apps/web/src/lol/trends/trend-kda.tsx) | Raw data, no conclusion |
| TrendQueue (donut chart) | [trend-queue.tsx](../../apps/web/src/lol/trends/trend-queue.tsx) | Profile-y — "what you play" is identity |

**Profile page** ([apps/web/src/routes/lol/$accountSlug/index.tsx](../../apps/web/src/routes/lol/$accountSlug/index.tsx)) currently renders, in order:

1. ProfileRankTiles — current rank per queue
2. ProfileRecentForm — last 20 W/L pips + streak chip
3. ProfileLpHistory — LP line chart
4. ProfileNowPlaying — top 1–3 champs in last 7 days
5. ProfileStatsBar — total games, WR, KDA, time played
6. **ProfileWeeklyReview** — auto-picked insights (this is a Trend in disguise)
7. **ProfileTimeHeatmap** — 24×7 hour-of-week heatmap with WR coloring (Trend in disguise)
8. **ProfileTiltIndicator** — after-win vs after-loss WR (Trend)
9. **ProfileGameLength** — WR by game-length bucket (Trend)
10. **ProfilePoolEntropy** — unique champion count, last 30 days (Trend)

The five bolded items are the misfiles.

---

## Reorganization summary

### Move from Trends → Profile

- **Queue distribution.** "What you play" is identity. Render condensed (the current donut is too large for Profile real-estate — propose a horizontal stacked-bar variant near Now-Playing).
- **Activity calendar (365-day heatmap).** Cadence snapshot, profile-fits. Beautiful artifact, just on the wrong page.

### Move from Profile → Trends

- **Weekly Review** → top of Trends as the "headline briefing."
- **Time-of-day heatmap** → Trends, with insight chips overlaid ("Strongest: Fri 8pm — 72% WR · 11 games").
- **Tilt indicator** → Trends, with prescriptive copy.
- **Game-length card** → Trends, with prescriptive copy.
- **Pool entropy** → Trends as an interim relocation in T1, then **folded into the new merged Champion-focus tile in T3** (entropy number lives inside the same card as the top-3 prescription). Profile keeps a small "X champs played" cell in the stats bar — see below.

### Delete

- TrendSummaryCards (full duplicate of ProfileStatsBar).
- MatchRecord rendering on Trends (duplicate of Recent Form).
- TrendStreak chip rendering at top of Trends (duplicate of Recent Form's chip).

### Keep on Trends, but reframe

- **TrendKda line chart.** Today raw; gets a trend-line overlay + verdict chip in Phase T2 ("KDA up 0.4 vs. previous window — improving").

### Keep on both, deliberately

- **Streak chip** — Profile context = "where you stand right now." Trends context = part of momentum analysis. Same component, different framing label.

### Final layouts

**Profile (post-rework):**

1. Rank tiles
2. Recent Form (pips + streak chip)
3. LP history
4. Now playing
5. Role distribution strip (planned — see [views-roadmap.md](views-roadmap.md) Phase 6)
6. Queue distribution (compact bar, NEW from Trends)
7. Activity calendar heatmap (NEW from Trends)
8. Stats bar — extended with a "Champs" cell

Net: Profile loses 4 tiles (heatmap, tilt, game length, pool entropy), gains 2 (queue bar, activity calendar). Becomes more glanceable. Outcome confirmed in design discussion 2026-05-09.

**Trends (post-rework):**

1. Headline briefing (current Weekly Review, larger)
2. Win-rate trajectory chart (NEW)
3. Time-of-day heatmap (moved from Profile, with insight overlay)
4. Tilt card (moved, with prescription)
5. Game-length card (moved, with prescription)
6. KDA trend chart (existing, with trend-line overlay + verdict)
7. LP economy card (NEW)
8. Day-of-week WR breakdown (NEW)
9. Champion focus + pool (NEW, merged from pool entropy + champion focus prescription)
10. Worst matchup callouts (NEW, ranked-only)
11. Session-fatigue curve (NEW)
12. *(Phase T4)* damage role consistency, vision investment, lane phase prognosis, first-blood gold conversion, death timing — these depend on match-depth Phase A/B.

---

## Selector change

**Today.** The shared `MatchCountSelector` (10/20/50/100/all) lives on Trends today via the `MatchWindowContext`.

**Proposal.** Trends gets its own time-window selector with a *built-in comparison*. Profile and Matches keep `MatchCountSelector`.

**Trends selector options:**

- `Last 7 days vs prior 7 days`
- `Last 30 days vs prior 30 days` (default)
- `Last 100 games vs prior 100 games` (power-user fallback for low-volume players)

**Why:**

- Trends is *about* directional change. The selector should encode the comparison frame — "now" vs. "before" — so trajectory tiles have a delta chip for free.
- Time-based frames map to how players actually think about improvement ("how was last week").
- Decouples Trends data needs from Matches/Champions, which is a small architectural win — Trends needs ~2× the matches in cache (to populate the prior-window comparison), which would otherwise inflate the shared selector's defaults.

**Architecture.** The trends route fetches its own slice independent of `MatchWindowContext`. Helper hook `useTrendsWindows(rangeId)` returns `{ current, previous }` arrays. Each insight component takes a `(current, previous)` tuple, computes its own conclusion + delta chip.

**Edge case.** `Last 7 days vs prior 7 days` for a casual player might mean "8 games vs 6 games." Sample-size badges (Phase T2) handle this — the conclusion still surfaces but tagged "directional only."

**Future.** ~~`This patch vs last patch` is an interesting future range, conditional on having a patch-cadence dataset wired up. Park as an idea.~~ Shipped 2026-05-10 — `gameVersion` lives on `MatchSummary`, `splitWindows` groups by truncated `MAJOR.MINOR` and returns the most-recent / second-most-recent patch buckets when the selector is set to `"patch"`.

---

## Visual design principles

This is the visual showoff project. The Trends page becomes a *briefing*. Each conclusion gets a card with this anatomy:

```
┌─────────────────────────────────────────┐
│ Tile name              ◐ 23 games · 30d │  ← title + sample-size badge
│ ─────────────────────────────────────── │
│  Your win rate drops 18 points          │  ← VERDICT (one line, large)
│  after a loss.                          │
│                                          │
│  [supporting micro-chart]               │  ← evidence
│                                          │
│  Consider stepping away after a loss.    │  ← prescription (optional)
└─────────────────────────────────────────┘
```

**Anatomy:**

- **Title** + sample-size badge (top-right, subtle). Badge format: `◐ 23 games · 30d` for "23 games over 30 days." Confidence visualized via a partial circle: empty = small sample, filled = large sample.
- **Verdict** is the one-line headline, large type, the thing you read first.
- **Evidence** is the smallest possible chart that supports the claim — split bar, sparkline, two-bar comparison, etc. Not a full Recharts tile; *micro*-chart.
- **Prescription** is optional one-line copy. Calm phrasing, no scolding.

**Layout:** magazine-style irregular grid, not a uniform 3-col. The headline briefing card spans full width at top. Below, cards flow at 1, 2, or 3 column widths based on content density. Use CSS grid `auto-fit` plus per-card explicit `grid-column` spans.

**Layout primitive constraint (locked early to avoid rebuild):** the grid container and each `ConclusionCard` must wrap in `m.div` with the `layout` prop set, so when the user switches the range selector and cards re-derive their verdicts + sample sizes, the grid physically reflows with springs (cards may swap positions, change column-span, etc.). This is the **flagship motion moment for the trends page** and is documented in [vnext-ideas.md](vnext-ideas.md). Pin the layout system to `LazyMotion domMax` + Motion `layout` from day one of T2 — switching layout primitives later is expensive.

**Motion direction (Phase T2 + T3):**

- Cards reveal-on-scroll with stagger (existing pattern in trends.tsx — keep).
- Each conclusion's supporting chart gets its own micro-animation:
  - **LP economy:** two stacked counters tick up, then a delta chip pops in.
  - **Tilt:** split bar fills from center outward, verdict text fades in after.
  - **Win-rate trajectory:** sparkline draws left-to-right, delta chip emphasizes after.
  - **Day-of-week WR:** bars rise from baseline; weakest day gets one subtle pulse cycle.
  - **Session fatigue:** line draws, the dropoff point gets one dot pulse.
  - **Worst matchup row:** opponent champion icon slides in from the row's leading edge.
  - **Heatmap:** existing reveal stays. Insight chips overlay cells with a delayed fade.
  - **Range-change reflow:** triggered by the range selector. Each card animates verdict + chart updates *and* the grid `layout` prop springs cards into new positions (size, column, row) based on the new sample sizes / verdicts. The most visible cross-card motion in the app.
- Hover state: chart becomes interactive (tooltip), verdict text gets a subtle highlight (1px text-shadow or `text-foreground/100` from `text-foreground/85`).
- Reduced motion: instant render, no stagger, no draws. Verdicts always render.

**Aesthetic guard:** no slot-machine number rolls, no confetti, no celebratory color floods, no "well done!" copy (cf. `feedback_calm_aesthetic`). The verdicts are observations.

---

## Phase T1 — Cleanup pass (structural reorg, no new content)

**Goal:** Land the move. Profile gets the snapshot tiles; Trends gets the conclusion tiles. No new components, no new insights yet.

### Deliverables

1. Move queue distribution to Profile. Refactor [trend-queue.tsx](../../apps/web/src/lol/trends/trend-queue.tsx) into a `ProfileQueueDistribution` (or rename and extract) with a compact horizontal-bar layout. The current donut is too large for Profile flow.
2. Move activity calendar to Profile. Component lift from [trend-activity.tsx](../../apps/web/src/lol/trends/trend-activity.tsx) to `apps/web/src/lol/profile/profile-activity-calendar.tsx`.
3. Move heatmap, tilt, game length, pool entropy to Trends. Files relocate from `apps/web/src/lol/profile/` to `apps/web/src/lol/trends/`. Imports follow.
4. Move Weekly Review to Trends as the headline card.
5. Delete `TrendSummaryCards`, `MatchRecord` rendering on trends, and the trends-header `TrendStreak`.
6. Add a "Champs" cell to ProfileStatsBar (`unique champion count over current window`).
7. Swap selector on Trends: replace `MatchCountSelector` with new `TrendsRangeSelector` (component TBD in Phase T1 — start as a 3-option segmented control, range IDs only; the actual two-window data plumbing happens in Phase T2).
8. New hook `useTrendsWindows(rangeId)` stub that returns `{ current, previous }` — in T1 it can return `{ current: matches, previous: [] }` so the page renders without breaking, full implementation in T2.

### Files touched

- [apps/web/src/routes/lol/$accountSlug/trends.tsx](../../apps/web/src/routes/lol/$accountSlug/trends.tsx) — page composition.
- [apps/web/src/routes/lol/$accountSlug/index.tsx](../../apps/web/src/routes/lol/$accountSlug/index.tsx) — page composition.
- [apps/web/src/lol/profile/profile-stats-bar.tsx](../../apps/web/src/lol/profile/profile-stats-bar.tsx) — add Champs cell.
- New: `apps/web/src/lol/profile/profile-queue-distribution.tsx`, `profile-activity-calendar.tsx`.
- New: `apps/web/src/lol/trends/trends-range-selector.tsx`, `use-trends-windows.ts`.
- File moves (`profile/profile-time-heatmap.tsx` → `trends/trend-time-heatmap.tsx`, etc.).

### Risks

- Heatmap/tilt/game-length currently consume `useMatchWindow`. After the move, they need to consume `useTrendsWindows().current`. Make sure prop-drilling stays out of it — single hook, single source.
- Scroll-restoration on Profile: removing 4 tiles changes the page height and can interact with the existing scroll-restoration logic. Smoke-test on tab nav.
- Visual regression on Profile — page becomes shorter; the `m.div` reveal-on-scroll might overshoot. Audit the stagger after the move.

---

## Phase T2 — Standardize the conclusion-card pattern + reframe existing tiles

**Goal:** Every Trends tile uses the briefing-card anatomy. No new insights yet — just retrofitting existing tiles (heatmap, tilt, game length, pool entropy, KDA chart).

### Deliverables

1. **`ConclusionCard` primitive.** New component at `apps/web/src/lol/trends/_shared/conclusion-card.tsx`. Slots: `title`, `sampleSize`, `verdict` (also `verdictMarkdown` for export), `evidence`, `prescription?` (also `prescriptionMarkdown?`). Encapsulates the visual anatomy from "Visual design principles." The markdown variants exist so the **weekly digest as markdown export** (vNext top tier, see [vnext-ideas.md](vnext-ideas.md)) can consume the same `summarize(stats): {...}` output that the cards consume — no parallel parser, no copy drift.
2. **`SampleSizeBadge` primitive.** New component, partial-circle visualization. Empty / partial / full based on game count thresholds (<10 = empty, 10–30 = half, 30+ = full). One short label inside. **The badge primitive must land in T2 so all retrofitted tiles use it consistently.** The animated draw-on-mount fill is a T3-tier polish item — primitive ships static in T2, gains the fill animation in T3.
3. **Two-window comparison plumbing.** Real implementation of `useTrendsWindows(rangeId)` returning `{ current, previous }` slices. Trends route now fetches enough match history to populate previous-window for the longest range (need ~2× max-range games — re-evaluate cache TTL on `MatchWindowContext` since trends' needs differ from Matches').
4. **Retrofit existing tiles to ConclusionCard.**
   - **Tilt:** verdict = "Your win rate drops X points after a loss"; evidence = split bar; prescription = "Step away after a loss" (only when delta ≥ 8 pts).
   - **Game length:** verdict = "You're strongest in [bucket] games"; evidence = three-bar comparison; prescription = "Consider voting surrender earlier in long losing games" (only when long-game WR is meaningfully worse).
   - **Time heatmap:** verdict = "Your strongest hour is [day] [hour] — X% WR"; evidence = the heatmap with strongest cell highlighted; prescription = "Schedule ranked sessions there."
   - **Pool entropy:** interim retrofit only — verdict = "You play [n] champs per month — [wide/focused] pool"; evidence = horizontal champion-frequency strip (top 5 champs as bars); prescription = "Consider focusing on 3 to climb faster" (when n ≥ 10). **Subsumed by the merged Champion-focus tile in Phase T3** — delete this standalone tile when T3.4 ships.
   - **KDA chart:** verdict = "KDA [up/down] X.XX vs prior window"; evidence = the existing line chart with a trend-line overlay; prescription = none (KDA is an indicator, not directly actionable).
5. **Magazine-grid layout with `layout`-prop reflow.** CSS grid with explicit per-card spans. Headline (Weekly Review) full-width, KDA chart 2/3 width, tilt + game-length side-by-side at 1/3, etc. Each card wraps in `m.div layout`; the grid container uses `LazyMotion domMax`. When the range selector changes and verdicts/sample sizes re-derive, cards spring into new positions/widths. Validate at desktop and mobile. **Pinned in T2 — switching layout primitives later is expensive.**
6. **Reduced-motion pass** on the new card primitive.

### Risks

- `useTrendsWindows` may need ~2× the match cache. Bump cache TTL or fetch range. Watch the regional rate limiter — the matches are already in DB so no Riot calls, just a wider Prisma query.
- Verdict copy is hard. Each tile's verdict should be parameterized — the *function* writes the sentence based on the data. Don't hardcode prose. Pattern: a small `summarize(stats): { verdict, prescription? }` per tile.
- Sample-size badge thresholds need tuning. Start with <10 / 10–30 / 30+ and revisit after dogfooding.

---

## Phase T3 — New insight tiles (no match-depth dependencies)

**Goal:** Six new conclusion tiles. All derivable from the current `MatchSummary` shape. No DTO extension needed.

Each tile follows the `ConclusionCard` pattern from T2.

### Deliverables

1. **Win-rate trajectory.**
   - Verdict: "WR up X pts vs prior [range]" / "WR down Y pts — what changed?"
   - Evidence: small sparkline of WR per N-game rolling window over current range, with previous-range mean as a horizontal reference line.
   - Prescription: when down ≥ 8 pts, "Take a break or change up your champion pool."
   - Sample-size gating: needs ≥ 20 games in current range.

2. **LP economy.**
   - Verdict: "+22 / −18 LP — wins are bigger than losses, you're climbing efficiently" or "+18 / −24 LP — losses cost more than wins earn, MMR misaligned."
   - Evidence: two stacked bars (avg LP gain on win, avg LP loss on loss).
   - Prescription: only when net is negative on long-term, "Your MMR is below your rank — expect harder games."
   - Source: existing `lpDelta` per match (already computed via [use-lp-delta.ts](../../apps/web/src/lol/matches/use-lp-delta.ts)).

3. **Day-of-week WR breakdown.**
   - Verdict: "[Day] is your weakest day — X% WR over Y games."
   - Evidence: 7 horizontal bars, one per weekday, weakest highlighted.
   - Prescription: "Consider lighter ranked load on [day]" — only when delta to best day ≥ 12 pts.
   - Sample-size gating: ≥ 3 games per day.

4. **Champion focus + pool** (merged from former "Champion focus prescription" + "Pool entropy" — see decision log).
   - Verdict: top line is the entropy reading — "[n] unique champs in [range] — [wide/focused] pool." Sub-line names top 3: "Top 3: [A], [B], [C] ([n] of [N] games)."
   - Evidence: horizontal champ-frequency bars, top 6 named, "+ X others" tail. The bars double as the entropy visualization (long tail = wide pool, short tail = focused).
   - Prescription: when top-3 share is < 50% AND n ≥ 10, "Wide pool — consider focusing on 3 to climb faster." When top-3 share is ≥ 70%, no prescription (focused pool is fine — the verdict alone is the affirmation).
   - Replaces the standalone pool-entropy tile from T2.4 — delete that retrofit when this lands.

5. **Worst matchup callouts.**
   - Verdict: "0–4 on [your champ] into [opponent champ] — consider banning [opponent]."
   - Evidence: row strip with both champion icons and W-L tally.
   - Prescription: "Ban [opponent]" — only when WR ≤ 25% and sample ≥ 3.
   - Source: `Match.opponents` already populated.
   - Show top 3 worst matchups; sample-size gated.

6. **Session-fatigue curve.**
   - Verdict: "After your 3rd game in a row, WR drops to X%."
   - Evidence: line chart of WR by game-number-in-session (game 1, 2, 3, 4+). Sessions defined as matches with <30 min gap.
   - Prescription: "Three-game cap?" — only when game-4+ WR is ≥ 10 pts below game-1.
   - Sample-size gating: ≥ 5 sessions of length ≥ 4.

7. **Role performance.**
   - Verdict: "Your strongest role is [TOP/JGL/MID/BOT/SUP icon] [role] — X% WR over N games."
   - Evidence: five horizontal bars, one per standard role. Each bar: CDragon role SVG icon + label on the left, WR bar + percentage on the right, game count in muted text below the label. Sorted by games played descending so the main role anchors the top. Roles with < 3 games show a grayed-out bar with "too few games" instead of a WR figure.
   - Prescription: when best/worst WR divergence ≥ 15 pts and both have ≥ 5 games — "Consider climbing on [best role]." Suppress when the player plays only one role (verdict alone is sufficient).
   - Queue scoping: `teamPosition` is `""` for ARAM and Arena — filter those games silently. If > 70% of games in the range have no position data (heavy ARAM player), show a muted "Ranked & normals only" chip in place of the verdict rather than misleading confidence.
   - Sample-size badge: references total non-ARAM games in the window. Per-role game counts gate individual bars independently.
   - Prerequisite: `teamPosition` added to `MatchSummary` — see schema note below.

**Schema prerequisite for T3.7 (also unblocks T3.5):**

`teamPosition` is already typed in `RiotMatchParticipant` and projected to `ParticipantDetail`. It is not on `MatchSummary` or the `Match` Prisma model. Three-file change, all small:

- `packages/shared/src/lol/match.ts` — add `teamPosition: string` to `MatchSummary`.
- `apps/api/prisma/schema.prisma` — add `teamPosition String @default("")` to `Match` model.
- `apps/api/src/lol/match-mapper.ts` — add `teamPosition: participant.teamPosition` to the `riotMatchToSummary` return. The field is already read in that function (line 12) to find the lane opponent — it's a one-liner to expose it.

Existing rows get `""` via Prisma migration `DEFAULT ''`. Stats filter empty-position rows the same way ARAM is already excluded from lane-opponent stats. Optional backfill: each `MatchDetailCache.detail` JSON already has `participants[].teamPosition`; a one-off script can join on `matchId + puuid` and patch existing rows without Riot calls. Pre-prod, so skip if new matches fill the data fast enough.

Note: T3.5 (worst matchup) and T3.7 (role performance) both depend on `MatchSummary` having position data — batch the schema change to unblock both at once.

### Implementation order within the phase

- 2 (LP economy) and 3 (day-of-week WR) — simplest, ship first. Both use data already in `MatchSummary`.
- 1 (Win-rate trajectory) — moderate; needs the two-window plumbing from T2.
- 4 (Champion focus + pool, merged) — moderate; subsumes the T2 pool-entropy retrofit.
- 6 (Session fatigue) — interesting; needs session-clustering logic. Calm motion showcase opportunity (the line draws, then the dropoff point pulses once).
- 5 (Worst matchup) — interesting; depends on lane-opponent strength of the existing dataset (only populated for ranked). Document the queue-filter behavior carefully.
- 7 (Role performance) — straightforward once `teamPosition` lands on `MatchSummary`; blocked only by that schema addition, independent of all other tiles. Ships alongside the Profile role strip (see [views-roadmap.md](views-roadmap.md) Phase 6).

---

## Phase T4 — Match-depth-dependent insights (later)

**Goal:** Insight tiles that require the extended DTO from [match-depth-roadmap.md](match-depth-roadmap.md) Phase A or Phase B. Listed here so the dependency graph is clear.

### Phase A dependencies (extended `ParticipantDetail`)

1. **Damage role consistency.**
   - Verdict: "On [carry champ], you average X% damage share — Y% behind your role's expected."
   - Evidence: bar showing your share vs. role expected (static role baseline data).
   - Prescription: "Work on positioning to deal more damage."

2. **Vision investment.**
   - Verdict: "Vision score in the bottom 30% of your role's average — Y games checked."
   - Evidence: small percentile bar.
   - Prescription: "Buy more wards on each back."

3. **First-blood gold conversion.**
   - Verdict: "5/15 first bloods this window, but only 20% conversion to wins."
   - Evidence: two-bar comparison (FB count vs FB→win rate).
   - Prescription: "You're greedy after first blood — back off after the kill."

### Phase B dependencies (timeline)

4. **Lane phase prognosis.**
   - Verdict: "−24 CS at 10 min on average — early lane needs work."
   - Evidence: distribution chart of CS@10 deltas.
   - Prescription: "Practice last-hitting in tool mode."

5. **Death timing analysis.**
   - Verdict: "Deaths cluster at minutes 12–15 — transition phase risk."
   - Evidence: histogram of death timestamps.
   - Prescription: "Be cautious during transition — prefer farm over fight."

6. **Comeback resilience.**
   - Verdict: "Down 5k gold at 15min, you win 12% of the time — average is ~30%."
   - Evidence: behind-early WR bar with population reference line.
   - Prescription: "Practice playing from behind — focus on safety, scaling, single picks."

---

## Cross-cutting concerns

**Account for empty states.** Every conclusion tile needs an empty/insufficient-sample state. The pattern: render the card with a muted "Not enough games yet — play X more for this insight" instead of the verdict. This is preferable to hiding the tile, because it teaches the user what's coming.

**Performance budget.** Trends becomes the most chart-dense page in the app. Watch:

- The `ConclusionCard` primitive must not import Recharts at module scope. Charts should be tree-shakable per-tile.
- Sparkline-grade visualizations should use raw SVG rather than Recharts. Reserve Recharts for the larger charts (heatmap is already custom; KDA + LP economy already use Recharts; session-fatigue could be raw SVG).
- Lazy-mount tiles below the fold (`IntersectionObserver`). Already viable since each tile is independent.
- Bundle budget: the trends route's chunk should not exceed 60 KB gzipped post-T3. Measure and document in the README.

**Caching.** `useTrendsWindows` keys on rangeId; queries TanStack Query for matches in `[rangeStart, now]`. The previous-window slice is just a different filter on the same data — single fetch, two filtered slices in memo.

**Mobile.** The magazine-grid layout falls back to single-column on narrow widths. Each `ConclusionCard` is full-width on mobile. Verdicts stay legible; sample-size badge moves below the title.

**Reduced motion.** Already a known pattern (gating on `useReducedMotion`). New requirement: even with reduced motion, sample-size badges still convey their info via the static partial-circle SVG, not animation.

**Profile gets shorter.** Net effect of the move: Profile loses 4 conclusion tiles, gains 2 snapshot tiles. The page becomes more glanceable — that's the intended outcome. Confirm visual hierarchy after T1 lands.

**Patch awareness.** ~~Trends ranges are time-based, but LoL patches reset the meta. A future-Phase nice-to-have: shade the chart background where a patch boundary falls inside the current range, with a tooltip naming the patch. Park as Phase T5 / future polish.~~ Shipped 2026-05-10 — Recharts `ReferenceLine`s at each patch boundary on KDA trend (game-index x-axis) and LP history (timestamp x-axis), labeled with the new patch number. Boundaries derived from match data itself via `findPatchBoundaries` (no Riot calendar needed).

---

## Open questions / decisions to make before we start

_None outstanding — all four questions resolved (see decision log)._

---

## What to write up afterward

Each of these is a candidate for a long-form case study (one of the README's first-class deliverables):

- **"From dashboard to briefing — designing trends as conclusions"** — the whole rework. Genuinely underexplored framing in the LoL companion-app space; the design narrative ("we noticed our profile page had become an insights page by accident") is a clean angle.
- **"Sample-size as first-class UI"** — the sample-size badge and the way it gates verdicts. Calibrating user trust without hiding small-sample insights entirely is a more general problem than just League stats.
- **"Time-windowed comparisons without a time-series database"** — tying back to the case-study idea from views-roadmap. The trends rework's two-window approach is the practical exercise of that abstract write-up.

---

## Status

- **Phase T1** (cleanup pass) — **shipped 2026-05-09.**
- **Phase T2** (conclusion-card pattern + retrofit) — **shipped 2026-05-09.**
- **Phase T3** ✅ SHIPPED in full — all seven tiles live: LP economy (T3.2), day-of-week WR (T3.3), win-rate trajectory (T3.1), champion focus + pool (T3.4), session fatigue (T3.6) shipped 2026-05-09; worst matchup (T3.5) and role performance (T3.7) shipped 2026-05-10 as part of the Phase 6 cluster. T3.5 reuses `laneOpponent` from match-depth Phase A. T3.7 ships alongside Profile role strip (Phase 6 in views-roadmap) and shares the `RoleIcon` component (CDragon position SVGs with hand-rolled fallback).
- **Phase T4** (match-depth-dependent tiles) — Phase A trio shipped 2026-05-10: damage role consistency, vision investment, first-blood gold conversion. Schema prereq (visionScore, damageShare, firstBloodKill on MatchSummary + Match table) landed in the same cluster, with a backfill script for existing rows. Static role baselines (typical solo-queue damage share + vision score per role) live at `lol/_shared/role-baselines.ts`. Phase B trio (lane phase prognosis, death timing, comeback resilience) still pending — needs a data-architecture decision since the timeline projection is lazy-fetched on match-detail visit, not stored on `MatchSummary`.

---

## Decision log (update as we go)

- **2026-05-09** — rework drafted. Premise: Trends today is raw data; Profile has the actual conclusions; both are misfiled. Reframe Trends as conclusions/briefing.
- **2026-05-09** — selector change locked. Trends gets its own time-window selector with built-in two-window comparison (`Last 30d vs prior 30d` default). Profile and Matches keep `MatchCountSelector`.
- **2026-05-09** — Profile net-shrinks (loses 4 conclusion tiles, gains 2 snapshot tiles). Confirmed as intended outcome.
- **2026-05-09** — visual ambition is co-equal with analytical power. The `ConclusionCard` primitive is the visual flagship of the page. No celebratory motion (cf. calm-aesthetic memory) but each tile gets its own micro-animation tied to the data it presents.
- **2026-05-09** — separate doc rather than a Phase 6 in views-roadmap.md, given the scope. Cross-references both views-roadmap and match-depth-roadmap.
- **2026-05-09** — default range locked: `Last 30 days vs prior 30 days`.
- **2026-05-09** — sample-size badge thresholds confirmed: <10 = empty (directional only), 10–30 = half, 30+ = full (confident). Tunable after dogfooding.
- **2026-05-09** — Champion focus + pool entropy merged into a single tile. Pool entropy moves to Trends in T1, gets a standalone retrofit in T2 as an interim, then subsumed by the merged Champion-focus tile in T3.4 (delete the standalone when T3.4 ships).
- **2026-05-09** — Worst-matchup tile hardcoded to ranked queues (lane positions are absent in ARAM/Arena). Renders a small "ranked only" badge on the card. No queue toggle.
- **2026-05-09** — `summarize(stats)` per-tile pattern extended to also produce `{ verdictMarkdown, prescriptionMarkdown? }`. Lets the **weekly digest as markdown export** (vNext top tier) consume the same source as the UI — no parallel parser. Decision sourced from [vnext-ideas.md](vnext-ideas.md).
- **2026-05-09** — Magazine grid pinned to `LazyMotion domMax` + `m.div layout` from day one of T2. Range-change reflow is the flagship motion moment for the rework — switching layout primitives later would be expensive. Decision sourced from [vnext-ideas.md](vnext-ideas.md).
- **2026-05-09** — `SampleSizeBadge` primitive lands in T2 (static); fill-on-mount animation lifted to T3 polish so all T2 retrofits use the badge consistently.
- **2026-05-09** — T3 shipped (five tiles). All grid tiles now always render a `ConclusionCard` — no null returns that leave empty grid cells; insufficient-data paths show a muted empty-state verdict instead. `SampleSizeBadge` tooltip migrated from native `title=` to Radix `TooltipPrimitive`. Percentage-point deltas use `%` not `pp` in all verdict strings.
- **2026-05-09** — T3.5 (worst matchup callouts) deferred: `MatchSummary` has no opponent data. `laneOpponent` is added to `MatchSummary` in match-depth Phase A — T3.5 unblocks the moment that ships.
- **2026-05-10** — T3.7 (role performance ConclusionCard) added. `teamPosition` is already in `RiotMatchParticipant` and `ParticipantDetail` but missing from `MatchSummary` / `Match` table. Three-file fix (shared type + schema + mapper) also unblocks T3.5 since both need `teamPosition`-adjacent data on the summary level — batch those migrations. Role strip companion lands on Profile simultaneously (views-roadmap.md Phase 6).
- **2026-05-10** — T3.5 + T3.7 shipped as a coordinated cluster with views-roadmap Phase 6 (commits `7a5eb2f` schema → `3e13a65` trends tiles → `f410fff` profile strip). T3.5 (`TrendWorstMatchup`) aggregates `(yourChamp, opponentChamp)` pairs from `laneOpponent`, gates at sample ≥ 3, sorts ascending by WR, and adds the prescription "Consider banning {opp}" only when worst WR ≤ 25%. T3.7 (`TrendRolePerformance`) renders five role bars sorted by games desc, suppresses bars under 3 games, and adds the "Consider climbing on {role}" prescription only when the best/worst delta is ≥ 15 pts and both have ≥ 5 games. Heavy-ARAM windows (>70% positionless) replace the verdict with a muted "Rift role data is too sparse to read" note. Role icons from CDragon `plugins/rcp-fe-lol-static-assets/global/default/svg/position-{top,jungle,middle,bottom,utility}.svg` with hand-rolled fallback.
- **2026-05-10** — Magazine-grid reflow shipped as the flagship motion moment for the rework (commit `574aa7e`). Tiles are now declared as a single data array in `trends.tsx` with `designPriority` per tile and an `active` boolean computed from each tile's data window (e.g. `worst-matchup` is active when `playedWithOpponent.length ≥ 3`). Inactive tiles get a 1000-point penalty so they sink to the bottom band, preserving designed order within each band. `m.div layout` on `Cell` (already pinned in T2) provides the spring reflow. `ConclusionCard` verdict swaps now cross-fade via `AnimatePresence mode="popLayout"` keyed on the verdict string. `SampleSizeBadge` migrated to Motion `pathLength` so the partial circle animates from 0 → final fill on first paint and re-draws when the count crosses a threshold (the fill animation lifted from T3 polish into T2's primitive at this point).
- **2026-05-10** — Phase T4 Phase-A trio shipped (damage role consistency, vision investment, first-blood gold conversion). Schema slice added `visionScore`, `damageShare`, `firstBloodKill` to `MatchSummary` and the `Match` Prisma model. `damageShare` is computed against the user's team total in `riotMatchToSummary` (sum of own-team participants' totalDamageDealtToChampions). `firstBloodKill` was missing from the local `RiotMatchParticipant` type, added. Backfill script (`prisma/backfill-t4-phase-a.ts`) populated 3419 existing rows from `MatchDetailCache.detail`. Static per-role baselines (`lol/_shared/role-baselines.ts`) — TOP 22% / JUNGLE 19% / MID 28% / BOT 30% / SUP 8% damage share, SUP 70 / others 22-30 vision score. Tiles gate at MIN_SAMPLE=5, aggregate over the user's primary role (most-played `teamPosition`). Prescriptions only fire on negative deltas (≥ 5pp below baseline for damage, ratio < 0.7 for vision, ≥ 8pp below overall WR for first-blood conversion). Phase B trio still pending — timeline data is lazy-fetched on match-detail visit and not on `MatchSummary`, will need a separate data architecture decision.
- **2026-05-10** — Trends queue scope migrated from "respects global queue filter" to "driven by the serious-queues preference" (commits `a59b2a4` / `f501322`). Trends is an analysis surface — `useTrendsWindows` now reads from `useSeriousQueues()` and filters its 200-match fetch to the user's serious-queues set before splitting into `current` / `previous`. The global queue selector that used to live in the account header was replaced by a `<SeriousQueuesSettings />` popover (localStorage-persisted, default Ranked Solo + Ranked Flex). Per-view queue toggles on Trends were considered but skipped — the global serious-queues preference is enough; if comparing ranked solo vs ranked flex specifically becomes a real ask, that's a future per-view toggle.
