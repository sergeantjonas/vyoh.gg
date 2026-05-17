# vyoh.gg — vNext ideas (post-current-roadmaps)

**Status:** Reference — idea backlog. Items promote out of here into their own working note (with a tracked entry in [open-work.md](../open-work.md)) when they become real arcs. Browse when picking the next big visible-payoff feature.

Ideas that surface *after* the three active roadmaps land — [match-depth-roadmap.md](../lol/match-depth-roadmap.md), and the now-shipped [archive/views-roadmap.md](../archive/views-roadmap.md) + [archive/trends-rework.md](../archive/trends-rework.md). Read this when looking for "what's next after the planned work" or when picking the next big arc.

This doc is intentionally a backlog, not a phased plan. Items are categorized and prioritized by visible-payoff vs. invisible-foundation. The owner has been clear about prioritizing **eye-catching, demoable** work — anything that shows up in a screenshot, animation, or shared link beats anything that lives in CI logs.

The doc also functions as a forward-reference for the active roadmaps: if a vNext idea would be silly to build *after* the planned work (because it would cause re-do), the active roadmap should reflect that today. Cross-references at the bottom of this doc.

---

## Priority bands

This is a backlog. Bands set the search order, not commitment:

- **★★★ Top tier — eye-catching, demoable, portfolio-grade.** First place to look when starting a new arc.
- **★★ Second tier — meaningful but quieter.** Real value, less screen-time. Pick when a top-tier item depends on these landing first.
- **★ Foundational / invisible.** Test suites, observability, infra hygiene. Important for the project's long-term shape but not what lands a job application. Cherry-pick as time allows.
- **Low priority** — explicitly deferred (see end of doc).

---

## Top tier — eye-catching wins ★★★

### LoL surfaces

**Duo / squad detection.** ⚠️ v1 shipped 2026-05-10 (top recurring teammates with W-L + most-played champion); cross-team champion synergy chord shipped 2026-05-11. Squad detection (3+ groupings), LP-overlay graphs per duo, per-duo champion pairs, and match-list duo highlight remain — tracked in [match-depth-roadmap.md](../lol/match-depth-roadmap.md) Phase D under [open-work.md](../open-work.md). Original framing retained: we see all 10 puuids in every match. Across many games, certain puuids recur — that's a duo. Auto-detect and surface "you and {DuoName} are 22–8 in lane swap games." LP graphs overlaid, shared champion-pair stats. Strong "this site noticed something I didn't" moment, novel framing in the LoL-companion space.

**Pre-game ritual widget.** ✅ Shipped 2026-05-10 as a Profile section (`profile-pregame-ritual.tsx`) between live chip and recent form: form, after-last-game tilt, current-hour slot WR, top recent champion. Original framing: glanceable card before queueing — small focused surface (peer route, modal, or Profile section). Best embodiment of the "calm coaching" tonal bet.

**Yearly recap (calm Wrapped).** ✅ Shipped 2026-05-10 as `/lol/$accountSlug/recap` (3 hero sections: rank arc, headline champion, top insight); share-image and scrollytelling polish deferred. Original framing: end-of-season scrollable artifact summarizing trends conclusions. Animated, opt-in share image. Real motion-showcase territory and a built-in deadline — cadence-driven content that re-engages the audience. Tied to the trends-rework's `ConclusionCard` engine.

**Patch-aware everything.** ✅ Shipped 2026-05-10. `gameVersion` plumbed through `RiotMatch.info` → `MatchSummary` → `Match` table; existing rows backfilled. Four UI features ride on top: per-patch champion WR strip on Champion detail, patch boundary `ReferenceLine`s on LP history + KDA trend + champion-detail WR sparkline, "this patch vs last patch" range option on Trends, and a "Patch X.Y" badge with full-build hover on Champion detail. Original framing: shade chart backgrounds at patch boundaries; show per-patch champion WR; "you went 2–8 on Yasuo this patch — buffs/nerfs changed something" copy. Underutilized signal everywhere in the LoL-stat-site space.

