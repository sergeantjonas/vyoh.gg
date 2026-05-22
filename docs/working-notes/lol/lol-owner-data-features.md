# LoL owner-data feature ideas

**Status:** Tier 1 shipped 2026-05-21. MD1 + Match review MR1–MR4 shipped 2026-05-22. Profile narrative tier PN1–PN4 shipped 2026-05-22. Remaining open arcs: none on this catalog. Champion-detail tier parked with explicit trigger.

**Headline next move:** No open arcs on this catalog. Next candidate work surfaces from the parked Champion-detail owner-data tier (trigger: dedicated Champion-detail arc) or [vnext-ideas.md](../cross-cutting/vnext-ideas.md).

This catalog was originally a Post-Tier-1A ideation sweep (2026-05-17). The owner participant in `MatchDetailCache` retains the full Riot payload — every field Riot returns, not just what we type. Non-owner participants keep only the lean `RiotMatchParticipantOther` shape. Restructured 2026-05-21 from an idea catalog into shipped / promoted / parked arcs so each idea has a concrete next action.

Read this when scoping the next LoL feature arc.

---

## Shipped

| Tier | Description | Date |
|---|---|---|
| 1.A | Owner-only retention of full Riot payload in `MatchDetailCache` | 2026-05-21 |
| 1.B | Spell-cast strip on match-detail Your game | 2026-05-21 |
| 1.C | Damage profile (dealt / taken / mitigated) on Your game | 2026-05-21 |
| 1.D | Owner stats strip + multikill badges on Your game | 2026-05-21 |
| MD1 | Damage dealt stacked bar (physical/magic/true) on match detail | 2026-05-22 |
| MR1 | Review tab — gold arc chart + phase verdict strip | 2026-05-22 |
| MR2 | Review tab — personal baseline deviation panel (5 tiles, winsorized median) | 2026-05-22 |
| MR3 | Review tab — moment highlights strip with tooltips | 2026-05-22 |
| MR4 | Review tab — decision-quality narrative (`narrativeTemplates.ts`) | 2026-05-22 |
| PN1 | Highlight reel tile (Trends) — soloKills + outnumberedKills + survivedSingleDigitHpCount sum via POST narrative endpoint | 2026-05-22 |
| PN2 | Lifetime multikill milestone strip (Profile) — pentas/quadras/triples/doubles + best killing spree via GET narrative/lifetime | 2026-05-22 |
| PN3 | csAt10 seeded from `laneMinionsFirst10Minutes` for lane positions + explicit `hasTimeline` flag on Match (sentinel migration on death-timing tiles) | 2026-05-22 |
| PN4 | Death-timing phase narrative augmentation (early/mid/late split above existing 12-bucket histogram) | 2026-05-22 |

---

## Promoted arcs — concrete next-up work

### Arc 1: Match review surface

Scoped fully in [match-review.md](match-review.md). One-paragraph summary so this catalog stays self-contained:

A per-match interpretive sub-route — `/lol/$accountSlug/matches/$matchId/review`, alongside Recap / Your game / Timeline — that turns a single game's data into a *story*: lane / mid / late phase verdicts, decisive moments where the lead changed hands, and where this game diverged from your personal norm. The framing bet: stat sites describe ("you had 7/2/4"), vyoh.gg talks ("you stomped lane at +23 CS, then 3 deaths in 5 mid-game minutes broke the lead, then you closed it anyway"). Four phases: MR1 game arc viz, MR2 baseline deviation panel, MR3 moment highlights, MR4 decision-quality narrative.

**Why this isn't PG4.** The original PG4 was a share-friendly peer route + OG-image artifact, closed 2026-05-20 because PG1–PG3 already deliver the close-the-loop value (see [post-game-close-the-loop.md](post-game-close-the-loop.md)). Match review reuses the per-match peer-surface *shape* but answers a different question — what can I learn from this game — and pulls a different data primitive set.

**Status:** Arc complete. MR1–MR4 all shipped 2026-05-22.

---

### Arc 2: Profile narrative tier (shipped 2026-05-22)

Four narrative tiles, shipped as two commits (feat: PN1–PN3 bundle + feat: PN4) on 2026-05-22. Surface decisions made during implementation:

