# vyoh.gg — App state analysis & improvement plan

Last fresh read: 2026-05-13. Captures what the LoL section looks like today, what's carrying the app, what the structural gap is, and where the next arcs should land. Read this when scoping a new feature arc or when deciding whether a Champions-tab renovation is the right next move (spoiler: probably not the *first* move).

This is a living analysis. Re-sort the priorities when something on the ground changes.

---

## Premise

The LoL section is now substantial — five tabs, a recap surface, a live page, deep match detail, and a dossier-grade champion detail. Most surfaces speak prescriptively (verdict + evidence + optional prescription via `ConclusionCard`). That pattern is the differentiator.

The thing the app does *not* yet do — and the central architectural gap — is treat **champion identity as navigable across the whole app**. Every other tab mentions champions; only the Champions tab can take you to one. The Champions list page is the visible symptom (a sort table in an app of verdicts), but the underlying problem is bigger than one tab.

Earlier framing of this doc (2026-05-10) led with "Champions tab is the weakest surface, fix it." That's true but narrow. The reframe lands at: *make champion identity a first-class navigable entity, then decide whether the Champions list needs renovation at all.*

---

## Inventory — what exists today

### Profile — `/lol/$accountSlug`

[`routes/lol/$accountSlug/index.tsx`](../../apps/web/src/routes/lol/$accountSlug/index.tsx)

Identity-first dashboard with ~12 blocks: rank tiles, live chip, pregame ritual (form / tilt / time slot / top champ), recent form, LP history with brush + tier markers + streak overlay, season history, now playing (top 3 last 7d), role strip, duos, queue distribution, activity calendar, stats bar, recap link.

**Read:** the strongest surface. Dashboard-before-queue is the right frame.

### Trends — `/lol/$accountSlug/trends`

[`routes/lol/$accountSlug/trends.tsx`](../../apps/web/src/routes/lol/$accountSlug/trends.tsx)

12 tiles, activation-priority sorted, all using `ConclusionCard`: weekly review, time heatmap, WR trajectory, day-of-week WR, role performance, tilt, game length, champion focus, LP economy, session fatigue, worst matchup, KDA. Magazine-grid reflow on range change (motion flagship). Patch-aware (boundaries shaded, "this patch vs last patch" range option).

**Read:** the most distinctive surface. Verdict-first reads like analysis, not a dump.

### Matches — `/lol/$accountSlug/matches`

[`routes/lol/$accountSlug/matches/`](../../apps/web/src/routes/lol/$accountSlug/matches/)

Infinite-scroll list with queue filter, per-row hover popover, `layoutId` card morph into detail. Match detail: hero strip (kills/gold/objectives/first-blood/first-tower/soul drake), segmented damage bars, score-of-game badges, lane-opponent linkage, build/skill order with consumables toggle and lane-opponent side-by-side, gold-lead chart, interactive kill/objective timeline, kill heatmap on Rift minimap, lane-phase gold/cs differential.

**Read:** detail depth beats op.gg-class tools. Kill map + lane phase reads especially.

### Live — `/lol/$accountSlug/live`

Server-side `LiveGamePollerService` + SSE push. 5v5 grid with summoner spells, keystone, per-player rank + mastery cached by `gameId`, last-5 form pips for whitelisted players, bans bar, queue/map/mode badges, compositional radar, lane-sorted via Smite + champion-role heuristic. Live-now chip renders on Profile even when the account isn't being viewed.

**Read:** real differentiator. Not many companion apps have a server-driven live surface.

### Champion detail — `/lol/$accountSlug/champions/$championKey`

[`routes/lol/$accountSlug/champions/$championKey.tsx`](../../apps/web/src/routes/lol/$accountSlug/champions/$championKey.tsx) — **544 lines**.

Hero card with stats, K/D/A averages, delta tiles vs account average, WR sparkline with patch boundaries, top items with tooltips, matchups with 3 sort modes, time heatmap + tilt scoped to champion, patch history strip, **death matchup heatmap** (visx, minute × matchup), **build-order Sankey** (d3-sankey), **Rift position heatmap** (hex bins), build-flow endpoint, "This patch X.Y" badge, sticky champion strip on scroll.

**Read:** dossier-grade. Probably the densest single page in the app.