**ARAM-specific dashboard.** ARAM is the most-played queue but currently lumped in with everything. Heal-shield delivered, damage-tank ratio, healing-taken. Probably justifies its own sub-route. (Also called out in match-depth Phase D.7.)

**Cross-account portfolio / unified identity.** Multi-account is supported; "Account A vs Account B" comparison is missing. Smurf vs main, EU vs NA. Single Profile-level "unified identity" view across whitelisted accounts.

**"Same day, last year."** Time-machine card on Profile — what were you playing exactly 365 days ago. Cheap to implement once historical backfill is complete; emotional payoff disproportionate to effort.

**Post-game close-the-loop surface.** ✅ PG1 + PG2 + PG3 (Profile-framing close-the-loop) all shipped 2026-05-13; PG4 (peer-route post-game artifact) deferred to v2. See [post-game-close-the-loop.md](../lol/post-game-close-the-loop.md). The after-game counterpart to Pregame Ritual; reuses every primitive that already exists (`ConclusionCard`, `RitualSignal`, SSE invalidation). Strongest single visible-payoff move on the board and the cleanest case-study candidate.

**Composite LP forecast tile.** ✅ Phase LP1 (directional verdict) shipped; Phase LP2 (confidence calibration) is data-gated, tracked in [open-work.md](../open-work.md). See [lp-forecast.md](../lol/lp-forecast.md). Composes the four Pregame Ritual signals into a single verdict + confidence. LP3 (personal linear fit) remains data-blocked until LP-history snapshots accumulate.

**Match annotations.** A 1-line note attached to a game ("tilted, ff15", "great teamfight", "should've banned Yasuo"). Personal, optional, locally-stored or sync-backed. Builds a personal review system over time and unlocks the "let me reread my notes from when I was climbing last season" use case. Strong "this is a real personal app" signal that op.gg/u.gg structurally cannot replicate. Cheap backend (a single nullable `note` field on Match, or a separate `MatchAnnotation` table if we want history). Surfaces on match-row hover, match-detail header, and optionally as a searchable index on Profile. Combines naturally with the post-game close-the-loop card — the read fires the verdict, the user pins their own note next to it.

**Patch-aware champion memory.** ✅ Shipped 2026-05-14 as PB3 (patch-drift verdict). See [personal-baselines.md](../lol/personal-baselines.md). Original framing: *"Last time you played Vex, the patch was 14.18 — she got Q-CD reduced in 14.19; you went 4-1 in 14.18 and 1-5 since."* Surfaces the deltas as a `ConclusionCard` framing on Champion detail, not just a chip on the patch row. Low complexity, no new data, high reward — patch awareness is severely underutilized signal across the genre.

### Self-portrait surfaces

✅ Promoted to its own working note — see [self-portrait-surfaces.md](self-portrait-surfaces.md). Reframes vyoh.gg from "LoL stats site" to "self-portrait engine: every panel is a `ConclusionCard` sourced from a different stream of life." Tracked candidates include chronotype panel (shipped), GitHub activity reframed, Spotify, and WakaTime (conditional), plus adjacent probes (mastery, free-week echo, identity-level signals).

### Motion / UI showcase

**Magazine-grid reflow on Trends range change.** ✅ Shipped 2026-05-10 as part of trends-rework: priority-band sort with insufficient-data tiles drifting to the bottom, verdict cross-fade in `ConclusionCard` via `AnimatePresence mode="popLayout"`, sample-size badge `pathLength` draw on count change. Original framing: when the user switches "30d ↔ 7d" on the trends selector, each `ConclusionCard` re-derives its verdict + chart. Use Motion's `layout` prop on the grid so cards flow physically into new positions, with verdicts cross-fading. Flagship motion moment for the rework — "my trends respond to my question."

**Kill strip ↔ minimap morph.** ✅ Shipped as part of match-depth Phase B (see [match-depth-roadmap.md](../lol/match-depth-roadmap.md)). Original framing: linear strip of dots → rect-based morph onto a Rift SVG, dots travel to their `position.x/y`. Best motion-storytelling moment in the app.

