# vyoh.gg — Match cache storage arc

**Status:** Parked — Tier 1A (owner-only retention) shipped 2026-05-17 (chunks A–C; `VACUUM FULL` 195 MB → 43 MB, 78% reduction). Tiers 1B (global field stripping), 2 (zstd BYTEA), and 3 (zstd dictionary) remain deferred until DB size becomes a cost/quota concern *or* feature scope on Profile / Matches / Trends / Champions / Match detail feels stable. See [parked.md](../parked.md). Read this when DB size becomes a cost/quota issue or when explicitly revisiting storage cost.

This is a deliberate hold, not an oversight. The conversation that produced this note was on 2026-05-10, when `MatchSummary` had just been extended with `csAt10`, `csAt15`, `goldAt10`, `goldAt15`, and two more fields — proving the "don't strip caches mid-iteration" point in real time. The arc waits until features stabilize.

---

## Why this exists

The match caches store Riot's raw JSON payload. Each row is huge and most of the bytes are fields we never read. Once feature scope on the read paths stops moving, we can dramatically shrink storage without losing anything we use.

## Current state — what we store

Two Prisma `Json` columns (Postgres `jsonb` under the hood):

- [`MatchDetailCache.detail`](../../../apps/api/prisma/schema.prisma#L42-L46) — full raw `RiotMatch` payload from `/lol/match/v5/matches/{id}`. **Typical size: 80–120KB per row.**
- [`MatchTimelineCache.timeline`](../../../apps/api/prisma/schema.prisma#L48-L52) — full raw `RiotMatchTimeline` payload. **Typical size: 200–500KB per row.**

We project these to leaner shapes (`MatchDetail`, `MatchTimelineProjection`) at **read time** via [`riotMatchToDetail`](../../../apps/api/src/lol/match-mapper.ts) and [`riotTimelineToProjection`](../../../apps/api/src/lol/timeline-mapper.ts). The mappers read maybe 20 fields per row out of the ~100+ Riot returns. Everything else is dead weight on disk that survives only as a forward-compat hedge.

Napkin scale: ~400KB/match × 1000 matches × 2 accounts ≈ 800MB. Free-tier Postgres (Neon, Supabase) sits at 0.5–1GB. We're close to the ceiling now and will cross it with normal usage.

What Postgres already does for free: `jsonb` auto-TOAST-compresses values over ~2KB with `pglz` (the default). It helps, but it's a mediocre compressor that doesn't dedupe repeated key strings across rows.

## Why this is parked

The biggest lever (Tier 1 below — strip unused fields before storing) is also the most forward-incompatible. **Riot serves match data for ~2 years.** If we strip a field today that we want for a feature next month, we either refetch (rate-limited, slow) or permanently degrade matches older than 2 years.

Premature stripping costs permanent data. The conversation that produced this note showed the hazard directly: a session-ago, `MatchSummary` didn't have `csAt10` / `goldAt10` / etc. If we'd stripped to "what we read" before adding those fields, every match in the cache would be retroactively incomplete.

So the rule is: **stabilize feature scope first, then strip.**

*Three* things in this arc are *not* parked. Land them whenever there's a slot — **Tier 1A (owner-only retention)** is the big safer win (do this first); Tier 4 (lz4 compression) and Tier 5 (TTL eviction) are smaller incremental wins that pair cleanly with later Tier 1B / 2 work.

---

## Field-by-field audit (2026-05-16)

Discussion-driven walk through what we store vs what we consume. Three independent strip axes emerged with different risk profiles.

| Axis | Risk | Estimated saving |
|---|---|---|
| Owner-only retention (Tier 1A) | Very low | ~30–40% on detail rows |
| Globally-dead fields (legacy IDs, Arena, redundant gameEnd*, PAUSE / CHAMPION_SPECIAL_KILL / GAME_END events) | Low — deprecated, redundant, off-scope | ~10–15% combined |
| Global field stripping on potentially-useful fields (Tier 1B) | High — original Tier 1 hazard | The big remaining lever |

**Typed surface is already lean.** Every field in `RiotMatch` / `RiotMatchTimeline` ([apps/api/src/riot/types.ts](../../../apps/api/src/riot/types.ts)) is consumed by a mapper or by one of the three direct `findMany` callers in [lol-analytics.service.ts](../../../apps/api/src/lol/lol-analytics.service.ts) (`getDuos`, `getChampionPairs`, `getChampionBuildFlow`). The bytes-to-save discussion is *not* "find dead fields in our types" — it's "what does Riot return that we never type?"

### Chopping-block — owner-only retention (Tier 1A)

Owner-meaningful, never read on non-owner participants. Strip on non-owner participants only:

- All of `challenges` (~100 sub-fields) — keep just `{ killParticipation }` on non-owners (see "Non-owner participants must keep" below). **Owner's full `challenges` block stays whole**, and `killParticipation` specifically is a planned owner-side stat (analytics + trend tile), so it must remain present on the owner participant under every later tier as well.
- Damage breakdowns beyond `totalDamageDealtToChampions`: per-type taken, building / objective / turret damage, self-mitigated, heals, CC duration
- All ping counters (~14: allInPings, assistMePings, …, basicPings)
- Multikill / streak counters: doubleKills, tripleKills, quadraKills, pentaKills, unrealKills, killingSprees, largestKillingSpree, largestMultiKill, largestCriticalStrike, longestTimeSpentLiving, totalTimeSpentDead
- Spell / summoner casts: spell1Casts..spell4Casts, summoner1Casts, summoner2Casts
- `perks` beyond `styles[0].selections[0].perk` (full rune page + statPerks + var1/var2/var3) — **owner keeps full `perks` intact**; the "full rune page panel" tile in match-depth Phase E remainder ([open-work.md](../open-work.md)) depends on it
- Counter-jungle splits: totalAllyJungleMinionsKilled, totalEnemyJungleMinionsKilled

Non-owner participants must keep:

- Identity: `puuid`, `riotIdGameName`, `riotIdTagline`
- Roster card: `championName`, `teamId`, `teamPosition`, `win`, `kills`/`deaths`/`assists`, `champLevel`
- Final inventory: `item0`..`item6`
- Team aggregates: `totalDamageDealtToChampions`, `goldEarned`, `totalMinionsKilled` + `neutralMinionsKilled`
- Per-type damage split: `physicalDamageDealtToChampions`, `magicDamageDealtToChampions`, `trueDamageDealtToChampions` (read per-participant by `riotMatchToDetail`)
- Card extras: `visionScore`, `wardsPlaced`, `wardsKilled`, `detectorWardsPlaced`, `summoner1Id`/`summoner2Id`
- Reduced `perks`: `styles[0].selections[0].perk` only (keystone — read for all participants at [match-mapper.ts:128](../../../apps/api/src/lol/match-mapper.ts#L128))
- Reduced `challenges`: `{ killParticipation }` only (read for all participants at [match-mapper.ts:152](../../../apps/api/src/lol/match-mapper.ts#L152))

### Chopping-block — globally safe

Deprecated, redundant, or off-scope on every row:

- Legacy / duplicate IDs: `riotIdName`, `summonerName`, `summonerId`, `role`, `lane`, `championId` (we have `championName`), `participantId` (derivable from order)
- Redundant booleans: `teamEarlySurrendered` (≡ `gameEndedInEarlySurrender` for our remake heuristic), `nexusKills`/`Lost`/`Takedowns` (derivable from `win`), `inhibitorKills`/`Lost` (covered by team-level objectives)
- Battle-pass plumbing: `eligibleForProgression`, `missions`, `playerScore0..11`
- Arena-only when queueId not in {1700, 1710}: `placement`, `playerAugment*`, `playerSubteamId`, `subteamPlacement`
- Top-level info: `gameCreation`, `gameEndTimestamp`, `gameName` (the internal string), `gameId` (numeric — `metadata.matchId` is canonical), `tournamentCode`, `gameType`, `platformId` (derivable from `metadata.matchId` split)
- Per-participant: `timePlayed` (≈ `gameDuration`), `individualPosition` (kept only if we adopt it as live-estimator ground truth)
- Timeline events: `PAUSE_START` / `PAUSE_END` (essentially never fire in solo queue), `CHAMPION_SPECIAL_KILL` (announcer redundancy of CHAMPION_KILL), `GAME_END` (winner already known from match detail)
- Timeline CHAMPION_KILL extras: `victimDamageDealt[]` / `victimDamageReceived[]` arrays — biggest single line item in event payloads; only useful if we commit to a kill-replay tooltip

### Keep for novelty / post-game flavor (cheap, real use)

Feed a credible "weird stats" panel from the match-detail roadmap:

- Owner-side: `bountyLevel`, `consumablesPurchased`, `itemsPurchased`, `inhibitorTakedowns`, `firstTowerKill` / `firstTowerAssist`, `gameEndedInSurrender` (full-game FF — distinct from remake; colors recent-form display)
- Team-side: `teams[].bans[]` (10 banned championIds — pocket-pick reputation, team ban tendencies), `teams[].feats` (2025 first-3-takedowns / first-objective)
- Timeline: `LEVEL_UP` events (exact level-2/3/6 timings — lane priority, ult-timing analysis; distinct from `SKILL_LEVEL_UP` which we already use for ability orders)
- Top-level: `mapId` + `gameMode` (more reliable than queueId for ARAM vs SR, once we add ARAM analytics)

---

## Triggers — when to start (Tier 1B+)

(Tier 1A is green-lit anytime — the triggers below apply to Tier 1B and beyond.)

Pull this arc off the shelf when **any** of these is true:

- DB size has crossed the free-tier hosting limit (or we're paying real money for storage)
- The `MatchSummary`, `MatchDetail`, and `MatchTimelineProjection` interfaces haven't gained a field in ~2 months
- Profile / Matches / Trends / Champions / Match detail surfaces are "done" — no major new visualizations planned
- We deliberately decide the portfolio bullet ("cut DB row size 30× via projection-on-ingest + zstd") is worth the lift on its own merits, even without size pressure

Roughly any one of these is a green light to start Tier 1.

---

## Tier 0 — Measure (do this first, anytime)

Before any tier, confirm the napkin math. Without numbers, every later decision is guesswork.

```sql
-- Per-row size distribution
SELECT
  percentile_cont(0.50) WITHIN GROUP (ORDER BY pg_column_size(detail)) AS p50,
  percentile_cont(0.95) WITHIN GROUP (ORDER BY pg_column_size(detail)) AS p95,
  percentile_cont(0.99) WITHIN GROUP (ORDER BY pg_column_size(detail)) AS p99,
  max(pg_column_size(detail)) AS max
FROM "MatchDetailCache";

-- Total table size (post-TOAST compression)
SELECT pg_size_pretty(pg_total_relation_size('"MatchDetailCache"'));
SELECT pg_size_pretty(pg_total_relation_size('"MatchTimelineCache"'));

-- Total compressed size of just the JSON column
SELECT pg_size_pretty(sum(pg_column_size(detail))) FROM "MatchDetailCache";
SELECT pg_size_pretty(sum(pg_column_size(timeline))) FROM "MatchTimelineCache";
```

Record results in the "Decision log" section below. **Effort:** 5 minutes.

---

## Tier 1A — Owner-only retention (safer big win, GREEN-LIT)

**Goal:** Strip heavy per-participant fields on non-owner participants. Keep the owner's row intact. **Estimated effect: detail row ~30–40% smaller. No risk to any planned self-portrait view.**

**Why this is not parked (and Tier 1B is):** the parked-arc hazard is "we strip a field today we want for a feature next month." Owner-only retention sidesteps this — the owner's data stays whole, and the only reversibility loss is "we can never compute a teammate's solo-kill count," which doesn't conflict with the per-stream / self-portrait scope ([self-portrait-surfaces.md](../cross-cutting/self-portrait-surfaces.md)).

**Files (modify):**

- [`apps/api/src/lol/lol.service.ts`](../../../apps/api/src/lol/lol.service.ts) — project to owner-scoped shape before `matchDetailCache.create` / `.upsert`. Owner = participant whose `puuid` matches an allowed account (via the identity service used by [lol-analytics.service.ts](../../../apps/api/src/lol/lol-analytics.service.ts); see [owner-auth.md](../ops/owner-auth.md))
- [`apps/api/src/riot/types.ts`](../../../apps/api/src/riot/types.ts) — split `RiotMatchParticipant` into `RiotMatchParticipantOwner` (full) and `RiotMatchParticipantOther` (lean). Discriminated union keeps mapper code honest
- [`apps/api/src/lol/match-mapper.ts`](../../../apps/api/src/lol/match-mapper.ts) — already reads only lean-shape fields for non-owner participants; verify with TS narrowing

**Strip-list on non-owner participants:** see "Chopping-block — owner-only retention" in the audit section above.

**Challenges sub-list — keep on owner only.** Riot's `challenges` object has ~100 sub-fields and evolves patch-over-patch; **verify against a real cached row before committing.** Recommended starter list (8 high-signal, cheap, stable):

| Field | Why |
|---|---|
| `killParticipation` | already used today |
| `soloKills` | 1v1 outplay count (highlight reel) |
| `outnumberedKills` | 1v2+ kills (highlight reel) |
| `survivedSingleDigitHpCount` | clutch moments tile |
| `effectiveHealAndShielding` | support contribution; distinguishes Soraka / Lulu from utility supports |
| `enemyChampionImmobilizations` | CC count; CC-heavy archetype signal |
| `damagePerMinute` | Riot-computed DPM (length-normalised single number) |
| `laneMinionsFirst10Minutes` | own CS@10 — lets us avoid the timeline read for this stat |

Stretch picks if there's display real estate: `maxLevelLeadLaneOpponent`, `maxCsAdvantageOnLaneOpponent` (lane dominance peaks); `epicMonsterStolenWithoutSmite` (meme stat for weird-stats panel); `skillshotsHit` / `skillshotsDodged` (mechanical accuracy).

**Migration plan:**

1. Define the owner-scoped projection. Land on ingest. New rows are immediately smaller.
2. One-shot script: re-project existing rows in place. Same property as Tier 1B — current cache *is* the raw payload, so we derive the new shape locally with no Riot refetch.
3. Validate: row count matches before/after; sample rows; assert mappers + the three `lol-analytics.service.ts` `findMany` callers produce identical output.
4. `VACUUM FULL` to reclaim disk.

**Effort:** Less than a session. Most of the thinking is "which challenges to keep"; the diff is small.

---

## Tier 1B — Global field stripping on potentially-useful fields (PARKED)

**Goal:** Project Riot payloads to a "stored shape" that's a strict superset of what the mappers consume. Drop the obvious dead-weight fields. **Estimated effect: detail 100KB → ~15–20KB, timeline 300KB → ~50KB. ~5–7× smaller with no compression engine involved.**

**Files (modify):**

- [`apps/api/src/riot/types.ts`](../../../apps/api/src/riot/types.ts) — define a leaner `StoredRiotMatch` / `StoredRiotTimeline` interface alongside the raw `RiotMatch` / `RiotMatchTimeline`
- [`apps/api/src/lol/lol.service.ts`](../../../apps/api/src/lol/lol.service.ts) `getMatchDetail` / `getMatchTimeline` — project to stored shape before `matchDetailCache.create` / `matchTimelineCache.create`
- [`apps/api/src/lol/match-mapper.ts`](../../../apps/api/src/lol/match-mapper.ts) — accept `StoredRiotMatch` as input
- [`apps/api/src/lol/timeline-mapper.ts`](../../../apps/api/src/lol/timeline-mapper.ts) — accept `StoredRiotTimeline`

**Strip-list (conservative)** — drop only what we're certain is dead:

| Field group | Where | Notes |
|---|---|---|
| `RiotMatchParticipant.challenges` | per-participant | ~100 sub-fields, mapper reads none. Single biggest line item — 30–50% of participant size. |
| Damage breakdowns beyond `damage{Magic,Physical,True}DealtToChampions` | per-participant | All the per-source / mitigated splits |
| Per-ping counters (`allInPings`, `assistMePings`, …) | per-participant | None used |
| Granular ward stats (`detectorWardsPlaced` etc.) beyond the totals we keep | per-participant | Verify nothing on Profile/Trends uses these |
| Timeline event types we never project: `WARD_PLACED`, `WARD_KILL`, `PAUSE_*`, `OBJECTIVE_BOUNTY_*`, `LEVEL_UP` (we use SKILL_LEVEL_UP), `CHAMPION_SPECIAL_KILL` | per-event | Cross-check `timeline-mapper.ts` |
| Timeline `participantFrame` fields beyond `{ totalGold, level, minionsKilled, jungleMinionsKilled, position }` | per-frame | The mapper uses only those |

**Strip-list (conservative-but-tempting — defer unless certain)**:

- ~~`perks.statPerks`~~ — **off-limits.** Full rune page panel is a planned tile ([open-work.md](../open-work.md) — match-depth Phase E) and needs stat shards alongside the keystone path. Decided 2026-05-16. Even if revisited, must remain kept on the owner participant.
- Item-purchase-time `goldGain` / `goldCost` fields — used today for nothing, plausibly useful in future build-order tooltips

**Migration plan:**

1. Ship the new projection on ingest. New rows are immediately smaller.
2. One-shot script: re-project existing rows in place from current `detail` / `timeline` columns. **No Riot refetch needed** — the current cache *is* the raw payload, so we can derive the stored shape from it locally. Critically: this means the migration is fully reversible until we change the strip-list.
3. Validate row count matches before/after; sample a few rows and assert the mappers still produce identical output.
4. `VACUUM FULL` the two tables to actually reclaim the freed disk.

**Risks & open questions:**

- A future feature that wants a stripped field requires refetch from Riot for new matches and is **permanently impossible** for matches older than 2 years. Honest mitigation: be conservative; when in doubt, keep.
- Snapshot the original Riot payload format for ~10 sample matches into a fixture file before stripping. Regression insurance if something in the strip-list turns out to matter.

**Effort:** One full session. The risky thinking is "what to drop"; the diff is small.

---

## Tier 2 — zstd-compressed BYTEA (PARKED, depends on Tier 1)

**Goal:** After Tier 1 brings shape down, swap `Json` (jsonb) for `Bytea` containing zstd-compressed JSON. **Estimated effect: stacks on top of Tier 1 for another ~70–80% reduction. Detail ~15KB → ~3KB, timeline ~50KB → ~10KB.**

**Schema changes:**

```prisma
model MatchDetailCache {
  matchId  String   @id
  detail   Bytes    // was: Json
  cachedAt DateTime @default(now())
}

model MatchTimelineCache {
  matchId  String   @id
  timeline Bytes    // was: Json
  cachedAt DateTime @default(now())
}
```

**Helper module:** `apps/api/src/lol/json-compression.ts` with:

```ts
export function compressJson(value: unknown): Buffer;
export function decompressJson<T>(buf: Buffer): T;
```

Use zstd at compression level ~3–6 (good ratio/speed balance). Decompress speed (~500MB/s single-core) is invisible at our row sizes.

**Dependency:** add `@mongodb-js/zstd` (or `fzstd` if we want pure-JS). Verify the dep is small and licence-clean before committing.

**Migration:**

1. Add new `detail_bytes` / `timeline_bytes` columns alongside the old ones.
2. Backfill in batches: read jsonb, compress, write to bytes column.
3. Switch all read paths to the new columns.
4. Drop the old columns. `VACUUM FULL`.

**Cons we're accepting:**

- Lose ability to query *inside* the JSON via Postgres operators. We only fetch by `matchId` today — no actual loss.
- Adds a dependency.

**Effort:** One session for the storage change, helper module, migration script, and test pass.

---

## Tier 3 — zstd dictionary mode (PARKED, probably skip)

Train a zstd dictionary on ~1000 representative match payloads. Use it for all compression. Repetitive JSON compresses exceptionally well against a dictionary — ratios approaching 90%+. Detail could hit ~1–2KB per row.

**Why we'll probably skip:**

- Marginal gain over Tier 2 at portfolio scale.
- Dictionary versioning is a real headache — losing the dictionary means losing the ability to decompress every row that used it.

Revisit only if Tier 1 + Tier 2 still leave us cost-constrained, which is unlikely.

---

## Tier 4 — Postgres `lz4` column compression (safe anytime)

```sql
ALTER TABLE "MatchDetailCache"   ALTER COLUMN detail   SET COMPRESSION lz4;
ALTER TABLE "MatchTimelineCache" ALTER COLUMN timeline SET COMPRESSION lz4;
```

New rows compress with lz4 immediately. Existing rows stay on pglz until rewritten — run `VACUUM FULL` once to recompress. ~10–20% smaller than pglz, faster decompress, zero app code change.

**Mutually exclusive with Tier 2** — once we move to BYTEA + zstd, TOAST compression of already-compressed bytes is a wash. So this is a worth-doing interim if Tier 2 is still far off, and a no-op if Tier 2 is imminent.

**Effort:** 5 minutes + a `VACUUM FULL` (which locks the table briefly).

---

## Tier 5 — TTL / eviction (safe anytime)

The caches are caches, not source-of-truth. Add an eviction policy: drop `MatchDetailCache` / `MatchTimelineCache` rows for matches >180 days old (or whatever the read pattern justifies — measure first).

**Why this is safe even mid-iteration:**

- Doesn't change row *shape* — only row *count*. Compatible with any later Tier 1 / Tier 2 work.
- The actual match data (the `Match` table) is unaffected; only detail + timeline caches are evicted.
- On the rare cold read of an ancient match, we refetch from Riot. If Riot's already aged it out (>2 years), we degrade to "summary view only — detailed timeline no longer available." Acceptable.

**Mechanics:**

- A cron / scheduled task in [`apps/api/src/lol/match-sync.service.ts`](../../../apps/api/src/lol/match-sync.service.ts) (or a sibling) that runs daily:
  ```sql
  DELETE FROM "MatchDetailCache"
  WHERE "matchId" IN (
    SELECT m."matchId" FROM "Match" m
    WHERE m."playedAt" < now() - interval '180 days'
  );
  ```
- Same for `MatchTimelineCache`.
- Index on `Match.playedAt` already exists.

**Tuning:** start at 180 days. Bring it in if storage pressure is real; push it out if cold reads of older matches happen more than rarely.

**Effort:** Less than a session.

---

## Migration safety notes (applies to Tier 1A / 1B / 2)

- **Snapshot fixtures before stripping.** Save ~10 representative raw Riot payloads to a test fixture. Useful as regression insurance and for replaying through a different strip-list if the first one turns out wrong.
- **Migrations are idempotent.** If the script crashes halfway, re-running picks up where it left off (process in batches with a clear "done" marker per row, e.g. existence of the new column value).
- **`VACUUM FULL` locks the table.** Either run during a quiet window or use `pg_repack` to do it online. For a personal app this is fine to run during a deploy.
- **Keep the raw fixture archived** for the first few weeks after the first stripping tier ships — it's the recovery path if we missed something in the strip-list.

---

## Decision log

- **2026-05-16** — Field-by-field audit completed. Three strip axes identified (see audit section). Tier 1A (owner-only retention) extracted as the safer high-value lever and green-lit. Tier 1B retained as a parked deeper cut. No measurements yet; Tier 0 still pending.
- **2026-05-16** — **Chunk A landed** (Tier 0 + validation, no code changes). Findings:
  - **DB footprint smaller than napkin.** `MatchDetailCache`: 4 415 rows, 195 MB total table / 184 MB jsonb, avg 44 KB compressed per row (p50 44, p95 45, p99 61, max 69). `MatchTimelineCache`: 198 rows, 29 MB total / 27 MB jsonb, avg 142 KB per row (p50 140, p95 216, p99 236, max 292). Original 80–120 KB / 200–500 KB estimates were uncompressed JSON — pglz TOAST already halves them. Total current cache footprint is ~225 MB, not 800 MB. Free-tier ceiling still distant.
  - **Timeline is already implicitly owner-scoped on populate.** Only 198 of 4 415 detail-cached matches have a timeline row (22:1 ratio). Tier 1A on timelines is therefore much lower-value than on detail; deprioritized — pursue only after detail-side proves out, or roll into Tier 2.
  - **Owner-only strip saves ~54% of uncompressed JSON** (200-row sample, owner=first participant by metadata index). Projected compressed-bytes saving is materially lower because pglz already dedupes repeated `challenges`/`perks` field-name strings — realistic estimate ~30 %. So ~55 MB recovered on `MatchDetailCache` post-`VACUUM FULL`. Worth doing, not screaming urgent.
  - **All 8 challenges starter fields validated.** In a 100-row sample of participant-0: `soloKills`, `outnumberedKills`, `survivedSingleDigitHpCount`, `effectiveHealAndShielding`, `enemyChampionImmobilizations`, `damagePerMinute`, `laneMinionsFirst10Minutes` all present 100/100. `killParticipation` present 98/100 (minor gap on remakes / older patches). Resolves open question #6.
  - **Strip-list correction — two non-owner field reads were missed in the audit.** `riotMatchToDetail` ([match-mapper.ts:128, 152](../../../apps/api/src/lol/match-mapper.ts)) reads `p.perks.styles[0].selections[0].perk` (keystone) and `p.challenges?.killParticipation` (kp) for **all** participants, not just the owner. Tier 1A must keep both on non-owner rows: keep just the keystone selection inside `perks` (not the full rune page), and keep `challenges` reduced to `{ killParticipation }` rather than removed entirely. Update the strip-list in Chunk B.
  - **Owner-puuid resolution path identified.** [`IdentityService.getLolAccounts()`](../../../apps/api/src/identity/identity.service.ts#L53) returns the allowed `LolAccount[]` (slug + gameName + tagLine + region — no puuid). Chunk B needs `Set<string>` of allowed puuids; resolve once per ingest by joining `Summoner` table on `(gameName, tagLine, region)`, or memoise inside `LolService`. Keep DB-aware lookup in `LolService` rather than adding Prisma dependency to identity.
  - **Analytics callers clean.** `lol-analytics.service.ts` does not reference `challenges` or `perks` anywhere — confirms the three owner-gated `findMany` callers (`getDuos`, `getChampionPairs`, `getChampionBuildFlow`) read only `{ puuid, riotIdGameName, riotIdTagline, championName, teamId, win }` on non-owner participants. Tier 1A strip is safe against current analytics.
  - **Full owner `perks` locked in.** Owner participant keeps the entire `perks` object (full rune page incl. `statPerks` shards and per-perk `var1/var2/var3`). The "full rune page panel" tile listed under match-depth Phase E remainder ([open-work.md](../open-work.md)) is now an explicit retention constraint, and Tier 1B's "conservative-but-tempting `perks.statPerks` strip" is marked off-limits as a result.
  - **Owner `killParticipation` locked in.** Already retained as part of the owner's full `challenges` block, but flagged explicitly so it survives any later "slim owner challenges" temptation — KP is a planned owner-side analytics/trend stat.
  - **Post-arc follow-up scheduled.** After Tier 1A backfill ships, sweep "what feature ideas does the kept owner data unlock that weren't on the roadmap before?" — full rune page panel and KP-over-time tile already on the list; expect 5–10 more from the remaining ~100 owner-side `challenges` sub-fields and the timeline build/skill data we now preserve. Add the surfaced ideas to [vnext-ideas.md](../cross-cutting/vnext-ideas.md) / the relevant roadmap notes in the same commit. See "Follow-up after landing" below.
- **2026-05-17** — **Chunks B + C landed** (projection at ingest + backfill script). `VACUUM FULL` run immediately after. Post-vacuum measurement: **43 MB total** (336 kB heap + TOAST + 152 kB indexes). Baseline was 195 MB — **152 MB recovered (78% reduction)**. Projected saving was ~30% / ~55 MB; actual was ~3× the estimate. The Chunk A assumption that pglz already deduped repeated `challenges`/`perks` field-name strings across TOAST blocks was overly conservative — the stripped rows compress far better than the raw payloads. Tier 1A arc complete. Feature-ideation sweep and `match-cache-storage.md § Follow-up` still pending.

---

## Open questions (resolve when starting)

1. **Exact strip-list for Tier 1B.** The conservative list above is a starting point; expand or contract based on what `MatchSummary`/`MatchDetail`/`MatchTimelineProjection` look like at that point.
2. **Compression level for Tier 2.** zstd levels 3, 6, and 9 all have different ratio/CPU tradeoffs. Benchmark on representative data before committing.
3. **Dictionary versioning if Tier 3 happens.** How do we keep old rows readable when a new dictionary is trained?
4. **TTL window for Tier 5.** 180 days is a guess. Inform with read-frequency data once we have it.
5. **Hosting implications.** Does the chosen hosting option (see [hosting.md](../ops/hosting.md)) provide Postgres 14+ for `lz4`, and `VACUUM FULL` privileges? Verify before Tier 4.
6. **Tier 1A challenges sub-list.** ~~Validate the 8 starter picks against a real cached row.~~ Resolved 2026-05-16 in Chunk A — 7/8 present 100%, `killParticipation` 98% (only gap is remakes/older patches; mapper already uses `?? 0`).

---

## Follow-up after landing

~~When Tier 1A backfill ships, do a feature-ideation sweep against the data we deliberately kept.~~ **Done 2026-05-17.** Full sweep written up in [lol-owner-data-features.md](lol-owner-data-features.md) — covers spell casts, multikills, challenges sub-fields, damage panels, CC/death stats, per-game match report card (PG4 expansion), and what was explicitly ruled out (all-10 damage-received bars). See that note for priority table and cross-references.

---

## Connections to existing notes

- [hosting.md](../ops/hosting.md) — DB hosting choice (Neon / Railway-managed / Fly Postgres) determines available compression options and storage limits.
- [project-history.md](../project-history.md) — once any tier lands, log it here as a shipped initiative.
- [case-study-topics.md](../cross-cutting/case-study-topics.md) — "Cut DB row size 30× via projection-on-ingest + zstd" is a strong standalone write-up if Tier 1 + 2 land.
- [vnext-ideas.md](../cross-cutting/vnext-ideas.md) — record the trigger conditions here too if the team wants visibility into "what's parked and why."
