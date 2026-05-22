# Match review — learning-oriented per-match surface

**Status:** Shipped (2026-05-22). All four phases complete. MR4 note: spell cast and CC sentences use absolute rates, not vs-baseline comparisons — the baseline service does not track those metrics. Time dead vs baseline is the primary "vs your norm" signal. Extend baseline if spell-cast or CC norms become a priority.

A per-match interpretive sub-route — `/lol/$accountSlug/matches/$matchId/review` — alongside the existing Recap / Your game / Timeline tabs. Turns a single game's data into a *story*: lane / mid / late phase verdicts, decisive moments where the lead changed hands, and where this game diverged from your personal norm on this champion and role.

**The framing bet:** stat sites *describe* ("you had 7/2/4, 180 CS at 14, 24% damage share"), vyoh.gg *talks* ("you stomped lane at +23 CS over your opponent, then 3 deaths in 5 mid-game minutes broke the lead, then you closed it anyway"). The same data; a different reading.

**Why this isn't PG4.** The originally-scoped PG4 was a share-friendly peer route + OG-image artifact, closed 2026-05-20 because PG1–PG3 already deliver the close-the-loop value where the user looks (see [post-game-close-the-loop.md](post-game-close-the-loop.md)). Match review reuses the per-match peer-surface *shape* but answers a different question — what can I learn from this game — and pulls a different data primitive set (timeline arcs + personal baselines + owner challenges, not just summarized signals). It is not a share artifact; it is a learning surface.

**Why now.** Tier 1 of [lol-owner-data-features.md](lol-owner-data-features.md) typed the owner-data fields and shipped four small additions to the existing Your-game tab. The data primitives are in place; the largest leverage from them is interpretive, not display-denser.

---

## Route shape and integration

**Sub-route:** `/lol/$accountSlug/matches/$matchId/review.tsx` — consistent with `recap.tsx`, `your-game.tsx`, `timeline.tsx`. Lives in `apps/web/src/routes/lol/$accountSlug/matches/`.

**Tab nav:** extend [apps/web/src/lol/matches/match-detail-tabs.tsx](../../../apps/web/src/lol/matches/match-detail-tabs.tsx) — add a fourth tab between Your game and Timeline, label "Review". ARIA tab role pattern already exists; extend the test in `match-detail-tab-nav.test.tsx` in the same commit.

**Skeleton:** extend [apps/web/src/lol/matches/match-detail-skeleton.tsx](../../../apps/web/src/lol/matches/match-detail-skeleton.tsx) with a review variant (per the repo convention that skeletons mirror the layout they replace).

**Data dependencies (all present, no new Riot calls):**

- `MatchDetailCache` — owner participant retains full Riot payload (challenges, spell casts, multikills, totalTimeSpentDead, longestTimeSpentLiving, timeCCingOthers, etc.)
- `MatchTimelineCache` — gold-diff per minute, frame-level positions, killTimings, deathTimings
- `Match` row — csAt10/15, goldAt10/15, teamGoldDiffAt15, deathTimings, killTimings, deathXs/Ys, killXs/Ys
- `MatchSummary` cache — already powers Trends; per-champion/per-role personal baselines

**Personal baseline source.** PG1–PG3 in [apps/web/src/lol/profile/profile-post-game.tsx](../../../apps/web/src/lol/profile/profile-post-game.tsx) already computes form / game-shape / champion-baseline signals from the same data. MR2 needs the same logic per match, not per profile — extract the baseline aggregation into a shared service (`apps/api/src/lol/match-baseline.service.ts` or a `packages/shared/src/lol/baselines.ts` pure helper, depending on where the heavy aggregation belongs) and have both Profile and Review consume it.

---

## Phases

### MR1 — Game arc visualization

**Scope:** the route exists, the tab is wired, and the central artifact is a gold-diff arc with annotated moments. Phase verdicts under the chart turn the arc into a sentence.

**Data:** `MatchTimelineCache.frames[].participantFrames[*].totalGold` summed per team into a team-gold-diff series. `killTimings` + `deathTimings` from the `Match` row annotate the arc.

**Components:**