**Build-order items emerging on a time axis.** ✅ Shipped as part of match-depth Phase B (see [match-depth-roadmap.md](../lol/match-depth-roadmap.md)). Original framing: items "drop into" their timestamps with springs, faint connector line draws to the gold-lead chart at the matching timestamp. Cross-chart visual lockstep.

**Live game minute pulse.** The Live page timer pulses one cycle each minute boundary; champion icons get a near-imperceptible scale-bob synced to game time. Page feels alive without being noisy.

**Empty-state illustrations.** ✅ Shipped 2026-05-10/11. `EmptyState` primitive with 5 hand-rolled inline SVG illustrations (matches, LP history, champion portrait, duos, live game) rolled across 8 surfaces. Calm/abstract style: 1px strokes, dashed accents, `currentColor` driven by `text-muted-foreground/40` on the wrapper. Original framing retained — surfaces were text-only before; custom calm illustrations would lift the whole tonal bar.

**Ambient backdrop polish.** Beyond the splash backdrop's current static state — explore subtle filter shifts (slow brightness/saturation breath), color-gradient drift, small particle-like ambient elements at very low alpha. **Note: scroll-linked y-transform parallax was tried and reverted (commit `4c60951`); explicitly excluded.**

**Drag-to-reorder Profile sections.** Persist user's preferred Profile layout. Personal-app feel; differentiates from op.gg/u.gg's fixed templates. dnd-kit.

**Scroll-driven case-study pages.** Once we write up "how LP history works without TimescaleDB" or "the Riot rate-limiter fix," scrollytelling treatments are interesting — the chart redraws as the reader scrolls the prose. Different bundle, opt-in per page.

**View Transitions API.** Wider browser support now (Chrome/Edge/Safari TP). Could replace some of the current AnimatePresence dance for cross-route morphs. Worth a feasibility spike — if it works for our shared-element morphs, it's a substantial code reduction.

### Animation stack — Motion stays primary

Before the library suggestions below pull anyone in a different direction: **Motion (formerly Framer Motion) was the right pick and remains the primary animation library.** Nothing in this doc is intended as a wholesale replacement.

- **Motion stays primary.** `layout` animations, `AnimatePresence`, `LazyMotion` + `domMax`, MotionValues for scroll-linked behavior — all class-leading, all already wired across the app. The trends-rework's magazine-grid reflow rides entirely on `layout`. The match-list ↔ detail morph and existing route transitions all depend on Motion's exit-animation handling.
- **GSAP is a scoped specialist, not a replacement.** Pull it in only for surfaces where Motion's strengths genuinely fall short:
  - **ScrollTrigger** for scrollytelling case-study pages.
  - **MorphSVG** for morphing between arbitrary SVG paths (Motion can animate a path, not morph one shape into another).
  - **Deterministic timelines** for build-order replay or any "scrub through a fixed sequence" UI in match-depth Phase B.
  - **SplitText** if character-level reveal effects appear on a case-study page.
  Otherwise: don't reach for GSAP. Do not sweep-replace Motion.
- **Lottie / dotLottie** is for one-off pre-rendered After Effects illustrations only (the empty-state illustration idea). Different niche; doesn't overlap with Motion.
- **Don't add react-spring.** It's a genuine Motion competitor, would duplicate the mental model with zero upside. Permanent-no.

### UI library upgrades

**visx (Airbnb).** ✅ Shipped 2026-05-11 across four surfaces: death-matchup heatmap on Champion detail (`@visx/heatmap`), champion synergy chord on Profile (`@visx/chord` + `Ribbon`), LP history brush hybrid with the existing Recharts chart (`@visx/brush`), and build-order Sankey on Champion detail (`d3-sankey`). Pattern: visx for non-stock viz; Recharts stays for stock cases. See [library-shortlist.md](library-shortlist.md).