### Champions list — `/lol/$accountSlug/champions`

[`routes/lol/$accountSlug/champions/index.tsx`](../../apps/web/src/routes/lol/$accountSlug/champions/index.tsx) — **82 lines**.

Sortable cards (games / WR / KDA / playtime), `useSeriousMatches` (silently ARAM-filtered), no role tag, no role/queue filter, no verdict.

**Read:** by a 6.6× ratio, the dossier dwarfs the list it lives behind. **The visible weakness in the app today.**

### Recap — `/lol/$accountSlug/recap`

Three hero sections: rank arc, headline champion (with splash polish 2026-05-11), top insight. Linked from Profile only — deliberately positioned as an "open this artifact" surface rather than a tab.

**Read:** thin. Promised more on first read; works as a calm-Wrapped MVP, would feel undersold if shown on a portfolio page.

---

## What's working well (keep doing)

- **`ConclusionCard` (verdict → evidence → prescription)** is the differentiator and is consistently applied across Trends and parts of Profile. Single most distinctive pattern in the app.
- **Activation-priority sort** on Trends — inactive tiles drop down rather than disappearing. Mirrors "show me what I have data for."
- **Single windowed query at layout level** ([`$accountSlug.tsx`](../../apps/web/src/routes/lol/$accountSlug.tsx)) → tab switches cost nothing upstream; memoised provider value avoids fan-out.
- **Per-view queue scope** — performance views read serious-queues only, identity/cadence views read everything, match list owns its own filter. Right call per surface.
- **Layout architecture** — sticky header with compact mode, splash backdrop hover-debounced, layoutId morphs from list to detail. Motion stack pulls real weight.
- **SSE invalidation** — list lights up when the backfill worker reports new rows; no polling on the client.
- **Empty-state primitive across 8 surfaces** — calm, consistent, lifts the tonal bar everywhere it lands.

---

## The structural weakness — one-way champion identity

Every surface in the app mentions champions; almost none of them link to the champion detail page.

| Surface | Mentions champion? | Links to champion detail? |
|---|---|---|
| [Match row](../../apps/web/src/lol/matches/match-row.tsx) | Yes — every row | **No** (imports `useChampionName` but no `Link`) |
| [Match detail participants](../../apps/web/src/lol/matches/match-detail-view.tsx) | Yes (incl. you) | **No** |
| [Profile Now Playing](../../apps/web/src/lol/profile/profile-now-playing.tsx) | Yes — top 3 | **No** |
| [Profile Pregame Ritual](../../apps/web/src/lol/profile/profile-pregame-ritual.tsx) | Yes — most played | **No** |
| [Trends Champion Focus](../../apps/web/src/lol/trends/trend-champion-focus.tsx) | Yes — bars | **No** |
| [Trends Worst Matchup](../../apps/web/src/lol/trends/trend-worst-matchup.tsx) | Yes — both names | **No** |
| [Profile Synergy chord](../../apps/web/src/lol/profile/profile-synergy.tsx) | Yes — bipartite layout | **No** |
| [Recap hero champion](../../apps/web/src/lol/recap/recap-champion.tsx) | Yes — headline | **No** |
| Champions list rows | Yes | Yes |

The most natural entry point to "tell me about my Lux" is a Lux match row. It doesn't work. The Champion detail page is dossier-grade — and it's only reachable from one place.

This is the larger problem. The Champions list weakness is a *symptom* — it looks underbuilt because it's the only way to reach the dossier, so people expect it to carry the whole "talk about my champions" weight.

---

## The tactical weakness — Champions list reads as a table, not a verdict surface

Even with the cross-link gap closed, the list page would still be the only surface in the app without prescriptive language:

- Trends: "Wide pool — consider focusing on 3 to climb faster."
- Pregame: "On a 3-game loss streak", "Off-peak hour for you — 38% WR at Tue 23:00."
- Champion detail: "Patch 14.20: 2-8, +X% from 14.19."
- Champions list: *"Aurelion Sol — 12 games, 50% WR, 3.2 KDA."*

