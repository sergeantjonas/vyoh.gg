# vyoh.gg — App state analysis & improvement plan

Honest read on where the LoL surface stands as of 2026-05-10. Captures what's working, what's weak (Champions tab specifically), where cross-page connections are missing, and the broader app-level gaps. Read this when scoping the next arc of work or deciding which Champions improvement to land first.

This is a living analysis, not a contract. Treat the priority ranking as a starting point — re-sort when something on the ground changes.

---

## TL;DR

- The app's strongest tabs (Profile, Trends) tell a **story**. Champions is the weakest because it's still a list page in an app that's otherwise narrative.
- The Champions module owns *zero* prescriptive language while the rest of the app is full of it.
- Champion identity flows *into* the Champions tab from its own list and almost nowhere else — every other surface mentions champions but doesn't link to the dossier.
- Closest single high-impact slice: headline ConclusionCard on the Champions list + cross-link every champion icon in the app to the detail page. Together they reframe Champions from "table" to "dossier you can land on from anywhere".

---

## Inventory — what exists today

### Profile tab — `/lol/$accountSlug`

[`routes/lol/$accountSlug/index.tsx`](apps/web/src/routes/lol/$accountSlug/index.tsx)

Identity-first dashboard with twelve+ blocks:

- Rank tiles, Live game chip
- Pregame Ritual (4 signals: form, tilt, time slot, top champion last 14d)
- Recent form, LP history, Season history
- Now Playing (top 3, last 7d)
- Role strip, Duos, Queue distribution
- Activity calendar, Stats bar (games, WR, KDA, champs, time)
- Recap link

**Read:** This is the strongest surface. It reads like "the dashboard you'd open before queueing".

### Matches tab — `/lol/$accountSlug/matches`

[`routes/lol/$accountSlug/matches/`](apps/web/src/routes/lol/$accountSlug/matches/)

- Infinite-scroll match list with queue filter
- Per-row hover popover, layoutId card morph into match detail
- Match detail: hero, kill map, build/skill order, lane phase, gold lead, event timelines

**Read:** Detail depth beats op.gg-class tools. Kill map and lane-phase reads especially.

### Trends tab — `/lol/$accountSlug/trends`

[`routes/lol/$accountSlug/trends.tsx`](apps/web/src/routes/lol/$accountSlug/trends.tsx)

12 tiles, activation-priority sorted:

- Weekly review, Time heatmap, WR trajectory, DOW WR, Role performance, Tilt indicator, Game length, Champion focus, LP economy, Session fatigue, Worst matchup, KDA

Each tile uses [`ConclusionCard`](apps/web/src/lol/trends/_shared/conclusion-card.tsx) (verdict + evidence + optional prescription).

**Read:** The most distinctive surface. The verdict pattern reads like analysis, not a metrics dump. Portfolio gold.

### Champions tab — `/lol/$accountSlug/champions`

List: [`routes/lol/$accountSlug/champions/index.tsx`](apps/web/src/routes/lol/$accountSlug/champions/index.tsx)
Detail: [`routes/lol/$accountSlug/champions/$championKey.tsx`](apps/web/src/routes/lol/$accountSlug/champions/$championKey.tsx)
Module: [`lol/champions/`](apps/web/src/lol/champions/)

- **List:** sortable cards (games / WR / KDA / playtime), aggregated over last N games. `useSeriousMatches` — silently ARAM-filtered.
- **Detail:** hero card with stats, K/D/A averages, delta tiles vs account average, WR sparkline, top items, matchups (3 sort modes), time heatmap + tilt scoped to the champion.

**Read:** Detail page is solid in isolation. List page is the weakest surface in the app — see next section.

### Live tab — `/lol/$accountSlug/live`

Differentiator vs. competitors. Depth not audited in this pass; worth a separate review.

### Recap — `/lol/$accountSlug/recap`

Three components only ([`recap-champion`](apps/web/src/lol/recap/recap-champion.tsx), [`recap-top-insight`](apps/web/src/lol/recap/recap-top-insight.tsx), [`recap-rank-arc`](apps/web/src/lol/recap/recap-rank-arc.tsx)). Linked from Profile but feels thin compared to the rest.