- `MatchReviewView` — top-level layout, mirrors `MatchYourGameTab` shape.
- `GameArcChart` — visx line chart of team-gold-diff over time. Owner team positive = above zero, enemy positive = below. Annotations: small dots for owner kills (above-line, green), owner deaths (below-line, red), objective takedowns from `Match.team.objectives`.
- `PhaseVerdictStrip` — three-up grid: Laning (0–14 min), Mid (14–25 min), Late (25–end). Each verdict is one short sentence generated from the arc and per-phase stats.

**Verdict logic (MR1 v1):**

- Laning verdict pulls from `csAt10`, `goldAt10`, `maxCsAdvantageOnLaneOpponent`, `maxLevelLeadLaneOpponent`. Four buckets: dominated / won / lost / stomped.
- Mid verdict pulls from team-gold-diff trajectory between 14–25 min + owner deaths in that window. Three buckets: built on it / lost the lead / clawed back.
- Late verdict pulls from final outcome + decisive objective takedowns from `Match.team.objectives`. Two buckets: closed it / threw it / got closed on / pulled it back.

Sentence templates are deliberately small and human — not generated prose. The grid of (phase × bucket) is finite and writable.

**ARAM/Arena handling:** route renders an "Unsupported queue for review" empty state if `queueId` is not Summoner's Rift draft/solo. Document the gate at the route level.

**Animations:** `LazyMotion` (`domMax` already mounted) + `m.div` with `data-[state=...]` patterns consistent with the rest of the match detail. Arc draws in once on mount; respect `prefers-reduced-motion`.

**Tests in same commit:**

- `match-review.test.tsx` — renders for a real fixture, asserts arc points + phase verdict text under three matched scenarios (stomp / comeback / throw).
- Axe scan on the route.
- Extend `match-detail-tab-nav.test.tsx` for the new tab.

**Out of scope for MR1:** baseline deviation tiles, moment highlights strip, decision-quality narrative — those are MR2/3/4. Keep MR1 to the arc + phase strip + route plumbing.

---

### MR2 — Personal baseline deviation panel

**Scope:** below the arc, a panel of "you vs. you" deviation tiles — KDA, damage share, CS@10, vision score, time spent dead — each shown as a delta against the owner's per-champion/per-role baseline. Game-shape framing: how does *this* game compare to *your* games on this champion in this role.

**Data:** aggregate per-champion/per-role baselines from `MatchSummary` cache. Reuse the logic that powers PG1–PG3 in `profile-post-game.tsx` — extracted to a shared service as noted above.

**API surface:** new endpoint `GET /api/lol/baselines/:puuid/:championAlias/:role` returning `{ kda, damageShare, csAt10, visionScore, timeDead, sampleSize, lastNGames }`. Cache the aggregation per (puuid, championAlias, role); invalidate on new match ingest for that puuid.

**Components:**

- `BaselineDeviationPanel` — 5-tile grid. Each tile: metric name, this-game value (large), baseline value (smaller, "vs. you on X across N games"), delta sparkbar.
- Sample-size guardrail: if `sampleSize < 5` games on this champion+role, show a "not enough samples yet" state with the champion-only baseline (no role split) instead of falsy bars.

**Edge cases:**

