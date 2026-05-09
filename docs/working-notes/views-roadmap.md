# vyoh.gg — Profile + Champion detail roadmap

Working plan for two new views and a cross-cutting habits/insights pass. Read this when working on any of: profile/landing view, champion detail view, LP history, performance insights, tilt detection, or rank/season history.

This is a living plan, not a contract. Phases are sequenced so each one ships value on its own — don't block phase N on phase N+1's full scope.

---

## Guiding principles

- **One landable phase per session.** Profile skeleton, champion detail skeleton, and each insights pass should each be a single weekend's worth.
- **Reuse first.** Match list → detail morph, champion grid sort animations, donut color palette, `CountUp`, `StatBar`, `SplashProvider` are all already polished. Lean on them.
- **Insights belong inside views, not in a separate "Insights" tab.** Layer signals onto Profile and Champion detail rather than building a new top-level tab.
- **Data collection vs render is a real distinction.** LP history needs longitudinal data the DB doesn't capture yet. Start writing that data on ingest *before* you need to render it.
- **Portfolio narrative.** Each phase should produce something concrete to point to in the README/case study: a deployed view, a perf measurement, or a write-up of a non-trivial choice (e.g., "how we built LP history without a time-series DB").

---

## Phase 0 — data foundation for longitudinal stats

**Goal:** Start capturing data today that we'll render in Phase 4+. Decoupled so it can ship independently and accumulate while other phases run.

**Deliverables:**

1. Extend the ingest path to capture per-queue rank/LP at the time of each match.
   - On match ingest in `apps/api/src/lol/lol.service.ts` (or wherever the SSE/poll loop lives), call Riot's `League-V4` endpoint for the summoner once per ingest cycle.
   - Persist `{ accountId, queueId, tier, rank, leaguePoints, capturedAt }` to a new `RankSnapshot` Prisma model.
   - Dedupe: only insert when the tuple differs from the latest snapshot for that account+queue.
2. Optional: backfill the most-recent rank on first account ingest so the chart isn't empty until 20 matches roll in.
3. No frontend changes in this phase. Just data accumulating quietly.

**Why now:** the moment this is in production, every future match enriches the dataset. The longer we wait, the longer LP charts look stubby on launch.

---

## Phase 1 — Profile view (becomes the landing page)

**Goal:** Make `/lol/$accountSlug` land on a Profile page instead of the match list. Match list moves to `/lol/$accountSlug/matches` (it may already live there as a tab).

**Deliverables:**

1. New route file at `apps/web/src/routes/lol/$accountSlug/index.tsx` (the index of the layout shell). Profile view component.
2. Add a "Profile" tab to the existing tab strip in `apps/web/src/routes/lol/$accountSlug.tsx`. Tab order suggestion: **Profile → Matches → Trends → Champions**. Profile becomes the default/index.
3. Profile page sections (top to bottom):
   - **Rank tiles** — per-queue card (Solo, Flex). Shows tier, division, LP, win rate this season. Hard-coded to those two queues for now; ARAM/Arena have no rank.
   - **Recent form** — 20 W/L pips strip, colored by queue (use `queueColor`). Hover reveals `champion · queue · KDA`. Click navigates to that match detail.
   - **Now playing** — 1–3 most-played champions over the last 7 days with W/L and KDA. Card variant of the champion grid card.
   - **Account stats bar** — total games, overall win rate, avg KDA, time played. `CountUp` driven.
4. Reuse the existing account header (already sticky thanks to recent commits).
5. Empty state when no rank data yet (e.g., new account, never ranked) — same `m.p` fade pattern as the matches/trends empty states.

**Implementation order within the phase:**

1. Wire the new index route + tab; ship it as an empty Profile placeholder.
2. Account stats bar (lowest data risk — already aggregated for trends).
3. Recent form pips (uses match list data already in cache).
4. Rank tiles (needs a fresh `League-V4` fetch endpoint on the API; introduces a new query).
5. Now-playing card.

---

## Phase 2 — Champion detail view

**Goal:** Click a champion in the grid → land on a per-champion detail page focused on **how this account performs on this champion**. Reuses the shared-element morph pattern from match list → detail.

**Deliverables:**

