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

## Phase 5 — Past seasons (self-collected, no Riot history available)

**Constraint discovered:** Riot does **not** expose season-end historical ranks via their public API. League-V4 only returns current standing; the `endOfGameStats` reference earlier in this doc was imprecise (that's an LCU local-client API, not server-accessible). The old `stats/v1` API was deprecated in 2018 and never replaced. Match-V5 has `gameVersion` but no rank-at-season-end field. **Anything before Phase 0 started accumulating snapshots is unrecoverable.**

This reframes Phase 5 from "pull Riot history" to "surface the longitudinal data we've been self-collecting" — which ties directly into the "building LP history without a time-series DB" write-up.

**Goal:** Vertical timeline of self-detected season/split boundaries per queue, with end-of-season rank snapshots. Read-only. Honest about the cold-start period.

**Deliverables:**

1. **Season detection** — pure function over the existing `RankHistoryPoint[]` that finds soft-reset boundaries. Heuristic: a normalized-LP drop ≥ 400 between consecutive snapshots in the same queue **and** a time gap ≥ 7 days. Thresholds tuned to ignore normal demotions (≤100 LP) and play-streak losses (small time gap), while catching split resets where players drop ~5 divisions after weeks of inactivity. Lives in `@vyoh/shared/lol/rank-history`.
2. **Frontend timeline** — `ProfileSeasonHistory` component on Profile. Each closed season shows: date range, end rank, peak rank within the period. The current ongoing season sits at the top. Reuses the same `useRankHistory(account, "season")` query (already fetched for the LP chart, so no new request).
3. **Empty state** — when no resets have been detected yet, explicitly say so: "vyoh started tracking on YYYY-MM-DD. Past seasons appear here once Riot resets ranks (typically every ~3 months)." This is portfolio signal in itself — the "we know what we don't know" framing.
4. **No new backend endpoint.** Detection is client-side from the existing `/rank/history` response. Keep the boundary at data, not compute.

**What we explicitly don't do:**

- Don't try to scrape op.gg / u.gg for historical rank data.
- Don't show Riot-named seasons (we don't have authoritative season metadata; just label by date range).
- Don't backfill snapshots that don't exist.

---

## Phase 6 — Profile role strip

**Goal:** Add a compact role distribution strip to the Profile identity section. Companion to the queue distribution bar — same "what you play" cluster. CDragon role icons give it immediate visual recognition.

**Deliverables:**

1. **Role distribution strip** (`apps/web/src/lol/profile/profile-role-strip.tsx`).
   - Five role slots: TOP / JGL / MID / BOT / SUP. CDragon role SVG icon per slot (same proxy pattern as champion icons), game count + percentage of non-ARAM games below each icon.
   - Slots sorted by games played descending so the main role anchors left.
   - ARAM and Arena games (empty `teamPosition`) excluded silently. If > 90% of the current window is ARAM, show a muted "Mostly ARAM — role data limited" note instead of the strip.
   - Optional secondary signal: small WR percentage per role in muted text. Keep it low-key — the Trends T3.7 role performance card is where WR gets the verdict treatment; here it's supporting colour.
   - Position in Profile layout: after Now Playing, before Queue distribution. Both are "what you play" identity signals — together they form a natural cluster.
   - Empty state when no non-ARAM games in the window: five grayed-out icon slots.

2. **Shared prerequisite: `teamPosition` on `MatchSummary`.**
   - `packages/shared/src/lol/match.ts` — add `teamPosition: string` to `MatchSummary`.
   - `apps/api/prisma/schema.prisma` — add `teamPosition String @default("")` to `Match` model.
   - `apps/api/src/lol/match-mapper.ts` — add `teamPosition: participant.teamPosition` to the `riotMatchToSummary` return. The field is already read on line 12 of that function to find the lane opponent — single-line addition to expose it.
   - Existing rows get `""` via Prisma migration `DEFAULT ''`. Stats filter empty-position rows the same way ARAM is excluded elsewhere. Optional backfill: `MatchDetailCache.detail` JSON already carries `participants[].teamPosition`; a one-off script can join on `matchId + puuid` and patch rows without Riot calls.
   - Same schema change also unblocks Trends T3.7 (role performance ConclusionCard) and contributes to T3.5 (worst matchup) data readiness — batch with those.

