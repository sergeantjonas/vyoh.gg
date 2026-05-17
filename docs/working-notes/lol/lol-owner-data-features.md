# LoL owner-data feature ideas

**Status:** Reference — ideation catalog opened 2026-05-17 after Match cache Tier 1A shipped. Browse when looking for a small-tile or sub-section idea that doesn't need new Riot calls. Items here promote to [open-work.md](../open-work.md) when picked up.

Post-Tier-1A ideation sweep (2026-05-17). The owner participant in `MatchDetailCache` retains the full Riot payload — every field Riot returns, not just what we type. Non-owner participants keep only the lean `RiotMatchParticipantOther` shape. This note catalogs the features that become possible from the owner data, organized by surface.

Read this when scoping the next LoL feature arc, or when looking for a small-tile idea that doesn't need new Riot calls.

---

## Data available but not yet exposed

The fields below exist in the JSON stored for owner participants today. The TypeScript type is the only barrier — no backfill, no new Riot calls, no schema migration.

**`RiotChallenges` — only `killParticipation` typed today:**

`soloKills`, `outnumberedKills`, `survivedSingleDigitHpCount`, `effectiveHealAndShielding`,
`enemyChampionImmobilizations`, `damagePerMinute`, `laneMinionsFirst10Minutes`,
`skillshotsHit`, `skillshotsDodged`, `maxCsAdvantageOnLaneOpponent`,
`maxLevelLeadLaneOpponent`, `visionScoreAdvantageLaneOpponent`,
`dragonTakedowns`, `baronTakedowns`, `riftHeraldTakedowns`, `timeCCingOthers`

**`RiotMatchParticipant` — missing from type:**

Spell casts: `spell1Casts`–`spell4Casts`, `summoner1Casts`, `summoner2Casts`
Multikills: `doubleKills`, `tripleKills`, `quadraKills`, `pentaKills`, `killingSprees`, `largestKillingSpree`
Damage/survival: `totalDamageTaken`, `damageSelfMitigated`, `totalHeal`, `totalTimeCCDealt`, `totalTimeSpentDead`, `longestTimeSpentLiving`

**Already on the `Match` row — just not aggregated:**

`deathTimings`, `killTimings`, `deathXs`/`deathYs`/`killXs`/`killYs`,
`csAt10`, `csAt15`, `goldAt10`, `goldAt15`, `teamGoldDiffAt15`

---

## Match detail — hero card additions

**Spell cast breakdown.** `spell1Casts`–`spell4Casts` as a labeled strip: "Q: 320 · W: 87 · E: 124 · R: 12". Mechanical fingerprint of a game. No stat site surfaces this on match detail. `summoner1Casts`/`summoner2Casts` alongside: "2 Flashes used."

**Damage profile (owner only).** Stacked physical / magic / true bar on the hero card. Paired with damage received: *"Dealt 22K (80% magic), absorbed 14K."* Owner-only — all-10 damage-received bars were explicitly ruled out (see "Ruled out" section).

**CC time and death time.**
- `timeCCingOthers`: "You CC'd enemies for 147 seconds." One line; meaningful for tanks and enchanters.
- `totalTimeSpentDead`: "You spent 4:20 dead." Blunt. Nowhere else shows this.
- `longestTimeSpentLiving`: flavor line — "longest survival streak: 22 min."

**Multikill badge strip.** `doubleKills`/`tripleKills`/`quadraKills`/`pentaKills` as small badges on the hero card when non-zero. Already planned as a visual flourish in match-depth; now has data.

---

## Match detail — panel additions

**Damage dealt stacked bar (all 10 players).** Physical / magic / true as stacked segments per participant. All three fields (`physicalDamageDealtToChampions`, `magicDamageDealtToChampions`, `trueDamageDealtToChampions`) are already in `MatchDetail.participants` — pure frontend change. For the owner row, extend with the received / mitigated view.

**Full rune page panel.** Already in match-depth Phase E. Full `perks` is retained for the owner — primary keystone + secondary runes + stat shards. No data work needed.

---

## Profile / Trends — new tiles

**Highlight reel tile.** `soloKills + outnumberedKills + survivedSingleDigitHpCount` summed over the window. Framed as narrative, not metric: *"This month: 34 solo kills, 12 outnumbered takedowns, 9 clutch survivals."* Nothing else in the genre frames it this way.

**Lifetime multikill milestone strip.** Total `pentaKills`, `quadraKills`, `tripleKills`, `doubleKills` across all stored games. *"2 pentas, 14 quadras, 58 triples."* Purely additive. High visual appeal, near-zero build cost.

**CS@10 without timeline.** `laneMinionsFirst10Minutes` (challenges) gives CS at 10 without `MatchTimelineCache`. Covers 98% of the match library that has no timeline row. Extends and fills the existing `csAt10` series.

**Death timing breakdown.** `deathTimings` is already stored on every timeline-enriched `Match`. Aggregate: *"42% of your deaths happen in the first 15 minutes."* Phase-of-game death pattern — coaching signal, cheap to compute.