The data exists for at least three headline verdicts:
- **Workhorse:** "Your most-leaned-on champion is X — n games, WR%, ±KDA delta"
- **Pool focus:** "Tight pool / focused / balanced / versatile" (lifted from [`trend-champion-focus.tsx`](../../apps/web/src/lol/trends/trend-champion-focus.tsx))
- **Pool drift (last 14d vs prior 14d):** "You've added Y, dropped Z"

The drift verdict is the most valuable of the three — it's not duplicated anywhere else, and it's the kind of "this site noticed something I didn't" moment the app trades on.

Other list shortcomings, in descending importance: no role split (Lux mid vs Lux sup is two players, [`MatchSummary.teamPosition`](../../packages/shared/src/lol/) is available), no queue filter (mismatched with Matches and Trends), hard-coded `useSeriousMatches` silently drops ARAM.

---

## Broader app gaps (not Champions-specific)

In rough priority by visible/portfolio payoff:

### 1. Post-game close-the-loop surface

Pregame Ritual is excellent. There's no after-game read: *"that game broke your streak"*, *"you usually go -X% after a 30+ minute loss"*, *"your next game is Tue 23:00 — your weakest slot."* Data and verdict pattern already exist; SSE already pushes new-match notifications to the client. This is **the highest-payoff missing surface** — completes the calm-coaching arc and reuses every primitive we already have. Cheap, visible, narratively important.

### 2. Composite LP forecast tile

Form, time-slot, top-champ, and tilt are computed independently. Composing them into one verdict (*"Composite read for your next ranked: +X expected LP — confidence Y"*) would be a strong differentiator. All four inputs already exist — only the composition is missing. Naturally lives in Pregame Ritual or as a sibling tile.

### 3. Champion-pool drift verdict

Trends shows current pool composition, not "you've stopped playing X" / "you've added Y this month." Both readable from the windowed data with a 14d-vs-prior-14d diff. Doubles as the headline ConclusionCard for the Champions list.

### 4. Mastery / reputation pull

Riot exposes mastery scores. Not used. Cheap addition, useful for the dossier framing of Champion detail ("365k mastery, level 7"). Mainly a quality move, not portfolio-flashy on its own.

### 5. Recap density expansion

Three sections is too thin if recap is to be presented as a portfolio artifact. Candidates: month-by-month rank arc, top-3 champions in the year (not just one), most-improved-on champion, worst patch / best patch verdict, signature game (highest KDA or biggest comeback), duo of the year. Tied to the share-image and scrollytelling polish that was deferred from the 2026-05-10 cluster.

### 6. Multi-account compare

Multi-account is supported structurally; comparing two accounts side-by-side isn't a surface. Smurf vs main, EU vs NA. Heavier lift but leans into the architecture story.

### 7. Live tab pull-weight

Prominent in the tab strip (red pulsing icon). Worth a single audit pass to confirm depth justifies the position, or trim if not.

---

## Recommended phasing

Reframed around the structural gap, not the Champions tab.

### Phase 1 — Cross-link champion identity (single session)

Wrap [`ChampionSquareIcon`](../../apps/web/src/lol/_shared/champion-square-icon.tsx) usages in a `Link` to `/lol/$accountSlug/champions/$championKey` from:

- Profile Now Playing
- Profile Pregame Ritual ("Most played" tile)
- Profile Synergy chord ribbons
- Trends Champion Focus bars
- Trends Worst Matchup champion names
- Recap hero champion
- Match detail participant rows (every participant — landing on *your* view of *your* data for an enemy champion is the right read for "I lost to Yasuo, check my matchup")
- Match row left chrome (last — needs nested-link handling, stop event propagation; existing card morph stays untouched)

Lands a structural shift in how the whole app navigates without renovating any tab. **The single highest-leverage move on the board.** Self-contained, demoable, easy to write up.

#### Phase 1 — execution brief (next-session handoff)

Goal: turn every champion icon in the app into a portal to `/lol/$accountSlug/champions/$championKey`. No visual change to the icons themselves; only the click target and cursor.

**Destination route.** `/lol/$accountSlug/champions/$championKey`. TanStack Router `Link` pattern — mirror an existing call site at [`apps/web/src/lol/champions/champion-table.tsx`](../../apps/web/src/lol/champions/champion-table.tsx) for the working syntax. `championKey` is the string Riot champion key (e.g. `"Vex"`), not the numeric id.