### Sequencing

1. Schema prerequisite first (independent, small, unblocks T3.5 and T3.7 too).
2. Profile role strip and Trends T3.7 can ship together or independently — no shared component code.

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
- **Phase 3** ✅ SHIPPED — Habits/insights layer live on Profile and Champion detail. `use-habits-stats.ts` drives all computation from the shared match cache. Components: `ProfileTimeHeatmap` (24×7 hour/day grid), `ProfileTiltIndicator`, `ProfileGameLength`, `ProfilePoolEntropy`, `ProfileWeeklyReview`. Champion detail reuses time heatmap + tilt indicator filtered to that champion via `useHabitsStats(champion)`.
- **Phase 4** ✅ SHIPPED (code) — LP history sparkline live on Profile with queue toggle (Solo/Flex), range toggle (30d/90d/Season), tier-change markers (gold ReferenceDots), and longest-run streak overlay (emerald/rose ReferenceArea, min 3 consecutive). New endpoint `GET /lol/summoners/:region/:gameName/:tagLine/rank/history` returns `{ solo, flex }` with each snapshot normalized to `totalLp` (Iron IV 0LP = 0, +400 LP per tier, ignoring division for Master+). LP normalization helper + types in `@vyoh/shared` (`rank-history.ts`). Component: `profile-lp-history.tsx`. Visual verification in browser still pending — no rank snapshots have accumulated yet, so the component is currently rendering its empty state path.
- **Phase 5** ✅ SHIPPED (code) — `detectSeasons` in `@vyoh/shared/lol/rank-history` finds soft-reset boundaries via normalized-LP drop ≥ 400 + time gap ≥ 7d. `ProfileSeasonHistory` renders ongoing + closed seasons per queue with start/end/peak rank. Cold-start messaging when no resets detected. Reuses the existing `useRankHistory(account, "season")` query — no new endpoint. 7 unit tests cover empty input, single ongoing season, normal demotion (no false positive), losing streaks (no false positive), single soft reset, peak-vs-end divergence, multi-season chains, Master+ tiers. Visual verification deferred until snapshots accumulate enough to trigger a detected reset.
- **Phase 6** ✅ SHIPPED — Profile role strip (`profile-role-strip.tsx`) renders five TOP/JG/MID/BOT/SUP slots between Now Playing and Queue distribution, sorted by games played desc with game count, % of non-ARAM games, and muted WR% per slot (≥3 games). "Mostly ARAM — role data limited" callout when >90% ARAM in window. Empty/no-games slots render dimmed. Schema prereq landed in `7a5eb2f` (`teamPosition` on `MatchSummary` / `Match` model + mapper). Strip + Trends T3.5/T3.7 shipped together: shared `RoleIcon` (`_shared/role-icon.tsx`) loads Riot's canonical position glyphs from `cdragon/.../rcp-fe-lol-static-assets/global/default/svg/position-{top,jungle,middle,bottom,utility}.svg`, with hand-rolled inline SVGs as `onError` fallback only.

---

## Decision log (update as we go)

