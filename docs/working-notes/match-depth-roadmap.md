# vyoh.gg — Match depth + live game + learning-surfaces roadmap

Working plan for expanding the match detail page, adding a live-game view, and layering deeper per-match / per-account learning surfaces. Read this when working on any of: match detail enrichment, Match-V5 timeline, Spectator-V5 live game, lane-phase metrics, build order, kill/objective timelines, damage breakdowns, or rune/skill-order display.

This is a living plan, not a contract. Phases are sequenced so each one ships value on its own — don't block phase N on phase N+1's full scope. See [views-roadmap.md](views-roadmap.md) for the parallel Profile/Champion-detail track.

**Status (2026-05-16): Phases A + B + C shipped; D and E partial.** Match detail / timeline / live game all live. Outstanding D items (squad detection, LP-overlay per duo, per-duo champion pairs, match-list duo highlight, D.2–D.7) and E remainders (full rune page, composite S grade) are tracked in [open-work.md](open-work.md). Parked sub-items (build-order component-collapse, hover-highlight, boot collapse, soul drake type) are listed in [parked.md](parked.md). Full Status section with commit refs is [further down](#status).

---

## Guiding principles

- **Smallest shippable slice.** Each phase below is a single weekend's worth or smaller. Big-bang rewrites of the match detail page are explicitly avoided — we extend the DTO, add panels, keep the existing roster as the spine.
- **Surface what we already have before fetching more.** [`MatchDetailCache`](../../apps/api/prisma/schema.prisma) stores the full Match-V5 payload as JSON. We currently project ~10 fields per participant out of ~150 available. Phase A is mostly DTO-projection work, no new Riot calls.
- **Calm aesthetic.** No celebratory primitives. Damage breakdown bars, kill timelines, build orders all default to subtle/ambient — matches existing tone (cf. `feedback_calm_aesthetic` memory).
- **Motion is showcase territory, push the ambition.** When a phase opens up motion opportunity (kill-strip → minimap morph, rune wheel, gold-lead area chart drawing), pitch 5–8 ideas, don't pre-filter to one safe pick.
- **Insights inside views, not a separate "Insights" tab.** Every learning surface lives on Match detail, Champion detail, or Profile — never a top-level tab.
- **Data-collection vs. render is a real distinction.** Match-V5 timeline payloads are 0.5–2 MB raw. Cache the raw blob, project a slim `MatchTimelineProjection` to the browser. Same pattern as `RankSnapshot` → web-side `normalizeLp`.
- **Portfolio narrative.** Each phase produces one concrete artifact for the README/case study: a deployed view, a perf measurement, or a write-up of a non-trivial choice (e.g., "selective field projection on a 2 MB JSON column without round-tripping the bytes").

---

## Current state inventory

Concrete inventory as of this doc's writing — useful so each phase below can describe a delta rather than restating the baseline.

**Match detail page** ([apps/web/src/lol/matches/match-detail-view.tsx](../../apps/web/src/lol/matches/match-detail-view.tsx)):

- Two-column blue/red roster split.
- Per row: champion icon, name, KDA, items 0–6 (with rich CDragon tooltip), total damage bar, gold bar.
- Hero card morphs from list-card via WAAPI rect-based animation.
- Sticky champion strip when hero scrolls past.
- LP delta badge (when available).

**Match list rows** ([apps/web/src/lol/matches/match-row.tsx](../../apps/web/src/lol/matches/match-row.tsx)):

- Own KDA, win/loss, queue, duration, time-ago, LP delta. Champion of *the user only*.
- No information about lane opponent, premades, full-team comp, or per-game performance signals (CS, vision, KP).

**API surface — what we use:**

- `Account-V1` resolve riot ID
- `Match-V5 by-puuid/ids` list match IDs
- `Match-V5 by-id` full match (cached as `MatchDetailCache.detail` Json column)
- `League-V4 entries-by-puuid` rank
- `Summoner-V4 by-puuid` icon + level

**API surface — what we don't use yet:**

- `Match-V5 timelines/by-match/{matchId}` ← per-frame state, all events. Not called anywhere.
- `Spectator-V5 active-games/by-summoner/{puuid}` ← live game. Not called.
- `Champion-Mastery-V4` ← mastery points/level on a champion, useful in Live view.
- `League-V4 challenges` (`Lol-Challenges-V1` global config + per-summoner) ← a calm, player-facing achievement system, well-suited to the aesthetic.

**DTO gap.** [`MatchDetail.ParticipantDetail`](../../packages/shared/src/lol/match-detail.ts) projects 12 fields. The Riot payload's `participants[i].challenges` block alone has ~120 — CS/min, KP, damage share, time CC dealt, vision score, control wards purchased, first-blood/first-tower, lane phase metrics like `goldPerMinute`, `laneMinionsFirst10Minutes`, `kda`, `damagePerMinute`, etc. **Most of "the things op.gg shows" are in data we already have, just not projected.**

**Rate-limit headroom.** Single user, 4 whitelisted accounts. Cron every 5 min. Limiter detailed in [riot-investigation-2026-05-07.md](riot-investigation-2026-05-07.md). One extra Match-V5 timeline call per *new* match (paged by detail backfill) doubles the per-match Riot call count from 1 → 2 — well within reservoir capacity. Live-view polling at 60 s/account is also negligible.

---

## Phase A — Match detail breadth (no new endpoints)

**Goal:** Squeeze everything out of the data we already cache. Match detail page goes from "two team rosters" to "what a serious LoL stat site shows for a match" — without a single new Riot call.

**Scope:** DTO projection, new panels on the detail page, player names everywhere they're missing.

### Deliverables

1. **Player names + tags on match list rows.**
   - Add a `laneOpponent: { championName, gameName, tagLine }` field to `MatchSummary`. Already extracted (kind of) — `extractItemsAndOpponents` only stores opponent champion as a string. Promote to a structured field stored on the `Match` row.
   - Update [match-row.tsx](../../apps/web/src/lol/matches/match-row.tsx) to show "vs Caitlyn (Faker#KR1)" when teamPosition non-empty, omit for ARAM/Arena.
   - Hover the row → reveal a 10-name popover with both teams' players (champion + name, color-coded by team, your row highlighted). Lazy-load from cached `MatchDetailCache` if not already in client cache.

2. **Match header strip.** Single horizontal panel above the team rosters. Per-team aggregates at a glance:
   - Total kills (big tabular-nums, color-coded).
   - Total team gold (k-formatted).
   - Towers / inhibitors / dragons / heralds / barons as small icon strips with counts (compact, no labels).
   - Soul drake (if any) labeled with element.
   - First-blood / first-tower indicators on the winning side.
   - All from `match.info.teams[].objectives` — already in payload, never read.

3. **Per-row enrichment in detail rosters.** Extend `ParticipantDetail` and `match-mapper.ts`:
   - `csTotal`, `csPerMin` (computed from `totalMinionsKilled + neutralMinionsKilled` ÷ duration).
   - `visionScore`, `wardsPlaced`, `wardsKilled`, `controlWardsPurchased`.
   - `kp` (kill participation %, from challenges block).
   - `damageShare` (% of team's total damage).
   - `goldShare`.
   - `damageDealtPhysical`, `damageDealtMagic`, `damageDealtTrue` (split for the bar).
   - `summoner1Id`, `summoner2Id` (spell IDs).
   - `keystone` only (single rune ID — the perk under `perks.styles[0].selections[0].perk`). Full rune page deferred — see Phase E.
   - `championLevel`.
   - Render: champion-level badge over icon, summoner spells as a 2x1 strip, keystone rune as a single icon next to champ icon.

4. **Damage breakdown bar.** Replace single-color total damage bar with a 3-segment bar (physical / magic / true). Hover reveals exact numbers. Visual story: instantly see whether the AD carry on the enemy team did 80% physical (no MR needed) or whether their assassin went hybrid.

5. **"Score-of-game" badges.** A handful of calm achievements per match, awarded to participants based on cross-team stats:
   - "Most damage", "Highest KDA", "Most vision", "Highest KP", "Most CS", "Lowest deaths".
   - Render as a small chip under the player's row. No "MVP" trophies — just labels. Align with calm-aesthetic memory.
   - Compute in the detail view, no schema change needed.
   - **Out of scope for Phase A:** a single composite grade (S+/S/A/...). Tracked as a possible follow-up if separate badges turn out to be too noisy in practice.

6. **Team summary card replacing "Win/Loss" headline.** Above each team block, show: total kills, gold lead vs other team (positive/negative), objective ratio. Replaces the current `<Win />` / `<Loss />` text.

### Files touched

- [packages/shared/src/lol/match-detail.ts](../../packages/shared/src/lol/match-detail.ts) — extend `ParticipantDetail`, add `TeamSummary`.
- [packages/shared/src/lol/match.ts](../../packages/shared/src/lol/match.ts) — extend `MatchSummary` with `laneOpponent`.
- [apps/api/src/lol/match-mapper.ts](../../apps/api/src/lol/match-mapper.ts) — extend projection.
- [apps/api/src/riot/types.ts](../../apps/api/src/riot/types.ts) — add `RiotMatchTeam`, `RiotChallenges` (typed sliver of the challenges block we project).
- [apps/web/src/lol/matches/match-detail-view.tsx](../../apps/web/src/lol/matches/match-detail-view.tsx) — add header strip, score badges, expanded participant row.
- [apps/web/src/lol/matches/match-row.tsx](../../apps/web/src/lol/matches/match-row.tsx) — lane-opponent slot, hover popover.
- New: `apps/web/src/lol/matches/match-team-summary.tsx`, `match-list-row-popover.tsx`, `participant-row.tsx` (extracted).

### Reuse opportunities

- `StatBar` already exists; extend to support segmented (physical/magic/true) variant.
- CDragon helper for items can be cloned for runes (icon URL pattern is identical).
- `champion-icon.ts` / `wsrv.nl` proxy pattern handles the new icons.
- Score-of-game badges fit nicely as `Chip` / `Badge`-style components — no new primitive.

### Implementation order within the phase

1. DTO extension on shared + API + cache invalidation. No UI yet — verify the new fields land in `MatchDetailCache` re-fetches.
2. Per-row enrichment (CS, KP, damage share, vision) — biggest UX lift.
3. Match header strip with team objectives.
4. Damage breakdown segmented bar.
5. Lane opponent + popover on match list.
6. Score-of-game badges.

### Cost / risk

- **Cache shape change.** `MatchDetailCache.detail` today stores the *projected* `MatchDetail`, not the raw Riot payload (cf. [lol.service.ts:514](../../apps/api/src/lol/lol.service.ts#L514) — `detail as unknown as object` after `riotMatchToDetail`). Pre-prod, so the simplest path is: switch the cache to store the raw Riot payload, drop the existing rows, let backfill re-fetch. No migration shim needed. After this, every future DTO extension is a free re-projection on read — no Riot round-trip.
- Hover popovers on virtualized list rows — careful with the popover-portal interaction with the virtualizer's transform. Pattern from current item tooltip should generalize.

---

## Phase B — Match timeline (Match-V5 timeline endpoint)

**Goal:** Add the four artifacts that turn match detail from "summary" into "post-game review tool": build order, gold-lead chart, kill timeline, objective timeline. Bonus: skill order, lane-phase metrics.

**Scope:** New Riot endpoint + new cache table + parser + several new panels.

### Deliverables

1. **Backend wiring.**
   - `getMatchTimelineById(matchId, regional)` in [apps/api/src/riot/riot.service.ts](../../apps/api/src/riot/riot.service.ts).
   - New method-family entry `match-timeline-by-id` in [method-families.ts](../../apps/api/src/riot/method-families.ts) (same 2000/10s envelope as `match-by-id`).
   - New Prisma model `MatchTimelineCache { matchId, timeline Json, cachedAt }` mirroring `MatchDetailCache`.
   - Fetched lazily on first match-detail-page visit (not eagerly during sync) — keeps the cron tick fast and avoids storing 2 MB blobs we may never view.

2. **Slim projection.** New shared type `MatchTimelineProjection` carrying only what the UI needs:
   - `frames: { ts, perParticipant: { goldDelta, level, items, position } }[]` — already a small slice of frames.
   - `kills: { ts, killerId, victimId, position, assistIds }[]`.
   - `objectives: { ts, type: "DRAGON_FIRE" | "DRAGON_OCEAN" | ... | "BARON" | "TURRET", teamId, position }[]`.
   - `buildOrders: { participantId, events: { ts, type: "PURCHASED" | "SOLD" | "UNDONE", itemId }[] }[]`.
   - `skillOrders: { participantId, slots: { ts, slot: 1|2|3|4 }[] }[]`.
   - Project on the API side. Web sees ~30–80 KB instead of 0.5–2 MB.

3. **Build order panel** ([apps/web/src/lol/matches/match-build-order.tsx](../../apps/web/src/lol/matches/match-build-order.tsx)).
   - Two horizontal timelines stacked: yours on top, your lane opponent's below. Same time axis, aligned.
   - Items purchased in chronological order, with timestamps relative to game time.
   - Hover an item → highlight its components (which were merged into it). Component tree is in the items dataset.
   - "Sell" / "Undo" events shown as muted entries with a strikethrough.
   - **Anti-clutter rules** (worth respecting since two rows doubles the visual load):
     - Filter trinkets, control wards, consumables (potions, biscuits, refillable, elixirs) out of the visible row by default. Toggle to show them.
     - Collapse "bought boots tier 1 → upgraded boots tier 2" into a single slot showing the upgraded version, with the upgrade time as a tick mark.
     - Components that get merged into a completed item collapse into the completed item's pip; the component history surfaces on hover, not as separate slots.
     - On ARAM/Arena (no real lane), fall back to single-row (yours only).
   - The "show enemy laner build" toggle starts ON for ranked, OFF for normals — different learning posture per queue.

4. **Gold-lead chart** ([apps/web/src/lol/matches/match-gold-lead.tsx](../../apps/web/src/lol/matches/match-gold-lead.tsx)).
   - Recharts area chart of `team100_gold − team200_gold` per minute.
   - Y-axis is signed; positive emerald, negative rose; the 0-line is the visual anchor.
   - Lead-flip moments marked with vertical reference lines (subtle).
   - On hover, show absolute team golds for that minute in the tooltip.

5. **Kill strip** ([apps/web/src/lol/matches/match-kill-strip.tsx](../../apps/web/src/lol/matches/match-kill-strip.tsx)).
   - Thin horizontal strip aligned with game-time. Each kill = a colored dot (team-colored).
   - Hover → "14:02 — Caitlyn killed Jhin (assist: Yasuo)".
   - Click → expands into minimap mode (Phase B.6).

6. **Minimap kill plot** (motion showcase candidate).
   - SVG overlay of Summoner's Rift map (static asset, ~50 KB).
   - Kill positions plotted as dots with team color and a faint trail to the game-time strip.
   - Animation idea: dots stagger-reveal in chronological order on first paint, ~600 ms total.
   - Reduced-motion: instant render, no stagger.

7. **Objective timeline** ([apps/web/src/lol/matches/match-objective-timeline.tsx](../../apps/web/src/lol/matches/match-objective-timeline.tsx)).
   - Horizontal lane below kill strip showing dragon (with element), herald, baron, elder, towers.
   - Pip per event, color-coded by team taking it. Hover for "12:14 Mountain Drake — Blue".

8. **Skill order grid** ([apps/web/src/lol/matches/match-skill-order.tsx](../../apps/web/src/lol/matches/match-skill-order.tsx)).
   - 4-row × 18-col grid (QWER × levels). User's participant by default, dropdown to switch.
   - Each cell filled with the slot that was leveled at that level. Standard champion-page artifact.

9. **Lane-phase callouts** ([apps/web/src/lol/matches/match-lane-phase.tsx](../../apps/web/src/lol/matches/match-lane-phase.tsx)).
   - At-a-glance card: "+24 CS at 10 min", "−1.2k gold at 15 min", "vs your average +6 / −0.6k".
   - Pulled from `frames[10]` and `frames[15]` `participantFrames`. Compared against per-champion or overall averages.
   - This is the highest-density "what could I have done differently" surface.

### Charting library choice

- **Default to visx for non-stock charts** (minimap kill plot, custom radial layouts, anything we'd otherwise hack into Recharts). Recharts stays for stock cases (gold-lead area chart, KDA line). This avoids a Recharts → visx rewrite later — see [vnext-ideas.md](vnext-ideas.md).
- Specifically, the **minimap kill plot** (B.6) should be built on visx from day one. Recharts can't do "dots on an arbitrary 2D map background" cleanly.

### Reuse opportunities

- Recharts already in. Custom tooltip pattern from `KdaTooltip` (cf. `feedback_recharts_custom_tooltip`).
- Animation patterns (`m.div`, `LazyMotion domMax`, `Variants` stagger) for kill-dot reveal.
- Sticky champion strip at top — extend to include game-time anchor when scrolled past timeline panels.

### Cost / risk

- **Timeline payload size.** 0.5–2 MB raw. **Mitigation:** project on the API side, return slim DTO. **Write-up angle:** "Selective field projection from a JSON column without deserializing the whole blob." Postgres `jsonb` operators (`->`) let you project subtrees without parsing the whole document — good case study material.
- **Lazy fetch on first view.** Don't proactively cache timelines for old matches; only fetch when the user visits the detail page. Cache miss pays one extra Riot call. Already <10 visits/day per account, well within the 2000/10 s envelope.
- **Reduced-motion needs care.** All timeline panels should default to instant render under `prefers-reduced-motion`.

### Implementation order within the phase

1. Backend: `getMatchTimelineById` + `MatchTimelineCache` + projection. No UI yet — sanity-check the shape.
2. Build order panel (highest "I learned something" payoff per pixel).
3. Gold-lead chart.
4. Kill strip + objective timeline (paired — share the time axis).
5. Skill order grid.
6. Lane-phase callouts.
7. Minimap kill plot (motion showcase).

---

## Phase C — Live match view (Spectator-V5)

**Goal:** When the user is in a game, show pre-game data on all 10 players: rank, recent form, mastery, runes. The detail-page-style learning continues into the live game.

**Scope:** New Riot endpoint, **server-side polling loop with SSE push** to clients, new route + page.

### Architecture choice — server-side polling, not client polling

Polling Spectator-V5 happens on the **server**, not the client. The server polls each whitelisted account on a cadence (~60 s when no game detected, faster ramp-up when one is active), caches the response keyed by `(puuid, gameId)`, and pushes "live game state" to subscribed clients over SSE (extending the existing match-events SSE channel).

Why server-side:

- Single source of truth. The "Live now" chip can render on Profile of accounts not currently being viewed — the API already knows which accounts are in game.
- Lighter clients. No per-tab polling overhead.
- Cleaner architecture for the rate-limit story — one polling loop, one cache, one fairness budget across accounts.
- Aligns with the existing match-events SSE pattern in [match-events.service.ts](../../apps/api/src/lol/match-events.service.ts).

This was originally drafted as a client polling loop. The shift to server-side was decided in [vnext-ideas.md](vnext-ideas.md). Documenting it up-front so Phase C v1 doesn't get built client-side first.

### Deliverables

1. **Backend wiring.**
   - `getActiveGameByPuuid(puuid, platform)` in `riot.service.ts`. Spectator-V5 returns 404 when not in game — treat as a normal "not in game" signal, not an error.
   - New method-family entry `active-game-by-puuid`.
   - **`LiveGamePollerService`** — singleton polling loop. Iterates whitelisted accounts on a cadence; caches `(puuid → ActiveGame | null)` in-memory; emits `LiveGameEvent` on transitions (game-started / game-ended / game-state-updated) via the existing `MatchEventsService` extended with a new `forLiveGame(puuid)` channel.
   - Endpoint: `GET /lol/summoners/:region/:gameName/:tagLine/live` returns the cached `LiveMatch | null` instantly (no Riot call).
   - SSE channel: extends the existing `matches/events` SSE to include live-game messages, OR a new `live/events` channel — decide based on whether the existing channel's puuid filter generalizes cleanly.
   - Web hook `useLiveMatch(account)` reads from the cached endpoint + subscribes to SSE for transitions. No client-side polling.

2. **"Live now" chip on Profile.** Small pill near the rank tiles when active game detected. Click → navigate to `/lol/$accountSlug/live`. Receives state via SSE — animates in when a game starts on this account, animates out when it ends.

3. **Live match page** ([apps/web/src/routes/lol/$accountSlug/live.tsx](../../apps/web/src/routes/lol/$accountSlug/live.tsx)).
   - Game time counter (counts up client-side from `gameStartTime`).
   - Queue type, map, mode badges.
   - 5v5 grid (opportunistic enrichment — all 10 players):
     - Champion icon + champion level.
     - Summoner spells.
     - Keystone rune (full rune page deferred to Phase E).
     - Per-player ranked-solo current rank (from League-V4 — fetched once per detected game).
     - Champion mastery on the picked champion (Champion-Mastery-V4 — fetched once per detected game).
     - Last-5 form pips: **only for whitelisted players** (we don't have match history for opposing players in DB, and re-deriving it via Match-V5 would be ~5 calls × 9 players = too expensive per game).
   - Bans bar across the top.

4. **Compositional analysis card.** Static compositional-analysis based on champion tags (engage potential, scaling, AD/AP/true split, frontline %). Small radar chart per team.

5. **Auto-refresh + exit.** When 404 returns, the live page falls back to a "Game ended" state with a button to navigate to the matches list. The new match should appear in the feed after the next sync tick.

### Cost / risk

- **Rate-limit math.** Sustained baseline today is ~5–10 calls/min against the slow regional 50/min budget (cron + occasional user nav). Opportunistic enrichment adds **a 21-call burst per detected game** (1 Spectator + 10 League-V4 + 10 Mastery-V4) — drains ~25 s of slow-regional headroom, then settles. After the burst, only the 60-s Spectator-V5 poll continues. Affordable for a 1-user / 4-whitelisted-account app; would not be affordable in a multi-tenant deployment.
- **Cache strategy is what makes this cheap.** Key per-player rank + mastery data by `(gameId, puuid)`. Never refetch during the same game — rank doesn't change mid-match, mastery progress is too small to bother. When `gameId` changes, the cache is implicitly invalidated.
- **Last-5 form pips stay whitelist-only.** Computing them for non-whitelisted players would mean a Match-V5 history walk per player (`match-ids-by-puuid` + ~5 `match-by-id` calls each). That's another 50+ calls/game — *not* affordable. Other 9 players show champion + spells + keystone + rank + mastery only.
- **Graceful degradation.** Each per-player enrichment call should fail independently — one Riot timeout shouldn't blank out the whole live page. Render whatever resolved; show a tiny indicator on the slots that didn't.
- **Spectator-V5 has known quirks** when a player just queued / dodged / loaded into champ select. Polling backoff on transient 5xx, treat consistent 404 as "not in game". A dedicated case study could come out of this: "Polling Spectator-V5 against an inconsistent endpoint."
- **Visibility-based polling cadence.** With server-side polling, there's no per-tab visibility concern — the server polls regardless of focused clients. But the polling cadence per account should ramp down on long-idle accounts (e.g., back off from 60 s to 5 min if no game detected for several hours, snap back to 60 s on the next match in DB) to keep the rate budget healthy.
- **Rate-limit observation worth measuring before shipping.** Concrete numbers (baseline calls/min, 21-call burst impact on slow-regional reservoir) belong in the README's perf section as evidence.

### Reuse opportunities

- Profile rank-tile component for per-player rank display.
- Last-5 pips component already lives in [profile-recent-form.tsx](../../apps/web/src/lol/profile/profile-recent-form.tsx).
- Champion icon/splash machinery already proxied via `wsrv.nl`.

### Implementation order within the phase

1. Backend Riot wiring + Spectator-V5 type.
2. "Live now" detection on Profile (hidden when no game).
3. Live page minimum: 10 champions + summoner spells + bans + game timer.
4. Per-player rank.
5. Per-player runes + mastery + last-5 form.
6. Compositional analysis radar (motion showcase candidate).

---

## Phase D — Cross-cutting learning surfaces

**Goal:** Layer learning-density surfaces onto Match detail, Champion detail, Profile. Each is independently shippable.

Most of these depend on Phase A (extended DTO) or Phase B (timeline). Listed here so the dependency graph is clear, not to imply Phase D is one shippable unit.

### Deliverables (each independent)

1. **Death heatmap** on Champion detail. Accumulated death positions on a Rift map across last 20 games on the champion. Depends on Phase B (kill positions in timeline).

2. **Lane-phase percentile cards** on Champion detail. "You're +18 CS at 10 vs your average +6 on this champ." Depends on Phase B.

3. **Damage profile radar.** Small radar of avg damage / damage taken / vision / CS-per-min, normalized by role. Reusable on Profile + Champion detail. Depends on Phase A (CS, vision).

4. **First-blood / first-tower stats.** Running counter + rate on Profile. Depends on Phase A (challenges block).

5. **Carry games vs carried games.** Split wins by whether you were top-3 in damage share. Calm framing — no pejorative tone. Depends on Phase A.

6. **Objective participation %.** How often you're alive for drake/baron contests. Depends on Phase B.

7. **ARAM-specific metrics.** Pull ARAM out of habits stats; show separate ARAM dashboard on Profile (heal+shield delivered, healing taken, damage tank ratio). ARAM is the most-played queue but currently lumped in. Depends on Phase A (challenges block has ARAM-specific fields).

8. **Build-order delta.** "On your last 5 games as Garen you bought Stridebreaker 2nd; this game you bought it 4th." Champion detail. Depends on Phase B.

9. **Rune-page diversity** on Champion detail. Pie chart of which keystones you've run on this champion + win rate per keystone. Depends on Phase A (perks projection).

10. **Duo / squad detection.** Across many matches, certain non-self puuids recur — that's a duo. Detect them, surface "you and {DuoName} are 22–8 in lane swap games." Shared champion-pair stats. LP graph overlays. Touches both match list rows ("we played together") and Profile (a duo-stats panel). Cross-cutting; depends on the lane-opponent + full-roster data already stored from Phase A. Promoted to Phase D from [vnext-ideas.md](vnext-ideas.md).

### Sequencing

- 3, 4, 5, 9 unlock as soon as Phase A ships (no timeline needed).
- 1, 2, 6, 8 unlock after Phase B ships.
- 7 is independent — can ship anytime after Phase A.
- 10 (duo detection) is independent of A/B but benefits from lane-opponent data (Phase A) being structured rather than just opponent champion strings.

---

## Phase E — polish backlog (deferred)

Things called out elsewhere in this doc as "follow-up" so they don't get lost. None of these are scoped or sequenced — pick from this when there's appetite for polish work.

- **Full rune page panel** on match detail. All 6 runes + 3 stat shards per participant in a side panel, not just the keystone. Visual reference: op.gg's runes tab on a match.
- **Composite "Score-of-game" grade** (S+/S/A/...) as an alternative to the separate-badge approach in Phase A. Only worth picking up if the separate badges read as cluttered in practice.
- ~~**Timeline + map integration** (op.gg-style).~~ **Shipped 2026-05-11 (`db80d95`)** — see Status. The Phase-D.1 follow-on (Rift-position death heatmap on Champion detail) it unblocked also shipped 2026-05-12 (`a1fb10c`).

---

## Cross-cutting concerns

**Cache shape change.** `MatchDetailCache.detail` today stores the projected `MatchDetail`, not the raw Riot payload. Pre-prod, so we simply switch it to raw, drop existing rows, and let backfill re-fetch — no migration shim. After this, every DTO extension is a free re-projection on read.

**Caching keys.** `useMatchDetail` keys on `["lol", "match", matchId]` with infinite staleTime (cf. [use-match-detail.ts](../../apps/web/src/lol/matches/use-match-detail.ts)). Phase B's timeline goes under `["lol", "match", matchId, "timeline"]` — separate query, separate fetch, but same staleTime semantics.

**Reduced motion.** Every new visualization needs a reduced-motion pass. The existing patterns (gating `initial`/`animate` on `useReducedMotion`) cover everything new here. Kill-dot stagger reveals, gold-lead chart drawing, build-order item slide-ins all need the gate.

**Performance budget.**
- Match detail route currently lazy-loads only on visit. Keep it that way — Phase B adds substantial code.
- Build order, kill strip, objective timeline live in the *bottom* of the page; lazy-mount with `IntersectionObserver` if the bundle gets fat. Defer until measurement justifies it.
- No new chunk over 30 KB gzipped without a justification (matches the views-roadmap budget).
- Lighthouse: match detail's CLS and TTI shouldn't regress after Phase B. Skeleton the timeline panels.

**Routing.** New `/lol/$accountSlug/live` route is independent of the existing tab strip — it's not a tab, it's a peer route with a back-link to Profile. Don't add it as a tab; it'd mostly show empty state. The "Live now" chip on Profile is the discovery surface.

**Data freshness vs. Riot rate limits.** Phase C's polling cadence is the only ongoing call cost. 60 s baseline; back off to 5 min if Profile not focused (use `document.visibilitychange`). Critical: do NOT poll when the page is unfocused for more than 5 min — the user has tab-and-forgotten about it.

---

## Open questions / decisions to make before we start

_None outstanding — all five questions resolved (see decision log)._

---

## What to write up afterward

Each of these is a candidate for a long-form case study (one of the README's first-class deliverables):

- **"Selective JSON projection on a 2 MB Postgres column"** — Phase B. The interesting story is: how do you serve a slim DTO derived from a wide JSON blob without round-tripping the bytes? `jsonb_path_query`, projection on read, projector versioning.
- **"Polling Spectator-V5 in a hostile-data environment"** — Phase C. Endpoint that lies, 404s mid-game, returns stale data. Polling cadence + backoff + fairness.
- **"Pre-game prediction: how much can you tell from a champion-select snapshot?"** — Phase C compositional analysis. Static analysis of team comps, with measurement of how often the prediction matches the result. Could be a mini-research piece if we keep score across enough games.
- **"From data to judgment — match-detail edition"** — Phase A score-of-game + lane-phase callouts. Continues the "stats vs. judgments" framing from the views-roadmap write-up.
- **"Rect-based shared-element transitions, applied to a kill strip → minimap morph"** — Phase B.6. Same WAAPI pattern as the match-card morph, applied to a brand-new artifact.

---

## Status

- **Phase A** — shipped. DTO extension (ParticipantDetail, TeamSummary), match header strip (kills/gold/objectives/first-blood/first-tower/soul-drake-with-element), segmented damage bar (physical/magic/true), score-of-game badges, champion level badge + summoner spells + keystone rune on participant rows, CS + vision score with hover tooltips, gold-lead delta in team block heading, lane-opponent on match-list rows with gameName/tagLine + 10-name hover popover. Soul drake derived from timeline (4th non-Elder dragon kill).
- **Phase B** — shipped. Timeline endpoint + cache + projection, build order panel (consumables toggle, lane opponent side-by-side), gold-lead chart, interactive kill/objective event timeline, skill order grid, lane-phase gold/cs differential chart, kill heatmap on Rift minimap. Outstanding (parked): build-order component-collapse-into-completed-item and hover-highlight-components — same family as boot collapse, see decision log.
- **Phase C** — shipped. Server-side `LiveGamePollerService` with SSE push, "Live now" chip on Profile, live match page (5v5 grid with champion icon, summoner spells + keystone via shared icons, per-player rank + mastery cached by `gameId`, last-5 form pips for whitelisted players, bans bar, game timer, queue/map/mode badges, compositional analysis radar, "Game ended" exit state). Lane-sorted participants via Smite + champion-role heuristic (~80% accuracy — Spectator-V5 has no `teamPosition`). Champion level not surfaced — not available in Spectator-V5.
- **Phase D** — partially shipped. **D.10 (duo / squad detection)** v1 shipped 2026-05-10 (`42549b4`): Profile section showing top recurring teammates with W-L + most-played champion. **Champion synergy chord** shipped 2026-05-11 (`dafd316`) as a follow-on to D.10 — new `GET /lol/.../champion-pairs` endpoint aggregates per-match `(yourChamp, teammateChamp)` pairs; `ProfileSynergy` renders a `@visx/chord` bipartite layout (your champ pool on one side, teammates' picks on the other) with ribbon weight = games played together, ribbon color = win rate. **D.1 (death heatmap on Champion detail)** shipped 2026-05-11 (`0fb4720`) as a **minute × matchup** grid rather than position-on-Rift — reads `deathTimings` + `laneOpponent.championName` from `MatchSummary`, no backend changes. Position-on-Rift heatmap is now paired with Phase E (op.gg overlay) since both need event x/y projected onto MatchSummary — better to build together. **D.8 (build-order delta)** shipped 2026-05-11 (`d16b171`) as a `d3-sankey` diagram on Champion detail — new `GET /lol/.../champions/:championKey/build-flow` endpoint intersects timeline `ITEM_PURCHASED` events with `Match.items` final inventory to get completion-order item sequences; Sankey shows item-1 → item-2 → item-3 paths with lift-vs-baseline color encoding. Squad detection (3+ groupings), LP-overlay graphs per duo, match-list highlighting, and the remaining D.2–D.7 items still deferred.
- **Phase E** — partially shipped. **Timeline + map integration** shipped 2026-05-11 (`db80d95`): full-screen modal triggered from the event timelines section, static SVG Rift minimap with kill/objective dots, scrollable event feed two-way-synced to the map, gold-lead chart as scrubber (`GoldLeadBrush` + `BrushTraveller`), filter chips per event type (kills/towers/dragons/heralds/barons/inhibitors/voidgrubs + your-kills-only / your-deaths-only), spring-staggered dot reveals gated on `useReducedMotion`. The paired Phase-D.1 follow-on — **Rift-position death heatmap** on Champion detail — shipped 2026-05-12 (`a1fb10c`) using a new `timeline-summary-mapper` projection that adds death x/y to `MatchSummary` (Prisma migration + `backfill-position-metrics.ts`). Remaining backlog: full rune page panel, composite "Score-of-game" grade.

**Architecture note (2026-05-10):** the user-driven sync paths (cron head sync, manual sync, list-window backfill) now eagerly fetch the Match-V5 timeline alongside the match detail and persist it to `MatchTimelineCache`. This was added for T4 Phase B trends tiles (lane phase prognosis, death timing, comeback resilience) but means that **Phase D items that depend on timeline data are now unblocked sooner** — D.1 (death heatmap on Champion detail), D.2 (lane-phase percentile cards), D.6 (objective participation %), D.8 (build-order delta) all read from the same `MatchTimelineCache` rows that are now populated for new matches automatically. Historical paging stays without timeline fetch (would be 1000+ extra Riot calls per account). For Phase D items that need timelines on older matches, reuse the same `src/scripts/backfill-timeline-metrics.ts` pattern.

---

## Decision log (update as we go)

- **2026-05-09** — roadmap drafted. Pending decisions in the "Open questions" section above. No code changes yet; analysis only.
- **2026-05-09** — pre-prod, so DTO/cache-shape changes are just "drop rows, let backfill re-fetch". No migration shims, no projection-version field. Closed Open Question #1 ("what's in `MatchDetailCache.detail` today") — it's the projected shape; we'll switch it to raw with Phase A.
- **2026-05-09** — phase order locked: A → B (build order + gold lead first) → checkpoint → either C or the rest of B based on appetite.
- **2026-05-09** — runes: keystone only in Phase A. Full rune page (all 6 perks + 3 shards) parked in Phase E backlog as a polish follow-up.
- **2026-05-09** — score-of-game: separate badges in Phase A ("Most damage", "Highest KP", etc.). Composite S+/S/A grade parked in Phase E backlog as a follow-up if separate badges read as cluttered.
- **2026-05-09** — build order in Phase B: render both the user and the lane opponent on a shared time axis. Anti-clutter rules: hide consumables/trinkets/wards by default, collapse boots upgrade into a single tick, components fold into the completed item. ARAM/Arena fall back to single-row.
- **2026-05-09** — Phase C live-view enrichment: opportunistic for all 10 players (rank + mastery), cached per `gameId` so each detected game costs a 21-call burst once. Last-5 form pips stay whitelist-only — computing them for the 9 others would cost 50+ extra Riot calls per game. Affordable in this app's 1-user / 4-account setting; the same approach would not generalize to multi-tenant.
- **2026-05-09** — Phase B chart library decision: visx for the minimap and any non-stock chart shape; Recharts for stock cases. Avoids a Recharts → visx rewrite later (decision sourced from [vnext-ideas.md](vnext-ideas.md)).
- **2026-05-09** — Phase C polling architecture flipped from client-side to **server-side polling + SSE push**. Single source of truth, "Live now" can render on Profile of accounts not currently being viewed, lighter clients. Built on existing `MatchEventsService` SSE infrastructure. Decision sourced from [vnext-ideas.md](vnext-ideas.md).
- **2026-05-09** — Phase D extended with **duo / squad detection** (D.10) — recurring non-self puuids surface as "duo" with shared stats. Promoted from vNext top-tier given low marginal cost on top of Phase A's lane-opponent restructure.
- **2026-05-10** — Phase A + B substantially shipped (see Status above). Phase E: added **Timeline + map integration** followup — op.gg-style scrollable event feed synced to a Rift mini-map, gold-lead scrubber, event-type filters. Full-screen modal triggered from existing event timelines section. All data available from Phase B projection; motion showcase candidate.
- **2026-05-10** — boot collapse in build order (collapsing tier-1 → tier-2 boots into a single upgraded slot) will not be implemented. Requires detecting upgrade relationships across timeline item events and maintaining a boot-item ID map, meaningful complexity for marginal readability gain. The consumables toggle already handles the main clutter concern. Closed as won't-do.
- **2026-05-10** — Phase B build-order **component-collapse-into-completed-item** and **hover-to-highlight-components** parked indefinitely. Same family as boot collapse: requires per-item component-tree resolution from the items dataset and runtime matching against the timeline build events. The consumables toggle + side-by-side opponent layout already deliver the bulk of the "what could I have built differently" learning surface. Closed as won't-do.
- **2026-05-10** — Phase C verified shipped. Lane sort heuristic added on top of the existing live page (Smite for jungle + CDragon champion role tags for the rest, ~80% accuracy). Spectator-V5 confirmed to expose no `teamPosition` and no champion level. Soul drake / dragon element type also unavailable from Match-V5 team objectives — needs Phase B timeline events to resolve, parked.
- **2026-05-10** — D.10 (duo detection) v1 shipped. `GET /lol/.../duos` reads `MatchDetailCache.detail` for the user's recent matches, finds same-team puuids, aggregates by puuid (games / wins / top champion), filters at ≥ 3 games together, returns top 10. Profile component (`ProfileDuos`) renders top 3 between role strip and queue distribution; renders a "you mostly queue solo" empty state when no recurring duo. No new schema/table — pure read off the existing cache. Riot ID gameName/tagLine kept fresh by using the most-recent match per puuid (Riot IDs can change). Deferred follow-ups: squad detection (3+ recurring puuids), LP-overlay graphs per duo, shared champion-pair stats ("you on Lulu + them on Vayne"), match-list highlighting of duo games — each a candidate session.
- **2026-05-10** — Spectator-V5 deactivation announcement (Oct 2025) was partially walked back: the `getCurrentGameInfoByPuuid` endpoint we depend on was reactivated alongside in-client streamer mode. No active deprecation risk to Phase C as of this date.
- **2026-05-11** — Three Phase D items landed (D.1 minute×matchup heatmap, D.8 build-order Sankey) plus the champion-synergy chord as a D.10 follow-on. The shared backend pattern: each is a new `GET …/<route>` on `LolController` that reads existing `Match` / `MatchDetailCache` / `MatchTimelineCache` rows and projects into a slice-specific DTO. No new tables; no Riot calls. **Frontend pattern established**: non-stock viz (heatmap, chord, Sankey) ships in a single Champion-detail tile via `ConclusionCard` evidence slot. `MIN_LINK_GAMES` / `MIN_RIBBON_GAMES` etc. filter weak edges; lift-vs-baseline (not raw 50%) colors links to suppress sample-size noise. visx packages installed: see [library-shortlist.md](library-shortlist.md).
- **2026-05-11** — D.1 design decision: minute-bucket × matchup-champion grid (not Rift-map position heatmap). The Rift-position version is now paired with Phase E (op.gg overlay) — both need timeline event x/y projected onto `MatchSummary` (`deathTimings` has timestamps only today). Stacking them avoids two rounds of backend projection. Plan: Phase E first (single-match overlay on match-detail), then the position-aggregate heatmap on Champion detail falls out as a small follow-up.
- **2026-05-11** — Phase E **Timeline + map integration** shipped (`db80d95`). Single 838-line component ([match-map-overlay.tsx](../../apps/web/src/lol/matches/match-map-overlay.tsx)) lazy-loaded from `MatchEventTimelines`. The minimap is one static SVG with absolutely-positioned `<motion.circle>` dots; feed↔map sync uses `selectedId` state + `feedRefs` map + `scrollIntoView({ block: "nearest" })`. Gold-lead brush is a custom visx `Brush` traveller — clamped to the match's gold-data range so the window can't escape data — and drives `brushStartMin`/`brushEndMin` which `passesFilter` consults to gate both feed and dots. Filter chips use a flat `FilterState` object (per-event-type bools + `yourKillsOnly` / `yourDeathsOnly` exclusivity toggle). Replaced the old `match-kill-map.tsx` inline strip (the modal is now the canonical surface). Motion budget: spring-staggered reveal on open, gated on `useReducedMotion`.
- **2026-05-12** — Phase-D.1 Rift-position follow-on shipped (`a1fb10c`). Added death x/y to `MatchSummary` via the same `timeline-summary-mapper` projection that powered the Phase E overlay (one schema change, two consumers). `backfill-position-metrics.ts` re-projects historical timeline rows; new matches get it through the eager-timeline-sync path documented in the architecture note above. Rendered as a hex-binned heatmap on Champion detail ([champion-position-heatmap.tsx](../../apps/web/src/lol/champions/champion-position-heatmap.tsx)). Closes the original D.1 ask (Rift-position heatmap was the rejected first design before the minute×matchup grid landed) — both forms now exist on Champion detail.