---

## What's working well (keep doing)

- **ConclusionCard pattern** is the differentiator. Verdict → evidence → optional prescription is a much better read than raw charts. Use it more places.
- **Activation-priority sort** in Trends is clever — inactive tiles drop down rather than disappearing. Mirrors the "show me what I have data for" instinct.
- **Single windowed query at layout level** ([`$accountSlug.tsx:141`](apps/web/src/routes/lol/$accountSlug.tsx#L141)) → tabs cost nothing upstream.
- **Per-view queue scope** — performance views consume `useSeriousMatches`, identity/cadence views consume everything, match list owns its own filter. Right call.
- **Layout architecture** — sticky header with compact mode, splash backdrop hover-debounced, layoutId morphs from list to detail. The motion stack pulls real weight.
- **SSE invalidation** — list lights up when the backfill worker reports new rows. No polling.

---

## Where it's weakest — Champions tab

The user's instinct is right. Concrete reasons:

### 1. No verdict layer

Every other surface speaks prescriptively:

- Trends: "Wide pool — consider focusing on 3 to climb faster."
- Pregame: "On a 3-game loss streak.", "Off-peak hour for you — 38% WR at Tue 23:00."
- Profile: every block frames data as a signal.

The Champions list says: "Aurelion Sol — 12 games, 50% WR, 3.2 KDA". No headline, no `"your real workhorse is X"`, no `"you've stopped playing Y"`, no `"this pick has the highest delta vs your account average"`. The raw data already supports all three.

### 2. Structural overlap with Trends Champion Focus

[`trend-champion-focus.tsx`](apps/web/src/lol/trends/trend-champion-focus.tsx) computes "tight pool / focused / balanced / versatile" with top-3 share. That insight belongs at the *top* of the Champions tab, not buried in the Trends grid. Right now the Champions tab is the only one that doesn't own its own headline — and the headline already exists, just in the wrong place.

### 3. No role / queue dimension

`MatchSummary.teamPosition` exists and is used in [`trend-role-performance.tsx`](apps/web/src/lol/trends/trend-role-performance.tsx). Champions ignores it. A user who plays Lux mid vs Lux sup is two different players. The list has:

- No role tag on rows
- No role grouping or filter
- No queue filter

Mismatched with Matches (queue filter) and Trends (range selector). Champions has only sort.

### 4. Hard-coded `useSeriousMatches`

[`champions/index.tsx:25`](apps/web/src/routes/lol/$accountSlug/champions/index.tsx#L25) silently drops ARAM. Right default for KDA reads, wrong default for "playtime" sort. Other views surface this scope as a setting; Champions hides it.

### 5. Detail page is good but disconnected

[`$championKey.tsx`](apps/web/src/routes/lol/$accountSlug/champions/$championKey.tsx) has matchups, top items, sparkline, deltas, time heatmap, tilt — substantial. What's missing:

- **No list of recent matches on this champion** linking back to match detail. Data is right there in `champMatches` (already computed at line 134–137).
- **No build-progression view.** [`match-build-order.tsx`](apps/web/src/lol/matches/match-build-order.tsx) exists per-match but is never aggregated.
- **No role split** when a champion is played in multiple lanes.
- **No comparison** beyond two delta tiles. Two columns ("your Vex vs your Ahri") would be a strong motion piece using FLIP.
- **No "stopped playing" framing** — the inverse of "now playing".

---

## Cross-page connection gaps

This is the larger structural issue and ties directly to the user's concern. Champion identity flows *into* Champions and almost never *out*:

| Surface | Mentions champion? | Links to champion detail? |
|---|---|---|
| [Match rows](apps/web/src/lol/matches/match-row.tsx) | Yes — every row | **No** |
| [Match detail participants](apps/web/src/lol/matches/match-detail-view.tsx) | Yes (incl. you) | **No** (verify) |
| [Profile Now Playing](apps/web/src/lol/profile/profile-now-playing.tsx) | Yes — top 3 | **No** |
| [Profile Pregame Ritual](apps/web/src/lol/profile/profile-pregame-ritual.tsx) | Yes — most played | **No** |
| [Trends Champion Focus](apps/web/src/lol/trends/trend-champion-focus.tsx) | Yes — bars | **No** |
| [Trends Worst Matchup](apps/web/src/lol/trends/trend-worst-matchup.tsx) | Yes — both names | **No** (verify) |
| Champions list rows | Yes | Yes |

The most natural entry point to "tell me about my Lux" is from a Lux match row. It doesn't work. The Champions tab should be the dossier you can land on from any champion icon in the app. Right now it's a destination you have to navigate to deliberately from the tab strip.

---

## Other gaps in the broader app

In rough priority order:

### 1. No post-game close-the-loop surface

Pregame Ritual is excellent. There's no "after-game read" — `"that game broke your streak"`, `"you usually go -X% after a 30+ minute loss"`, `"your next game is Tue 23:00 — your weakest slot"`. Data and verdict pattern already exist. Cheap to add, big payoff.

### 2. No LP / rank forecast

Form, time-slot, top-champ, and tilt are computed independently. Composing them into one tile (`"Composite read for your next ranked: +X expected LP — confidence Y"`) would be a strong differentiator. The inputs already exist; only the composition is missing.

### 3. No champion-pool drift

Trends shows current pool composition, but not "you've stopped playing X" or "you've added Y this month" — both readable from the windowed data with a simple before/after diff. Would also fix the "Champions list has no story" problem.

### 4. No mastery / reputation pull

Riot exposes mastery scores. Not used. Cheap addition, useful for the dossier framing of Champions ("365k mastery, level 7").

### 5. No multi-account compare

Multi-account is supported structurally; comparing two accounts side-by-side isn't a surface. Would lean into the architecture story.

### 6. Recap density

[`lol/recap/`](apps/web/src/lol/recap/) is three components. If it's a portfolio piece it deserves more density; if not, the Profile link from [`index.tsx:43`](apps/web/src/routes/lol/$accountSlug/index.tsx#L43) is overselling it.

### 7. Live tab pull-weight

Prominent in the tab strip (red pulsing icon). Worth auditing whether depth justifies position.

---

## Concrete moves — Champions, ranked by impact

### High impact, low risk

**1. Headline ConclusionCard on the Champions list.**

Pull `TrendChampionFocus` logic up. Verdict spans:

- Workhorse — `"Your most-leaned-on champion is X — n games, WR%, ±KDA delta"`
- Pool focus — `"Tight pool / focused / balanced / versatile"`
- Drift (last 14d vs prior 14d) — `"You've added Y, dropped Z"`

Remove the duplicate from the Trends grid (the activation-priority sort will absorb the freed slot).

**2. Cross-link every champion icon in the app.**

Wrap [`ChampionSquareIcon`](apps/web/src/lol/_shared/champion-square-icon.tsx) usages in a `Link` to `/lol/$accountSlug/champions/$championKey` from:

- [`match-row.tsx`](apps/web/src/lol/matches/match-row.tsx) (left chrome — needs care, the row is already a Link to match detail)
- [`profile-now-playing.tsx`](apps/web/src/lol/profile/profile-now-playing.tsx) row
- [`profile-pregame-ritual.tsx`](apps/web/src/lol/profile/profile-pregame-ritual.tsx) "Most played" tile
- [`trend-champion-focus.tsx`](apps/web/src/lol/trends/trend-champion-focus.tsx) bars
- [`trend-worst-matchup.tsx`](apps/web/src/lol/trends/trend-worst-matchup.tsx) names
- Match detail participant rows (when the participant is the user)

Match-row needs nested-link handling — wrap only the icon area, stop event propagation. Existing card morph stays untouched.

### High impact, medium effort

**3. Role + queue filters on the Champions list.**

Mirror Matches/Trends. Surface scope; show role chip on each row (most-played role for that champion). Reuse [`QueueFilter`](apps/web/src/lol/_shared/queue-filter.tsx) + the existing role tokens from Trends.

**4. "Recent matches" section on champion detail.**

Mini-rows linking to match detail. Use existing `MatchRow` styling but stripped down (no champion chrome — they're all the same champion).

**5. Per-role split on champion detail.**

Tabs or pills for `mid / sup / both` when a champion is played in multiple lanes. Most metrics already accept a filtered match list — feed them the role-filtered slice.

### High impact, higher effort (portfolio motion piece)

**6. Compare-mode on champion detail.**

Pick a second champion from your pool, render two columns of the same metric blocks. FLIP between list view and split view. This is a strong motion showcase candidate — the kind of "ambitious-but-calm" idea that fits the showcase brief.

**7. Aggregated build progression on champion detail.**

Use existing per-match build data to show the most common item path (start → boots → mythic → 3rd → 4th) and the win-rate variant per branch.

### Lower priority

**8. Cross-link from Champions list rows back to "matches with this champion".**

Filtered matches view scoped to a champion. Likely a search-param on `/matches`. Useful but lower than the other moves — Champions detail already covers most of the use cases this would serve.

---

## Implementation sequencing

Rough phasing if we treat this as a multi-session arc:

### Phase A — reframe Champions (1 session)

1. Headline ConclusionCard on the list (move 1)
2. Remove the duplicate from Trends
3. Cross-link the lowest-friction champion icons (Profile Now Playing, Pregame, Trends Focus) — does *not* need match-row yet (move 2, scoped)

Lands a meaningful narrative shift. Self-contained.

### Phase B — list dimensions (1 session)

4. Role + queue filters on the Champions list (move 3)
5. Role chip on each row
6. Cross-link match-row champion icons (move 2, scoped) — done last because it needs the nested-link handling

### Phase C — detail depth (1 session)

7. Recent matches section (move 4)
8. Per-role split (move 5)

### Phase D — showcase piece (1 session, optional)

9. Compare-mode (move 6) — pick this if a motion-showcase slot opens up.

Each phase ships value alone. Phase A is the smallest one that addresses the user's core complaint ("list with no story, disconnected from the rest").

---

## Cross-cutting / app-wide moves (not Champions-specific)

Sized roughly:

| Move | Size | Notes |
|---|---|---|
| Post-game close-the-loop block | S | Mirror of Pregame Ritual. Drop on Profile or as a route segment after a new match arrives via SSE. |
| Composite LP forecast tile | M | Composition of existing signals; new ConclusionCard variant. |
| Champion-pool drift verdict | S | Falls out of the Phase A headline card. |
| Mastery pull | S | New Riot endpoint, cached on backend. Surfaces on Champion detail header. |
| Multi-account compare | L | New view; lean into architecture story. |
| Recap density | M | Decide: invest, or de-emphasize the link from Profile. |
| Live tab audit | S | Read-only review pass. |

---

## Connections to existing notes

- [`views-roadmap.md`](views-roadmap.md) — Profile + Champion detail roadmap. Phase 5+ ("Habits / Insights layer") overlaps with this analysis. Treat this doc as a refinement of the Champions slice.
- [`trends-rework.md`](trends-rework.md) — read before doing move 1 (headline pull-up). May already cover the Champion-focus removal.
- [`motion-backlog.md`](motion-backlog.md) — move 6 (compare-mode FLIP) belongs there if not already.
- [`vnext-ideas.md`](vnext-ideas.md) — cross-cutting moves above should land there if not already captured.

---

## Open questions

1. **Should "Champions" be renamed?** "Champion pool", "Pool", or "Dossier" might frame it more honestly than "Champions". The current name suggests a directory; the goal is a dossier.
2. **Headline card or verdict-per-row?** A single headline reads cleaner; per-row verdicts ("workhorse", "drifted away", "high-WR pick") reads denser. Could do both — headline + per-row chip.
3. **Where does mastery live?** Champion detail header, or a sidebar in the list, or both. Lean toward detail-only — it's a vanity metric in list context.
4. **Drift window?** 14d vs prior 14d is the obvious default. Range selector adds complexity; defer.