- **2026-05-08** — roadmap drafted. Pending: confirm Phase 0 schema design; confirm Profile as index.
- **2026-05-08** — Phase 0 shipped. `RankSnapshot` lives alongside `Account` in the Prisma schema; one snapshot per ingest poll (deduplicated by tuple diff).
- **2026-05-08** — Phase 1 shipped. Profile is the index route (`/lol/$accountSlug`). Queue filter remains scoped to Matches tab.
- **2026-05-09** — Match list → detail card morph fixed and committed. Root causes: (1) page wrapper had `initial="enter"` (opacity 0) even on `duration: 0` detail transitions, hiding the FLIP start frame; (2) CSS transitions inside `useLayoutEffect` are unreliable — replaced with WAAPI `el.animate()`. Both directions (forward and backward) now work. `CardOrigin.direction` field prevents the list-card useLayoutEffect from consuming a forward-direction origin.
- **2026-05-09** — `layoutId` shared-element morph dropped for both match list → detail and champion card → detail. Replaced with rect-based WAAPI entrance animation (`3325f10`). Reason: `layoutId` interacts poorly with the virtualizer's transform-driven positioning — the layout snapshot lands before the virtualizer has committed its final positions, producing incorrect FLIP geometry. Rect-based WAAPI reads the real DOM rect at click time instead.
- **2026-05-09** — Phase 2 shipped. Champion detail page complete with all planned sections. Roadmap moved from Claude project dir to `docs/working-notes/views-roadmap.md` in the repo.
- **2026-05-09** — Phase 3 shipped. Heatmap confidence encoded via `backgroundColor` alpha (not CSS opacity) so the `heatmap-reveal` animation stays independent. Win-rate bands use solid emerald/zinc/rose tokens for visibility on dark backgrounds. `TrendStreak` wired into `ProfileRecentForm` header — reuses existing `computeStreak` + component already live on trends page. All computation client-side from shared match cache; no schema changes.
- **2026-05-09** — Phase 4 shipped. LP normalization (`normalizeLp`) collapses tier+rank+lp onto a single monotonic axis so promos/demotes render as continuous movement. Master+ ignores rank (Riot returns "I" for those tiers). Streak overlay uses `ReferenceArea`; tier-change markers use `ReferenceDot` with `ifOverflow="extendDomain"` so they always render even when at the y-domain edges. Queue toggle auto-falls-back to whichever queue has data. Empty state messaging distinguishes "no snapshots yet" from "load error". Browser smoke test deferred until real snapshots have accumulated.
- **2026-05-09** — LP delta per match + remake flagging shipped. `Match` table extended with `snapshotTier/Rank/Lp` (nullable) captured at head-sync time (after `captureRankSnapshot`, before `backfillMissingMatches`). Client computes delta via `normalizeLp` diff between consecutive matches per queue — no new endpoint. Historical backfill rows get null snapshots to avoid stamping stale LP. Remakes detected via `gameEndedInEarlySurrender && gameDuration < 210 s`; stored with `remake: true`, excluded from all stat computations (win rate, KDA, streak, habits, champion aggregation, recent-form pips), displayed as "Remake" on the card. The 210 s threshold distinguishes true remakes from Season 2 2026 inting-surrenders which happen after 3.5 min and do affect LP.
- **2026-05-09** — Phase 5 reframed and shipped. Riot does not expose historical season ranks — League-V4 is current-only, the `endOfGameStats` reference earlier in this doc was an LCU API not server-accessible, and `stats/v1` was deprecated 2018. So past-seasons is built on self-collected snapshots only: `detectSeasons` flags soft-reset boundaries client-side from the existing `/rank/history` response. Thresholds: 400 LP drop + 7d gap (catches split resets without false-positiving on demotions or play-streaks). Followed the existing `@vyoh/shared/lol/rank-history` subpath-export pattern; added `DetectedSeason` as a type re-export from the package root. Cold-start period is owned in the UI rather than hidden — the empty state explicitly says "tracking started YYYY-MM-DD; Riot doesn't expose pre-tracking history."
- **2026-05-09** — `@vyoh/shared` value re-exports break the API runtime. The package serves source `.ts` via `exports: "./src/index.ts"` (no compiled output). Existing `export type` re-exports work because they're erased before Node's resolver sees them. Adding any `export {}` value re-export forces Node to resolve a real `.js` file that doesn't exist (`ERR_MODULE_NOT_FOUND`). Fix: keep `index.ts` type-only; expose runtime helpers via subpath export (`@vyoh/shared/lol/rank-history`) which Vite (Bundler resolution) consumes natively, while moving normalization off the API entirely (raw snapshots out, web computes `totalLp`). Documents a real package-boundary trade-off worth a write-up.
- **2026-05-10** — Live game view shipped (outside the Profile/Champion roadmap phases). CDragon `rcp-be-lol-game-data` raw paths for summoner spell icons and perk/keystone images returned 404 — both the `data/spells/icons2d/` and `v1/perk-images/` subtrees appear unavailable. Switched to DDragon: spell icons at `cdn/{version}/img/spell/{SpellKey}.png` (version from `useDDragonVersion()`), keystones at versionless `cdn/img/perk-images/{CamelCasePath}`. Future work using raw CDragon for any icon category should verify the path works before shipping.
- **2026-05-10** — Phase 6 (Profile role strip) planned. `teamPosition` is already in `RiotMatchParticipant` and `ParticipantDetail` but absent from `MatchSummary` / `Match` table. Adding it is a three-file change (shared type + Prisma schema + mapper return). That single prerequisite also unblocks Trends T3.7 (role performance ConclusionCard) and contributes to T3.5 (worst matchup) — batch all three into one schema migration. Profile strip positions between Now Playing and queue distribution as a "what you play" identity cluster.
- **2026-05-10** — Phase 6 + Trends T3.5 + T3.7 shipped as a coordinated cluster. Schema commit `7a5eb2f` (`teamPosition` on `MatchSummary`/`Match` + Prisma migration `phase_6_match_team_position`), then `3e13a65` (`TrendWorstMatchup` + `TrendRolePerformance` + shared `RoleIcon`), then `f410fff` (`ProfileRoleStrip`). T3.5 was independent of the schema change (uses `laneOpponent` from match-depth Phase A) but landed in the same session for narrative coherence.
- **2026-05-10** — Queue-scope reframe (commits `a59b2a4` / `f501322` / `a57ae38`). Global queue selector dropped from the account header; replaced by a `<SeriousQueuesSettings />` popover that drives a localStorage-persisted "serious queues" preference (default Ranked Solo + Ranked Flex; Normal Draft + Flex toggleable). Performance views (Trends, Pre-game ritual, Recap headline/champion, Champions list + detail, Profile role strip) consume `useSeriousMatches()` and filter to the preference. Identity/cadence views (Recent form, Now playing, Queue distribution, Activity calendar, Stats bar, Duos, Recap rank arc) consume `useMatchWindow()` directly and show all queues. Matches list owns its own `<QueueFilter />` for browsing. Reframe driven by the Phase 1 global filter retrofitting onto Profile/Trends/Recap uncritically — queue distribution under filter became meaningless, recap silently filtered without a chip, duos ignored the filter entirely. Splitting the cut into "serious vs cadence" eliminates the incoherences structurally rather than patching each one.
- **2026-05-10** — Activity calendar fixes. (1) The widget was reading `useMatchWindow().matches` which caps at the user's count selector (default 20), so a 365-day calendar was only ever fed the 20 most recent matches. Switched to a self-fetching `useCachedMatchesWindow(account, ACTIVITY_FETCH_COUNT=2000)` so the data always covers the full year. (2) Added a `startDate` clamp: when the oldest available match is later than 365d ago (heavy-grinder Riot retention cap manifesting as ~3 months of history), the calendar shrinks to the data depth and shows a Radix tooltip caption explaining "Riot's match history endpoint caps how many matches it returns per player." Light players still see the full 365-day frame.
- **2026-05-10** — LP history boundary lines. `<ReferenceLine>` rendered at each patch boundary inferred from the user's match data itself (no Riot calendar needed; truncated `gameVersion` change between consecutive matches in time order = a boundary). Labels show the new patch number (e.g. "26.9"). `ifOverflow="hidden"` clips out-of-domain lines. Mirror change rode along on the KDA trend chart (Trends) and the win-rate sparkline (Champion detail). Schema prereq: `gameVersion` projected onto `MatchSummary` / `Match` table; backfill from `MatchDetailCache.detail` covered ~3000 existing rows with one SQL pass.
- **2026-05-10** — Role icons sourced from CDragon `plugins/rcp-fe-lol-static-assets/global/default/svg/position-{top,jungle,middle,bottom,utility}.svg` (200 OK on all five positions; verified against the broader CDragon-paths-are-unreliable note from the live-game commit). Initial implementation hand-rolled inline SVGs and was reverted at owner's request — preference is "exhaust CDN options first, hand-rolled SVG only as absolute fallback." Hand-rolled glyphs kept inline as `onError` fallback in `RoleIcon`. CDragon SVGs use hardcoded Riot gold (`#c8aa6e`) so dim/muted states use `opacity-*` classes rather than `text-foreground/*` (which only tints `currentColor`-driven SVG).