- New champion / first time on this role: show "first game we're tracking" state, no deviation.
- Personal baselines are noisy on small N — use winsorized median rather than mean (one 5-pentakill smurf game shouldn't move the bar).

**Tests in same commit:**

- Baseline service unit test (multiple matches, mixed roles, edge cases for N<5).
- Panel component test for the three states (enough samples / champion-only fallback / first game).
- Endpoint integration test.

**Why this is its own phase, not bundled with MR1:** the baseline service is the biggest engineering chunk in the arc (shared with Profile, needs cache + invalidation). Ship MR1 standalone first to validate the surface; promote the service once we know the route lives.

---

### MR3 — Moment highlights strip

**Scope:** a horizontal strip of "moments worth remembering" from this game. Reads owner challenges + multikills + survival fields. Each moment is a chip with an icon, count, and short label.

**Data (all owner challenges/participant fields, already retained):**

- `soloKills` — "3 solo kills"
- `outnumberedKills` — "2 outnumbered takedowns"
- `survivedSingleDigitHpCount` — "1 clutch survival"
- `pentaKills` / `quadraKills` / `tripleKills` — multikill chips (already shipped in 1.D on Your-game; Review surfaces them in context of the moment timeline)
- `longestTimeSpentLiving` — "22 min longest streak"
- `largestKillingSpree` — "8-kill spree"
- `enemyChampionImmobilizations` — "47 immobilizations" (for CC champs)

**Threshold gating:** chips only render if non-zero AND above a per-metric noise floor (e.g. immobilizations only shown if ≥ 20). Avoid the "1 outnumbered takedown" chip-spam case.

**Components:**

- `MomentHighlightsStrip` — horizontal scroll-snap chip row. Empty state if no chip clears thresholds: "a quiet game" — that itself is a verdict.

**Tests in same commit:**

- Threshold logic unit test.
- Empty-state render test.

---

### MR4 — Decision-quality narrative

**Scope:** prose-style narrative paragraph below the panels. Pulls spell usage ratios, time dead distribution, CC contribution against personal champion averages. Generated from finite templates, not LLM output.

**Data:**

- `spell1Casts`–`spell4Casts` per-minute vs champion-baseline cast ratio (from MR2's baseline service).
- `totalTimeSpentDead` vs champion-baseline.
- `timeCCingOthers` vs champion-baseline (for tank/support champs).
- Death timing distribution (`deathTimings`) vs personal phase-of-game death pattern (this is itself a tile candidate in [lol-owner-data-features.md](lol-owner-data-features.md)).

**Narrative shape:**

- 3–5 sentences. Each sentence is a template fill (e.g. "You cast Q 4.2× per minute — 28% above your Syndra norm. Your E uptime was below baseline.").
- Templates are finite per-metric, per-direction (above/below baseline), per-magnitude (small/large delta). Maintain in a `narrativeTemplates.ts` file with snapshot tests.
- Never embellish. Sentences read clinical because the framing bet is *honest interpretation*, not hype.

**Tests in same commit:**

- Template snapshot tests for the grid of (metric × direction × magnitude).
- Narrative component renders a known fixture into the expected sentences.

---

## Open decisions

| Decision | Default | Trigger to revisit |
|---|---|---|
| Route segment name | `review` (matches Recap / Your game / Timeline length) | If owner prefers `learn` or `breakdown` — change before MR1 ships |
| ARAM/Arena handling | Empty state in MR1; per-mode review surface deferred indefinitely | If ARAM volume in personal data warrants it |
| Animation budget | LazyMotion arc draw + tile cascade in MR1; richer transitions deferred to MR3 | If MR1 ships and feels static |
| Does Review eventually replace Your-game as default tab? | No — keep Your-game default; Review is opt-in | After all 4 phases ship and usage signals are real |
| Where does the baseline service live | `apps/api/src/lol/match-baseline.service.ts` (aggregation is heavy, belongs server-side); thin client hook in web | If aggregation turns out to fit comfortably in a pure shared helper, move to `packages/shared/src/lol/baselines.ts` |
| Should the strip suppress chips when phase verdicts already say "stomp" | No — chips and verdicts are different framings of the same game; both add value | If user testing finds redundancy fatigue |

---

## Sequencing and gating

- **MR1** shipped 2026-05-22 — gold arc chart + phase verdict strip + route + tab nav.
- **MR2** shipped 2026-05-22 — baseline service + deviation panel (5 tiles incl. time dead).
- **MR3** shipped 2026-05-22 — moment highlights strip with tooltips.
- **MR4** shipped 2026-05-22 — decision-quality narrative (`narrativeTemplates.ts`): time dead vs baseline, spell cast rate, death timing phase split, CC contribution.

---

## Cross-references

- [lol-owner-data-features.md](lol-owner-data-features.md) — Tier 1 shipped fields that this surface consumes; broader catalog of owner-data ideas
- [post-game-close-the-loop.md](post-game-close-the-loop.md) — PG1–PG3 on Profile (close-the-loop where the user looks); PG4 share-artifact closure rationale
- [personal-baselines.md](personal-baselines.md) — you-vs-you framing this surface inherits
- [match-depth-roadmap.md](match-depth-roadmap.md) — match-detail surface arc; Review tab is the next major addition after Phase E (full rune page)
- [open-work.md](../open-work.md) — promote MR1 here when owner approves