- **PN1 Highlight reel** → Trends (windowed). New `POST /lol/.../narrative` endpoint takes the trends-window match IDs and sums owner challenges from `MatchDetailCache.detail`. Tile slot priority 900 — between weekly review and time-heatmap. Sample-size guardrail: 5+ non-remake matches in window.
- **PN2 Lifetime multikill strip** → Profile (lifetime). New `GET /lol/.../narrative/lifetime` endpoint scans all non-remake owner matches (capped at 10k) and sums multikills + takes max `largestKillingSpree`. Slotted directly after `ProfileStatsBar` to share the lifetime-aggregate visual rhythm. Suppressed when totals are all zero.
- **PN3 CS@10 fill + `hasTimeline` flag** → schema migration + match-mapper change. Discovered mid-flight: `laneMinionsFirst10Minutes` is genuinely ~0 for junglers, and timeline-derived `csAt10` includes jungle camps — so the backfill is gated to TOP/MIDDLE/BOTTOM/UTILITY only. Explicit `hasTimeline` Boolean column disambiguates the new csAt10 source from a real timeline projection. Sentinel migration on death-timing and death-matchup-heatmap tiles + their activity gates.
- **PN4 Death-timing phase narrative** → augmented the existing `trend-death-timing.tsx` 12-bucket histogram with a coarse early (0–15) / mid (15–25) / late (25+) phase strip. Verdict leads with the dominant-phase narrative when one phase holds ≥40% (e.g. "62% of your deaths happen in the first 15 minutes"); falls back to the existing peak-bucket framing when no phase dominates.

**Notable side effect:** Two `select` clauses in [lol.service.ts](../../apps/api/src/lol/lol.service.ts) had to gain `hasTimeline: true` — the field was returning as `undefined` on every MatchSummary, which silently hid the death-timing tile for all accounts even after PN3 landed. Documented in the commit message for future reference.

**Operational follow-up:** [backfill-cs-at-10-from-challenges.ts](../../apps/api/src/scripts/backfill-cs-at-10-from-challenges.ts) populates `csAt10` for historical lane-position rows from cached detail JSON. On the owner's dev DB it updated 0 rows (all non-timeline rows are jungle/non-Rift); useful for other accounts with laner-heavy histories.

---

### Arc 3: Match detail panel additions

Small extension to the match-detail panel area below the hero card. Two tiles bundled because both are pure-frontend changes against data that already exists in the response.

**MD1 — Damage dealt stacked bar (all 10 players).** Physical / magic / true as stacked segments per participant. All three fields (`physicalDamageDealtToChampions`, `magicDamageDealtToChampions`, `trueDamageDealtToChampions`) are already in `MatchDetail.participants` — pure frontend change. For the owner row, extend with the received / mitigated view from owner-data (1.A retained).

**MD2 — Full rune page panel.** Already planned in match-depth Phase E. Owner full `perks` retained from 1.A — no data work needed. Listed here so this catalog stays the catalog; the implementation arc lives in [match-depth-roadmap.md](match-depth-roadmap.md).

**Sequencing:** MD1 can ship anytime; MD2 ships as part of match-depth Phase E. Either may ship before Arc 2 if scoped smaller and the owner wants a quick win.

---

## Parked with explicit triggers

### Champion-detail owner-data tier

Five tiles, all medium-effort, all gated on a future Champion-detail arc. Bundled because they share aggregation plumbing (per-champion, sometimes win/loss split) and surface (champion detail). Parked indefinitely 2026-05-21.

- **Lane dominance peaks.** `maxCsAdvantageOnLaneOpponent` + `maxLevelLeadLaneOpponent` averaged per champion, split by win/loss. *"On Aatrox you peak at +21 CS over lane opponent in wins, +3 in losses."* Most novel analytical angle in the set.
- **Skillshot accuracy.** `skillshotsHit` per-champion average. *"Your Lux lands 18 skillshots per game."* Rare in stat-site space.
- **Rune WR correlation.** Aggregate `keystone` (already projected for all participants) per champion. *"On Ahri: Electrocute 61% WR, Conqueror 47% WR."* Unique optimization signal.
- **Spell usage ratio.** `spell1Casts`–`spell4Casts` averaged per champion over time. *"On Syndra you cast Q 4.2× per minute — Q-fishing, not E-initiating."* Feeds MR4 templates as a side benefit.
- **CC contribution.** `timeCCingOthers` per champion, especially for tanks/supports. *"On Leona you average 89 seconds of CC per game."*

**Trigger to revive:** the next dedicated Champion-detail arc (no arc on the books today — Champion detail has been a one-off addition surface, not a planned roadmap). Could be triggered by:

1. Owner wanting a Champion-detail polish/expansion pass after Match review surface and Profile narrative tier ship, OR
2. A specific champion-tile idea growing legs and pulling the others with it.

When triggered, lift all five into one arc rather than picking individual tiles — they share aggregation work and the surface deserves one design pass, not five.

### Profile narrative tier — overflow

Two ideas from the original catalog that didn't make it into Arc 2 because they're narrower in audience or weaker as standalone tiles:

- **Objective presence.** `dragonTakedowns`, `baronTakedowns`, `riftHeraldTakedowns` averaged per role/champion. *"As jungler you're on-dragon for 71% of spawns this patch."* Parked because it's role-indexed (i.e. mostly a jungler tile) and the role mix in owner data is too uneven to justify a top-level Profile tile.
- **Support effectiveness.** `effectiveHealAndShielding` for enchanter games. Parked because the owner doesn't main support, so the tile would render empty most weeks.

**Trigger to revive:** owner role mix shifts (sustained 30%+ of games in jungle for Objective presence, or in support/enchanter for Support effectiveness). Both surface as candidate tiles in [vnext-ideas.md](../cross-cutting/vnext-ideas.md) too.

---

## Explicitly ruled out

**All-10 damage received bars.** `totalDamageTaken` stays stripped from non-owner participants. The all-10 comparative frame is a leaderboard frame; this app's framing is self-portrait. The existing damage-dealt bars already provide competitive context where it's useful. Adding received data for strangers is not worth reversing the strip — and non-owner `totalDamageTaken` would need to be added back to `RiotMatchParticipantOther`, which is the wrong direction.

---

## Priority at a glance

| Item | Surface | Effort | State |
|---|---|---|---|
| Tier 1 (1.A–1.D) | Match detail Your game | — | **Shipped 2026-05-21** |
| Match review surface (MR1–MR4) | Sub-route under match detail | — | **Shipped 2026-05-22** |
| Profile narrative tier (PN1–PN4) | Profile / Trends | — | **Shipped 2026-05-22** |
| **Damage stacked bar (MD1)** | Match detail panel | — | **Shipped 2026-05-22** |
| Full rune page panel (MD2) | Match detail panel | Low — Phase E | Tracked in [match-depth-roadmap.md](match-depth-roadmap.md) |
| Champion-detail owner-data tier | Champion detail | Medium × 5 | **Parked** — trigger: Champion-detail arc |
| Objective presence | Profile | Low | **Parked** — trigger: role-mix shift to jungle |
| Support effectiveness | Profile | Low | **Parked** — trigger: role-mix shift to support |

---

## Data available appendix

Fields below exist in the JSON stored for owner participants today. The TypeScript type is the only barrier — no backfill, no new Riot calls, no schema migration. Kept here so future ideas have a single reference point.

**`RiotChallenges` — all typed in `apps/api/src/riot/types.ts` since the Tier 1.A retention pass:**

`killParticipation`, `soloKills`, `outnumberedKills`, `survivedSingleDigitHpCount`,
`effectiveHealAndShielding`, `enemyChampionImmobilizations`, `damagePerMinute`,
`laneMinionsFirst10Minutes`, `skillshotsHit`, `skillshotsDodged`,
`maxCsAdvantageOnLaneOpponent`, `maxLevelLeadLaneOpponent`,
`visionScoreAdvantageLaneOpponent`, `dragonTakedowns`, `baronTakedowns`,
`riftHeraldTakedowns`, `timeCCingOthers`

**`RiotMatchParticipant` — all typed since Tier 1.A:**

Spell casts: `spell1Casts`–`spell4Casts`, `summoner1Casts`, `summoner2Casts`
Multikills: `doubleKills`, `tripleKills`, `quadraKills`, `pentaKills`, `killingSprees`, `largestKillingSpree`
Damage/survival: `totalDamageTaken`, `damageSelfMitigated`, `totalHeal`, `totalTimeCCDealt`, `totalTimeSpentDead`, `longestTimeSpentLiving`

**Already on the `Match` row — just not aggregated:**

`deathTimings`, `killTimings`, `deathXs`/`deathYs`/`killXs`/`killYs`,
`csAt10`, `csAt15`, `goldAt10`, `goldAt15`, `teamGoldDiffAt15`

---

## Cross-references

- [match-review.md](match-review.md) — concrete 4-phase plan for the learning surface (Arc 1)
- [match-depth-roadmap.md](match-depth-roadmap.md) — Phase E (full rune page = MD2); damage stacked bar (MD1) belongs in a Phase F or Phase E extension
- [personal-baselines.md](personal-baselines.md) — highlight reel, CS@10, lane dominance, skillshot accuracy all fit the you-vs-you frame documented there
- [post-game-close-the-loop.md](post-game-close-the-loop.md) — Profile-side PG1–PG3 close-the-loop + PG4 closure rationale
- [vnext-ideas.md](../cross-cutting/vnext-ideas.md) — Objective presence + Support effectiveness surface here as candidates if the trigger doesn't fire
- [open-work.md](../open-work.md) — Arc 1 (MR1 next-up), Arc 2 (PN1–PN4), Arc 3 (MD1) all tracked
- [parked.md](../parked.md) — Champion-detail owner-data tier, Objective presence, Support effectiveness