**dnd-kit.** Drag-to-reorder, drag-from-list. Profile reorder, pinning matches, champion priority lists.

**react-three-fiber + drei.** 3D Rift backdrop, animated splash, low-key ambient particles. Heavy bundle, deliberate per-page choice. A single hero page with R3F is a portfolio money shot. Strong differentiation vs. op.gg.

**Konva.** Canvas-based 2D. If the minimap kill plot needs heavy interactivity (zoom/pan, hundreds of dots, smooth at 60 fps), canvas beats SVG. Worth picking up specifically for that one component if the SVG version stutters.

**vaul.** Sheet/drawer primitives. Live game and match-detail-popover surfaces would benefit on mobile.

### Server-driven & shareable artifacts

**Server-side live-game polling.** ✅ Shipped 2026-05-10 as match-depth Phase C. `LiveGamePollerService` polls Spectator-V5 server-side; SSE emits transitions via the existing `MatchEventsService`. "Live now" chip on Profile renders even when the account isn't currently viewed. See [match-depth-roadmap.md](../lol/match-depth-roadmap.md).

**Weekly digest as markdown export.** Each week, auto-generate a markdown post from Trends conclusions. Personal log + portfolio fodder; case-study material. Low complexity given conclusion data is already structured by the trends rework.

**PDF / image export of match detail.** Shareable post-game review. We already render OG images server-side for match URLs — extend the same renderer to "full report" cards.

**Discord webhook integration.** Personal-feel notification — fire significant events (rank up, big LP swing, end-of-game) into a personal Discord channel. Trivial to wire, high "this is a real, alive personal app" impression.

---

## Second tier — quieter but meaningful ★★

### LoL surfaces

**Cmd+K palette extension.** ✅ Promoted 2026-05-17 to [command-palette.md](./command-palette.md); v1 shipped, Phases A–E ahead and tracked in [open-work.md](../open-work.md). Original framing retained for context: extend the existing palette to search matches by champion played, win/loss, date range, KDA threshold; absorb the "change view scope from deep scroll" use case handed off when sticky controls were reverted.

**Goal setting + projection.** "Reach Diamond by July." Show projected ETA based on current LP/day velocity. Honest projection — variance shown, not a single number.

**Champions you should learn next.** Based on similarity to your top picks (cdragon has tags). Personal recommendation surface; ties to the champion-focus prescription tile in trends-rework T3.4.

**Climbing diary.** Markdown notes tied to LP milestones / specific matches. Personal, not gamified. Optional public-share via the "PDF/image export" path above.

**Public-friend leaderboard.** Calm board for whitelisted players' relative performance. No gamification copy — just a roster.

### Motion / UI

**Sample-size badge fill animation.** Partial-circle SVG draws from 0 to its final fill on first paint. Reads as "calibrating" before settling into the verdict. Tied directly to trends-rework T2.

**Verdict typography emphasis.** Variable font weight (Inter Variable) animated on hover via `font-variation-settings`. Quietly fancy.

**Odometer-style number transitions.** `CountUp` is fine for fade-in. For real number deltas (LP changing live, WR shifting), odometer rolls work better. Subtle constraint: only animate on actual changes, not first paint.

**Skeleton shimmer.** Skeletons today are static. Add subtle gradient sweep — calm shimmer, not aggressive. Connection-aware (only render shimmer on slow connections; instant render otherwise).

**Container queries.** For genuinely component-driven responsive layouts. CSS-native, no JS. Worth an audit pass once the magazine-grid Trends layout settles.

### Server-driven

**Push notifications (web push).** Service worker territory. "Live game started," "duo finished a game," "weekly report ready." Real engineering work but a strong differentiator vs op.gg/u.gg.

**Email digest.** Weekly summary via Resend. Subject line is the most surprising insight.

**BullMQ + Redis.** Already mentioned as planned but not wired. Once we have timeline backfill + rank polling + live-game polling + weekly-digest generation running concurrently, queue-based scheduling beats cron. Visibility, retries, dead-letter — all free. **Cross-reference: match-depth Phase C and the weekly-digest item above both benefit from this landing first.**