**Objective presence.** `dragonTakedowns`, `baronTakedowns`, `riftHeraldTakedowns` averaged per role / champion. *"As jungler you're on-dragon for 71% of spawns this patch."* Role-indexed, rarely surfaced.

**Support effectiveness.** `effectiveHealAndShielding` for enchanter games. *"On Lulu your heal/shield output is 12K per game — up 20% from last month."* Fills the gap where support contribution looks invisible in standard stats.

---

## Champion detail — new tiles

**Lane dominance peaks.** `maxCsAdvantageOnLaneOpponent` and `maxLevelLeadLaneOpponent` averaged per champion, split by win/loss. *"On Aatrox you peak at +21 CS over your lane opponent in wins, +3 in losses."* Direct mechanistic signal on whether you convert early leads.

**Skillshot accuracy.** `skillshotsHit` as a per-champion average, compared to your own average on skillshot-heavy champions. *"Your Lux lands 18 skillshots per game."* Rare in the stat-site space; natural personal-baselines tile.

**Rune WR correlation.** `keystone` (already projected for all participants from `perks.styles[0].selections[0].perk`) can be aggregated per champion. *"On Ahri: Electrocute 61% WR, Conqueror 47% WR."* Pure read from stored data, no new fields needed.

**Spell usage ratio.** `spell1Casts`–`spell4Casts` averaged per champion over time. Mechanical habit signal: *"On Syndra you cast Q 4.2× per minute — you're Q-fishing, not E-initiating."*

**CC contribution.** `timeCCingOthers` per champion. For tanks and supports: *"On Leona you average 89 seconds of CC per game."*

---

## Per-game match report card (PG4 expansion)

PG1–PG3 (Profile section, 3–4 signals, most-recent game only) are already shipped. PG4 is the peer route `/lol/$accountSlug/post-game/$matchId` — the natural landing zone for a richer per-game artifact accessible from any match in history.

**Access model.** A "Read this game" link on any match row opens the PG4 peer route. The Profile post-game pulse remains as the zero-friction immediate-after-game version; PG4 is the deeper read you pull up on a game you want to understand.

**Content — richer than PG1–PG3:**

- Personal baseline comparisons across all available signals: damage share vs your role average, CS@10 vs your champion average, KP vs your account average, vision vs your role norm.
- Moment highlights from challenges: solo kills, outnumbered kills, clutch survivals, multikills for this specific game.
- Laning narrative: `maxCsAdvantageOnLaneOpponent` + `teamGoldDiffAt15` — *"you peaked +23 CS ahead, then the game equalized at 20 minutes."*
- Spell usage fingerprint: Q/W/E/R cast counts.
- Death timing: where your deaths clustered (laning / mid-game / late).
- Champion read: this game vs your personal average on the champion.

PG4 effectively merges the post-game signal set with the match report card concept into one surface. See [post-game-close-the-loop.md](post-game-close-the-loop.md) for the existing PG1–PG3 spec and the peer-route architecture decision.

---

## Explicitly ruled out

**All-10 damage received bars.** `totalDamageTaken` stays stripped from non-owner participants. The all-10 comparative frame is a leaderboard frame; this app's framing is self-portrait. The existing damage-dealt bars already provide competitive context where it's useful. Adding received data for strangers is not worth reversing the strip — and non-owner `totalDamageTaken` would need to be added back to `RiotMatchParticipantOther`, which is the wrong direction.

---

## Priority at a glance

| Idea | Surface | Effort | Why it stands out |
|---|---|---|---|
| Spell cast strip | Match detail hero | Low — type + DTO + one strip | No other site shows this |
| Highlight reel tile | Profile / Trends | Low — 3 challenges fields summed | Narrative framing, not metric |
| Damage stacked bar | Match detail panel | Low — frontend only, DTO already has it | Completes the existing damage bar |
| Lifetime multikill strip | Profile | Very low — 4 additive fields | Milestone / nostalgia feel |
| CS@10 without timeline | Trends / Champion detail | Low — one challenges field, 98% coverage | No MatchTimelineCache needed |
| Death timing breakdown | Profile / Trends | Low — deathTimings already stored | Coaching signal, rarely shown |
| Lane dominance peaks | Champion detail | Medium — per-champion avg, win/loss split | Most novel analytical angle |
| PG4 match report card | Peer route | Medium — new route + denser signal set | Biggest visible-payoff new surface |
| Rune WR correlation | Champion detail | Medium — aggregate keystone vs WR | Unique optimization signal |

---

## Cross-references

- [match-depth-roadmap.md](match-depth-roadmap.md) — Phase E (full rune page) already planned; spell cast strip and damage panel belong in a Phase F or Phase E extension
- [personal-baselines.md](personal-baselines.md) — highlight reel, CS@10, lane dominance, skillshot accuracy all fit the you-vs-you frame documented there
- [post-game-close-the-loop.md](post-game-close-the-loop.md) — PG4 peer route is the landing zone for the per-game match report card
- [vnext-ideas.md](../cross-cutting/vnext-ideas.md) — lifetime multikill strip, objective presence, support effectiveness are candidate tiles for the unpromoted pool