**Surfaces, in order.** Do the simple ones first to lock in the pattern; do match-row last because it has nested-link handling.

| # | File | Notes |
|---|---|---|
| 1 | [`profile-now-playing.tsx`](../../apps/web/src/lol/profile/profile-now-playing.tsx) | Already imports `useChampionName` from `@/lol/champions/use-champions`; account slug is available from the route param. |
| 2 | [`profile-pregame-ritual.tsx`](../../apps/web/src/lol/profile/profile-pregame-ritual.tsx) | "Most played" tile in `buildChampionSignal`. Wrap the icon inside the tile, not the whole tile. |
| 3 | [`profile-synergy.tsx`](../../apps/web/src/lol/profile/profile-synergy.tsx) | Chord ribbon endpoints — your champ and the teammate's champ both link. visx may have its own pointer handling on the ribbon; verify cursor/click region after wrap. |
| 4 | [`trend-champion-focus.tsx`](../../apps/web/src/lol/trends/trend-champion-focus.tsx) | Champion bars; wrap each bar's icon area. |
| 5 | [`trend-worst-matchup.tsx`](../../apps/web/src/lol/trends/trend-worst-matchup.tsx) | Both names per row (your champ + opponent). Both link. |
| 6 | [`recap-champion.tsx`](../../apps/web/src/lol/recap/recap-champion.tsx) | Hero champion. The whole hero card may already morph; wrap only the icon glyph, not the card. |
| 7 | [`match-detail-view.tsx`](../../apps/web/src/lol/matches/match-detail-view.tsx) | Participant rows. Link from *every* participant icon (not just self) — that's the dossier-from-anywhere story. |
| 8 | [`match-row.tsx`](../../apps/web/src/lol/matches/match-row.tsx) | **Last and trickiest.** The card itself is a `Link` to match detail with a `layoutId` morph. Nested `<a>` is invalid HTML; the morph is the most visible motion piece in the app and must not regress. See decision below. |

**Match-row design decision.** Two viable approaches; pick after looking at the actual JSX:

- **Sibling-`Link` overlay** *(probably cleanest):* the outer card stays as a `<Link>`, but the champion-icon container is a *sibling* `<Link>` absolutely-positioned over the icon area. Outer link still fires for any click outside the icon. No nested-link, no event-propagation gymnastics.
- **`onClick` + `stopPropagation`:** the icon becomes a `<button>` or `<div role="link">` with `onClick={e => { e.stopPropagation(); router.navigate(...); }}`. Works but loses native `Link` semantics (middle-click, right-click → open in new tab, hover URL preview).

Lean sibling-overlay unless the absolute positioning fights the existing card layout.

**Verify after each surface.**