---

## Foundational — invisible but valuable ★

The things that don't land in screenshots but matter long-term. Cherry-pick when the appetite for visible work is exhausted.

### Observability

**Web Vitals dashboard.** Capture LCP, INP, CLS per route, plot trends. Existing `reportWebVitals` import in [main.tsx](../../../apps/web/src/main.tsx) is the entry point; currently unused. Could be an internal `/perf` route or a public one — public version is a case-study anchor.

**Bundle size budgets in CI.** Per-route chunk thresholds, CI fails the PR if exceeded. Cheap to wire; portfolio-credible perf evidence.

**Lighthouse CI.** Per-PR audits, score deltas in PR comments. Trivial setup.

**Riot rate-limit headroom dashboard.** Live view of Bottleneck reservoir state. Internal — but a write-up artifact ("what does our rate budget actually look like?") is portfolio gold given the existing rate-limiter case study.

**Sentry / error tracking.** Not wired today. Required for any public deployment.

### Data / backend

**Caching layer (Redis).** Match-ids cache currently lives in-process (per instance). Redis survives restarts and lets us scale horizontally. Tracks with BullMQ adoption.

**Postgres BRIN indexes.** For time-range queries (rank snapshots, matches by date), BRIN beats B-tree on disk size and is appropriate for the access pattern. Cheap optimization once tables grow.

**Backups.** `pg_dump` to off-box on a schedule. Trivial; not yet wired.

### Quality

**Property-based tests** (fast-check) for stats math. Win-rate, streak, LP-normalization functions are exactly the kind of code where property tests outperform unit tests.

**E2E with Playwright + visual regression.** Per-critical-route snapshots gated in CI. Tricky given the animated UI — would need careful baseline taming. Worth attempting once the trends-rework lands (more complex visual surfaces = higher payoff).

---

## Low priority / explicitly deferred

These are off the table for the foreseeable future. Listed so they don't quietly creep back into other docs.