1. New route at `apps/web/src/routes/lol/$accountSlug/champions/$championKey.tsx`.
2. Click handler on the champion grid card → navigate to detail. Entrance animation reuses rect-based WAAPI approach (same pattern as match list → detail; `layoutId` shared-element was dropped in favour of this).
3. Detail page sections:
   - **Hero** — splash + champion name + your stats summary (W/L, KDA, win rate, sample size).
   - **Personal trend** — sparkline of win rate over the last 20–40 games on this champ. Recharts.
   - **Vs your average** — three deltas: KDA vs your overall, CS/min vs your overall, win rate vs your overall. Color-coded ↑ / ↓.
   - **Common items** — top 3 final builds with frequency + per-build win rate. Item icons via existing CDragon helpers.
   - **Matchups** — opponents you beat / lose to most often (only show with sample size ≥ 3 to avoid noise). Two short lists, sortable.
4. Empty state when sample size is too small (< 3 games on champion) — show personal stats only, hide trend/matchups/common items.
5. Sticky champion strip on scroll (reuses pattern from match detail header).
6. Queue filter preserved on champion extras.

**Reuse opportunities:**

- `champion-stats.ts` already aggregates the table. Extract the per-champion projection into a hook that the detail page also consumes.
- `StatBar` component for the matchups list and item win rates.
- `CountUp` for stats.
- `SplashProvider`/`useSplashChampion` already drives the backdrop — passing the championKey here just works.

---

## Phase 3 — Habits / insights layer

**Goal:** Surface judgments, not just data. Layer into Profile and Champion detail rather than building a new tab.

**Deliverables (each is independently shippable):**

1. **Time-of-day heatmap** on Profile — 24 × 7 grid showing win rate by hour-of-week. Uses the existing heatmap-cell CSS pattern from `trend-activity.tsx`. Cells color-graded by win rate, sized by game count.
2. **Tilt indicator** on Profile — short callout: "You win X% after a loss vs Y% after a win." Computed client-side from sequential match outcomes.
3. **Game-length vs outcome** on Profile — small box-plot or two-stat card: "You win 60% of games under 25 min, 38% over 35 min."
4. **Champion pool entropy** — single number with a one-line interpretation: "You played 14 different champions this month — versatile pool" or "...you stick to a tight pool of 3."
5. **Weekly review card** — automatically generated summary card at the top of Profile picking the 1–2 most actionable signals for the user this week. Keep the copy subtle — no "you suck" tone, no celebratory tone either. Calm phrasing.
6. **On Champion detail**: per-champion versions of tilt indicator and time-of-day heatmap.

**Implementation note:** all of these are derivable from the existing match list — no schema changes needed. Build a `use-habits-stats.ts` hook in `apps/web/src/lol/profile/` that consumes the shared match cache.

**Sequencing within the phase:**

1. Time-of-day heatmap (highest visual payoff).
2. Tilt indicator (shortest copy, highest insight density).
3. Weekly review card (assembles the others).
4. Champion-detail variants once Phase 2 is shipped.

---

## Phase 4 — LP history rendering (unblocks once Phase 0 has data)

**Goal:** Render the data Phase 0 has been capturing.

**Deliverables:**

1. **LP history sparkline** per queue on the Profile page — 30/90/season toggle. Recharts line chart.
2. **Rank-up moments** — visual markers where tier changed (promo, demote). Subtle dot + label.
3. **Streak overlay** — shaded region on the chart where the longest win/loss streak occurred.

**Files:**

- `apps/web/src/lol/profile/profile-lp-history.tsx`
- `packages/shared/src/lol/rank-history.ts` (types)
- `apps/api/src/lol/rank.service.ts` (read-side endpoint)

**Don't block on:** having a full season's worth of data. Even a week's worth makes the chart informative. The case study angle is more interesting if we can document "this is what 30 days of self-collected data looks like."

---

## Phase 5 — Past seasons (further out, exploratory)

**Goal:** Vertical timeline of historical season ranks per queue. Read-only.

**Deliverables:**

1. Backend: pull season-end snapshots from Riot's `endOfGameStats` or `League-V4` history.
2. Frontend: a vertical timeline component on Profile (collapsed by default, expand to view).

**Open questions:**

- How far back does Riot expose this? Some seasons are no longer queryable. Set expectations early.
- Does this belong on Profile, or behind a "Career" sub-route? Probably Profile-collapsed, expandable.

---

## Cross-cutting concerns

**Routing reshape.** Moving the landing page from Matches to Profile is a routing change with implications:

- The existing match list scroll-restoration logic (in `match-list.tsx`) is wired to the main scroll container; should still work because Matches becomes a sub-route, not a removed one.
- The directional tab transition (`pageSlideVariants` with `custom`) needs Profile in the tab order so the slide direction calculation includes it.
- The Cmd+K palette presumably points at the account root — verify it still lands on something sensible. Profile is fine.

**Caching.** Profile data (rank, recent form, weekly review) overlaps with Matches data. Use the same TanStack Query keys where possible so the cache is shared. Don't introduce a separate `useProfile` query that re-fetches data Matches already has.

**Reduced motion.** Every new view needs a reduced-motion pass. The existing patterns (gating `initial`/`animate` on `useReducedMotion`, suppressing CSS animations via `@media (prefers-reduced-motion: reduce)`) cover everything new here.

**Performance budget.** Profile becomes the landing page, so its TTI matters most. Targets:

- No new chunk over 30 KB gzipped without a justification.
- Profile route should render rank tiles + recent form pips before the LP chart hydrates (skeleton the chart).
- Lazy-load anything below the fold on Profile if it grows past one viewport.

---

## What to write up afterward

Each of these is a candidate for a long-form case study (one of the README's first-class deliverables):

- **"Building LP history without a time-series database"** — Phase 0 + Phase 4 combined. The interesting story is: how do you do longitudinal analytics with point-in-time API responses, on Postgres, without paying for InfluxDB?
- **"Shared element transitions in a virtualized list"** — already partially shipped; champion grid → champion detail is the second instance of the pattern, which makes it generalizable.
- **"From data to judgments"** — Phase 3. The product framing of "stats sites that show data vs. stats sites that interpret it" is genuinely interesting and underexplored in the LoL companion-app space.

---

## Status

- **Phase 0** ✅ SHIPPED — `RankSnapshot` model added; rank + summoner snapshots captured via League-V4 and Summoner-V4 on ingest (commit `aaabfbd`).
- **Phase 1** ✅ SHIPPED — Profile landing page live with rank tiles, recent form pips, now-playing, and stats bar (commit `4c32bf1`). Profile is the tab index. Command palette summoner entries navigate to Profile (commit `7e57a97`).
- **Phase 2** ✅ SHIPPED — Champion detail fully live: per-champ stats + win-rate trend sparkline (`2c7e221`), items with CDragon icons + tooltips (`ce01e50`, `806606d`), matchups with sort (`ce01e50`, `451cd27`), "vs your average" delta tiles, queue filter preserved on champion extras (`defc321`, `451cd27`), sticky champion strip on scroll (`f7f00c1`). Card entrance animation uses rect-based WAAPI approach rather than `layoutId` shared-element (see decision log).
- **Phase 3** — not started.
- **Phase 4** — not started (Phase 0 data accumulating since `aaabfbd`).
- **Phase 5** — not started.

---

## Decision log (update as we go)

- **2026-05-08** — roadmap drafted. Pending: confirm Phase 0 schema design; confirm Profile as index.
- **2026-05-08** — Phase 0 shipped. `RankSnapshot` lives alongside `Account` in the Prisma schema; one snapshot per ingest poll (deduplicated by tuple diff).
- **2026-05-08** — Phase 1 shipped. Profile is the index route (`/lol/$accountSlug`). Queue filter remains scoped to Matches tab.
- **2026-05-09** — Match list → detail card morph fixed and committed. Root causes: (1) page wrapper had `initial="enter"` (opacity 0) even on `duration: 0` detail transitions, hiding the FLIP start frame; (2) CSS transitions inside `useLayoutEffect` are unreliable — replaced with WAAPI `el.animate()`. Both directions (forward and backward) now work. `CardOrigin.direction` field prevents the list-card useLayoutEffect from consuming a forward-direction origin.
- **2026-05-09** — `layoutId` shared-element morph dropped for both match list → detail and champion card → detail. Replaced with rect-based WAAPI entrance animation (`3325f10`). Reason: `layoutId` interacts poorly with the virtualizer's transform-driven positioning — the layout snapshot lands before the virtualizer has committed its final positions, producing incorrect FLIP geometry. Rect-based WAAPI reads the real DOM rect at click time instead.
- **2026-05-09** — Phase 2 shipped. Champion detail page complete with all planned sections. Roadmap moved from Claude project dir to `docs/working-notes/views-roadmap.md` in the repo.