- Click → routes to champion detail.
- Cursor shows pointer over the icon area only (not the full row/card unless that's already the case).
- Existing morphs and hovers on the surrounding component still work — especially match-row card morph and match-detail participant-row hover popover.
- Keyboard tabbing reaches the new link and Enter activates it.
- No console warnings about nested `<a>` tags, particularly after touching match-row.

**Out of scope for Phase 1** (do not bundle in):

- Renaming "Champions" → "Dossier" — defer to a follow-up after Phase 1 lands.
- Role / queue filters on the Champions list — Phase 3 in this doc.
- Champion-pool drift verdict — Phase 3.
- Recent-matches section on Champion detail — descoped (less needed once cross-linking exists).

**Validation before commit.** `tokf err pnpm run check:cc` then `tokf err pnpm run typecheck:cc`. Don't run mutating commands. Test the match-row morph in the browser before committing surface #8 — TypeScript will not catch a layout regression.

**Commit scope.** One commit is fine; two is cleaner (surfaces #1–#7 in one commit, match-row alone in a second so it can be reverted independently if the motion regresses). Conventional commit per house rules: lowercase, no scope parens, no Co-Authored-By. Suggested: `feat: cross-link champion icons to champion detail`.

#### Alternative — start with Option B (post-game PG1)

If appetite is for the showpiece rather than the foundation, swap to [`post-game-close-the-loop.md`](post-game-close-the-loop.md) Phase PG1 instead. Single static section on Profile paired with Pregame Ritual, no SSE awareness yet, 1–2 sessions. Higher visible payoff per session; cross-link can ship after (Option A then lifts the post-game card's "back to the dossier" path).

Trade-off recorded: Option A first is the recommendation because it makes every existing surface (and the upcoming post-game card) feel like one app. Option B first is defensible if the next session needs to *land a new thing* rather than *connect existing things*. Either order works.

#### Adjacent maintenance (sub-session each, parked for any cleanup pass)

- **Verify SSE refresh-progress shipped.** [`riot-investigation-2026-05-07.md L97–101`](riot-investigation-2026-05-07.md) parks "SSE for refresh button progress" as a follow-up; commit `00d085c feat: live status dashboard with sync controls` likely covers it. ~10-minute check: read the live-status-dashboard implementation, confirm per-account streaming feedback is live, update the riot-investigation note to mark the follow-up shipped (or keep it parked if only partial).
- **Delete stale `feedback_visx_minimap` reference.** [`vnext-ideas.md L224`](vnext-ideas.md) references a memory file that doesn't exist (only `feedback_network_hang_simulation.md` is in `/home/node/.claude/projects/-workspaces-vyoh-gg/memory/`). 30 seconds — strike the sentence "`feedback_visx_minimap` memory should be updated to reflect that visx is now installed and used." from the 2026-05-11 visx decision-log entry.
- **Host-Chrome perf re-measurement.** [`perf-baseline.md L81`](perf-baseline.md) parks a Profiler re-measurement of the MatchWindowProvider + ChampionsPage memoization fixes; the fixes shipped static-only and the validation is pending a host-Chrome session (the devcontainer has no Chrome). Not a coding task — do it the next time you're at the host machine and update the note.

### Phase 2 — Post-game close-the-loop ✅ shipped 2026-05-13 (PG1–PG3)

Section live on Profile, paired with Pregame Ritual. Four signals (outcome, game-shape or champion-read, baseline, tilt forecast) with SSE-driven win/loss-tinted pulse on new-match arrival. Game-shape signal reads `teamGoldDiffAt15` for lane-phase/comeback framing, gated on the timeline-projected sentinel.

PG4 (peer-route artifact at `/lol/$accountSlug/post-game/$matchId` for share-friendly per-game Wrapped) intentionally deferred to v2. See [`post-game-close-the-loop.md`](post-game-close-the-loop.md) for detail.

This is the move that *would* land as a portfolio case study ("a calm coaching surface that closes the loop after every game") — the strongest current case-study candidate.

### Phase 3 — Champions list as a verdict surface (1 session) — **shipped 2026-05-13**

Three additions, in order:
1. **Champion-pool drift verdict** as the list's headline ConclusionCard (also satisfies broader-gap #3). Shipped `524acb5`.
2. **Role-aware aggregation + role chip on each row** — champion rows split by `(champion, teamPosition)`, primary role keeps the shared `champ-card-{champion}` layoutId for the detail-page morph. Shipped `492d301`.
3. **Role filter strip** on the Champions list (`?role=` search param, icons-only toggle via `ROLE_ORDER`). Shipped `f076c4b`.

**Descoped during execution:**
- The queue filter that originally sat alongside the role strip was removed before commit. Layering a per-page queue picker on top of `filterToSerious` is a footgun (non-serious queues get stripped before the picker runs, yielding an empty page on e.g. ARAM). The serious-queues popover in the account header is the single queue control for analytical surfaces; this is now documented as a JSDoc note on `QueueFilter` itself. As a corollary, the serious-queues icon is now hidden on the Matches subtree — Matches is a browse surface that doesn't consume that preference, so the icon was implying behaviour it doesn't have.
- Pulling `trend-champion-focus` to Champions was descoped — `trend-champion-focus` and `champion-pool-drift` answer different questions (current shape vs. fortnight delta) and both surfaces keep their slot.

After Phase 1 cross-linking lands, this becomes a refinement rather than a rescue. The original "Champions detail compare-mode" and "aggregated build progression" moves are descoped — both are now mostly delivered by the Sankey + position heatmap that shipped 2026-05-11.

### Phase 4 — Composite LP forecast (1 session)

Tile that composes the four existing pregame signals into a single verdict + confidence. Lives next to Pregame Ritual on Profile. New tile, no schema changes.

### Phase 5 — Recap density expansion (1–2 sessions)

Add 3–5 sections (most-improved champion, signature game, worst/best patch, duo of the year). Decide whether to invest in share-image and scrollytelling polish from the original 2026-05-10 deferral.

### Phase 6 (optional) — Mastery integration, multi-account compare, live audit

Cherry-pick when appetite for visible work is low or the portfolio story needs a "I integrate new data sources" beat.

---

## Status

- **Reframed 2026-05-13.** Original 2026-05-10 plan was Champions-tab-centric; superseded by the cross-link/dossier framing above.
- **Phase 1 (cross-link champion identity) shipped 2026-05-13** (commits `9846a01`, `8596278`). All eight surfaces now navigate to champion detail.
- **Phase 2 (post-game close-the-loop) shipped 2026-05-13** (commits `a7f3299`, `3007552`). PG1+PG2+PG3 live; PG4 deferred.
- **Phase 3 (Champions list as verdict surface) shipped 2026-05-13** (commits `524acb5`, `492d301`, `f076c4b`). Drift card + role-split rows + role filter strip; per-page queue filter descoped (see Phase 3 note above).
- **Champion detail depth shipped 2026-05-11** (death heatmap, build Sankey, position heatmap) and **empty-state pass shipped 2026-05-11** — both deepened the dossier without changing the navigation graph. Made Phase 1 (cross-linking) more valuable, not less.

---

## Cross-cutting moves (sized roughly)

| Move | Size | Notes |
|---|---|---|
| Cross-link champion identity (Phase 1) | S | ✅ shipped 2026-05-13. |
| Post-game close-the-loop | M | ✅ PG1–PG3 shipped 2026-05-13. PG4 deferred. |
| Composite LP forecast tile | M | Composition only; no new data. |
| Champion-pool drift verdict | S | 14d-vs-prior-14d diff over windowed data. |
| Champions list role/queue filters | S | Mirror Matches/Trends. |
| Mastery pull | S | New Riot endpoint, cached on backend. |
| Recap density expansion | M | 3–5 sections; share-image still deferred. |
| Multi-account compare | L | New view; lean into architecture story. |
| Live tab audit | S | Read-only review pass. |

---

## Connections to existing notes

- [`views-roadmap.md`](views-roadmap.md) — Profile + Champion detail roadmap. Phases 1–6 ✅ shipped. Phase 4 (LP history) and Phase 5 (Season history) are code-complete with rendering still pending real data accrual.
- [`trends-rework.md`](trends-rework.md) — T1–T4 ✅ shipped. Read before reordering Phase 3 (pulling `trend-champion-focus` up to Champions list).
- [`match-depth-roadmap.md`](match-depth-roadmap.md) — Phase A/B/C ✅ shipped, D partial. Match-row champion icon cross-link (Phase 1 above) ties to match-row layout.
- [`motion-backlog.md`](motion-backlog.md) — post-game close-the-loop and LP forecast tile are motion-showcase candidates.
- [`vnext-ideas.md`](vnext-ideas.md) — broader-app gap items (#1–7) overlap with vNext top-tier and second-tier entries.
- [`case-study-topics.md`](case-study-topics.md) — Phase 2 (post-game close-the-loop) is the strongest case-study candidate among items in this doc.

---

## Open questions

1. **Champions tab rename?** "Dossier", "Pool", "Champions" — Phase 1 has landed, so the tab is now the dossier index, not a list. Worth a rename.
2. **Post-game surface placement** — resolved to Option C (static Profile section + SSE pulse). PG4 (peer-route artifact) remains open as a v2 promotion if the framing proves out.
3. **Cross-link match-row icon — modal vs full nav?** Resolved during Phase 1: sibling-Link overlay pattern (champion link covers the splash strip, match-detail link covers the rest). Morph preserved.
4. **Pool-drift window?** 14d-vs-prior-14d is the obvious default. Range selector adds complexity; defer.
5. **Composite LP forecast confidence model?** Naive (equal weight on form/time/champ/tilt) vs. a tiny linear fit on the user's own history. The latter is more honest but needs months of LP-history snapshots to be meaningful — defer the fit until data accrues.