- **Riot RSO auth.** Currently whitelist-driven, no real auth. RSO is required for any public multi-user deployment. Owner has explicitly deferred — accounts stay whitelisted; will revisit if/when public deployment needs multi-user.
- **Splash parallax.** Tried in `341cfcc`, reverted in `4c60951` ("didn't land well visually"). Excluded from all future motion-polish suggestions. Other splash polish (filter drift, breath-rate opacity, color-gradient drift) is fair game; scroll-linked y/scale transforms are not.
- **Material UI / Chakra / Ant Design.** Too opinionated, would clash with the bespoke shadcn aesthetic. Permanent-no.
- **Lottie / dotLottie at scale.** Risk of clashing with calm aesthetic. One hand-crafted Lottie for a hero empty-state could fit; broad adoption does not.
- **OpenTelemetry.** Overkill until we have multiple services. Re-evaluate if microservices ever happen (they probably won't).
- **TimescaleDB / DuckDB.** Postgres handles current scale fine. Re-evaluate if per-frame timeline data analytics becomes a real feature.
- **Self-portrait deferrals.** All hand-maintained surfaces (`/uses`, availability card, anti-resume, personal changelog, currently-reading, Letterboxd), all local-data-collection surfaces (system snapshot, speedtest, local-git "currently working on"), plus Strava, location/timezone, and the creative wildcards (live presence, guestbook, "what I'm into now" rotator) — all off the table per the 2026-05-14 brainstorm. Full reasons in [self-portrait-surfaces.md](self-portrait-surfaces.md#filtered-out).
- **Last.fm.** Owner doesn't use it. Spotify is the audio integration to consider — see [self-portrait-surfaces.md](self-portrait-surfaces.md).

---

## Ten-pick if I had to pick now

If asked tomorrow "what's the next arc after the documented roadmaps land," in priority order:

1. ⚠️ **Duo / squad detection** — v1 shipped 2026-05-10 (Profile section showing top recurring teammates with W-L + most-played champion). Champion synergy chord follow-on shipped 2026-05-11 (`dafd316`) — `@visx/chord` of `(yourChamp, anyTeammateChamp)` frequency + WR; addresses the **across-all-teammates** flavor of "shared champion-pair stats." Four items still deferred: squad detection (3+ groupings), LP-overlay graphs per duo, **per-duo** champion-pair stats (e.g. "you on Lulu + DuoX on Vayne is 8-2" — distinct from the across-all chord), and match-list highlighting of duo games.
2. ✅ **Yearly recap (calm Wrapped)** — shipped 2026-05-10 as `/lol/$accountSlug/recap` (3 hero sections: rank arc, headline champion, top insight). Share-image and scrollytelling polish deferred.
3. ✅ **Magazine-grid reflow on Trends range change** — shipped 2026-05-10. Tile reorder by priority (insufficient-data tiles sink to the bottom band), `ConclusionCard` verdict cross-fade via `AnimatePresence` `mode="popLayout"`, sample-size badge `pathLength` draw on count change.
4. ✅ **Pre-game ritual widget** — shipped 2026-05-10 as a Profile section (`profile-pregame-ritual.tsx`) between live chip and recent form: form, after-last-game tilt, current-hour slot WR, top recent champion.
5. ✅ **Patch-aware everything** — shipped 2026-05-10. `gameVersion` plumbed through `RiotMatch.info` → `MatchSummary` → `Match` table; existing 2521 rows backfilled from `MatchDetailCache.detail`. Four UI features ride on top: per-patch champion WR strip on Champion detail, patch boundary `ReferenceLine`s on LP history + KDA trend + champion-detail WR sparkline, "this patch vs last patch" range option on Trends (groups by truncated `MAJOR.MINOR`), and a "Patch X.Y" badge with full-build hover on Champion detail.
6. ✅ **visx integration** — shipped 2026-05-11 across four surfaces in one session: death matchup heatmap on Champion detail (`@visx/heatmap` via `scaleBand` + `scaleLinear`), champion synergy chord on Profile (`@visx/chord` + `Ribbon` with bipartite symmetric matrix), LP history brush hybrid with existing Recharts chart (`@visx/brush` + `LinePath`, remount-keyed reset for visx's internal selection state), and build-order Sankey on Champion detail (`d3-sankey` since `@visx/sankey` doesn't exist; visx provides `ParentSize`). See library-shortlist for the full package list and per-call-site notes.
7. ✅ **Server-side live-game polling + SSE push** — shipped 2026-05-10 as match-depth Phase C. `LiveGamePollerService` polls Spectator-V5 server-side (no client polling); SSE emits transitions via the existing `MatchEventsService`. "Live now" chip on Profile renders even when the account isn't currently viewed. See match-depth-roadmap.md status.
8. ✅ **Empty-state illustrations** — shipped 2026-05-10/11. `EmptyState` primitive + 5 hand-rolled inline SVG illustrations (matches, LP history, champion portrait, duos, live game) rolled across 8 surfaces (matches list, profile LP history, champion detail, live game, champions list, trends page, recap rank arc, profile duos). Calm/abstract style: 1px strokes, dashed accents, `currentColor` driven by `text-muted-foreground/40` on the wrapper.
9. **Web Vitals dashboard + bundle budget CI** — perf evidence the README needs.
10. **Weekly digest as markdown export** — auto-generates portfolio content.

---

## Decision log (update as we go)

- **2026-05-09** — vNext doc drafted. Owner instructed: prioritize visible/demoable; defer RSO auth indefinitely; splash parallax confirmed as tried-and-reverted (commit `4c60951`). Cross-references added to match-depth-roadmap.md and trends-rework.md to ensure consistency.
- **2026-05-09** — animation-stack stance recorded: Motion stays primary; GSAP is a scoped specialist (ScrollTrigger / MorphSVG / deterministic timelines / SplitText) brought in for specific surfaces only; Lottie for one-off pre-rendered illustrations; react-spring permanent-no. Prevents future sessions from pitching a wholesale animation-stack swap based on the library list above.
- **2026-05-10** — top-10 entries #2/#3/#4 shipped together (commits `574aa7e` magazine-grid reflow, `c8bd4fe` pre-game ritual, `6c0eadf` recap arc). Magazine-grid reflow uses priority-band sort with a 1000-point inactive penalty so insufficient-data tiles drift to the bottom; verdict cross-fade in `ConclusionCard` rides `AnimatePresence mode="popLayout"`; sample-size badge animates via Motion `pathLength`. Recap is a sibling sub-route at `/recap` (no tab in the strip — link from Profile only) so it reads as an "open this artifact" surface rather than a tab. Three hero sections only; share-image and scrollytelling-by-section deferred to later sessions. Magazine-grid follow-up: `grid-flow-row-dense` added in `3143e7f` to backfill leftover columns when a span-2 tile pushes to the next row (otherwise the grid leaves visible holes).
- **2026-05-10** — top-10 entry #1 (duo / squad detection) v1 shipped (`42549b4`). Backend `GET /lol/.../duos` reads `MatchDetailCache.detail` for the user's matches in the window, finds same-team puuids, aggregates by puuid (games / wins / top champion), filters at ≥ 3 games together, returns top 10. No new schema or table — pure read off the cache. Profile component (`ProfileDuos`) renders top 3 between role strip and queue distribution. Deferred from this session: squad detection (3+ groupings), LP-overlay graphs on the duo, shared champion-pair stats, match-list highlighting of duo games. The Riot-ID gameName/tagLine on each Duo is the most-recent observation per puuid (Riot IDs can change).
- **2026-05-10** — Top-10 #5 (patch-aware everything) shipped as a single-session cluster on top of one schema commit. `gameVersion` added to `RiotMatch.info` (was missing from local types — Riot returns it in the Match-V5 payload but we hadn't projected it), to `MatchSummary`, to the `Match` Prisma model with `@default("")`, and to `riotMatchToSummary` in the mapper. One-shot backfill script (`prisma/backfill-game-version.ts`) populated 2521 existing rows by joining `Match` to `MatchDetailCache.detail->'info'->>'gameVersion'`. Four UI features: (1) `ChampionPatchHistory` strip on Champion detail (truncated MAJOR.MINOR groupings, current patch highlighted, 6-patch tail max, verdict copy "This patch (14.20): 2-8, +X% from 14.19"); (2) patch-boundary `ReferenceLine`s with `ifOverflow="hidden"` and the new patch number as `insideTopRight` label, applied to LP history (timestamp X-axis, ranked queue match-derived boundaries), KDA trend (game-index X-axis), and the champion-detail WR sparkline; (3) `"patch"` added to `TrendsRangeId`, `splitWindows` groups by truncated patch and returns the most-recent bucket as `current` and the second-most as `previous`; (4) `ThisPatchBadge` chip in the champion-detail hero showing "Patch X.Y" with the full build string in a Radix tooltip. All grouping helpers (`truncatePatch`, `groupByPatch`, `findPatchBoundaries`) live at `lol/_shared/patch-version.ts` with full unit-test coverage. The WR-trajectory sparkline was deliberately skipped — adding patch markers to a hand-rolled SVG sparkline with no x-axis context would have been visual clutter.
- **2026-05-10** — Per-view controls placement consolidated. Briefly tried a sticky-below-header slot for the matches queue filter and the champions sort/count, with a portal mechanism so pages could feed the slot. Reverted — three sticky chrome layers stacked (global nav + account header + sticky controls) was structurally too heavy on a 1080p viewport. Settled on inline non-sticky controls at the top of each long-list page (Matches, Champions, Trends), all three using the same `flex items-center justify-between gap-3` pattern. The "change scope from deep scroll" friction is intentionally handed off to the **Cmd+K palette extension** (this entry, and top-10 #10 weekly digest) — that's the right surface for "filter long lists without scrolling up," not a sticky bar. Slot infrastructure (`account-controls-slot.tsx`, `--account-header-height`, `mt-6` on page-slide wrapper, gap-0 outer flex) all reverted.
- **2026-05-11** — Empty-state pass (top-10 #8) shipped. `EmptyState` primitive in `components/empty-state.tsx` with 5 hand-rolled inline SVG illustrations (matches, LP history, champion portrait, duos, live game). Rolled across 8 surfaces: matches list (queue-strand vs no-cache differentiated, "Clear queue filter" action on strands), profile LP history, champion detail (no matches yet), live game (not in game + game over), champions list, trends page, recap rank arc, profile duos. Calm/abstract style — 1px strokes, dashed accents, all driven by `currentColor` via `text-muted-foreground/40` on the wrapper. Commits `7eb00b8` (primitive + 4 surfaces) and follow-on in the same arc for the remaining 4.
- **2026-05-11** — Recap champion splash polish (commit `98001fb`). User reported the splash on the "Champion of the year" card was flashing bright then suddenly dimming after entrance animation. Root cause: section's stacking context only existed while `whileInView` opacity was animating (<1); once it reached 1 the context dissolved and the `-z-20` local splash escaped to the body, falling behind the global `SplashProvider` (which has Ken Burns drift + brightness 0.7 filter at opacity 0.2). Fix: `isolate` class on the section forces permanent stacking context. Also split the chrome: section bg dropped, splash backdrop and a `bg-card/40` chrome layer now use complementary masks (splash visible right of 40%, chrome visible left of 40%) so the right side renders the splash undimmed. Image converted from CSS `background-image` to a plain `<img>` (motion's `initial` doesn't apply at first paint — caused unstyled-frame flash). Final opacity dialed in at 0.6.
- **2026-05-11** — visx integration shipped across four surfaces in one session, completing top-10 #6. See top-10 entry for full surface list and library-shortlist for per-call-site notes. Pattern established: visx for non-stock viz (heatmap, chord, brush, Sankey-via-d3); Recharts stays for stock cases (line/bar/radar with reference primitives).
- **2026-05-11** — Death-matchup heatmap design note: shipped as **minute × matchup grid** (Champion detail), not as position-on-Rift-map. Cleaner scope (no backend changes needed — reads `deathTimings` and `laneOpponent.championName` from `MatchSummary`) and a stronger fit for the matchup-comparison story. Position-based heatmap on the Rift map (originally framed as D.1) is now paired with the op.gg-style overlay (Phase E) — both need event x/y projected onto MatchSummary and are best built together. See match-depth-roadmap.md.
- **2026-05-11** — `.tanstack/` scratch dir added to `.gitignore` (generated by `@tanstack/router-plugin/vite` for route-tree generation, was untracked but visible in working tree).
- **2026-05-13** — three items promoted to tracked working notes:
  - **Post-game close-the-loop** → [post-game-close-the-loop.md](../lol/post-game-close-the-loop.md). Promoted because it's the highest-payoff missing surface in the LoL section and the cleanest case-study candidate currently in the backlog.
  - **Composite LP forecast** → [lp-forecast.md](../lol/lp-forecast.md). Promoted because the confidence-model decision (naive vs. personal linear fit) is non-trivial and benefits from being thought through before implementation.
  - **Personal-baselines framing** → [personal-baselines.md](../lol/personal-baselines.md). Promoted from implicit pattern to explicit design principle. The "you-vs-you" framing is what makes the verdict pattern land; documenting it prevents drift toward global-percentile defaults in future tiles.
  - Two new entries added in this pass: **match annotations** (personal-app signal, cheap backend) and **patch-aware champion memory** (verdict layer on top of existing patch-boundary chart work).
  - Reframe driven by [app-state-analysis.md](../lol/app-state-analysis.md) 2026-05-13 rewrite, which centred on the *cross-link / dossier* gap rather than the *Champions-tab weakness* — see that doc for the structural argument.
