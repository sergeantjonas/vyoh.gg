# Queue identity: migrate `Match.queueType` label → numeric `queueId`

**Status:** Active — chunks 1–4 shipped 2026-08-01; `queueType` no longer exists, and every live queue has a label. Chunk 5 is open and was not in the original plan: queue 710 ("Ranked 5s") carries LP on a `RANKED_PREMADE_5x5` ladder that the rank poller discards.

## Why

`Match.queueType` stores a *rendered label*, not Riot's `queueId`. Everything downstream then matches on that string, which fails in three ways that no test or type catches:

1. **`queueLabel()` persists its own fallback.** An id the map doesn't know is stored as the literal `"Queue 3130"`, freezing whatever the map said at ingest time. Adding the real name later does not relabel the rows that already exist. Live examples in the owner's data: `Queue 0` (1 row), `Queue 3100` (11), `Queue 3130` (18).
2. **Labels are not injective.** 1700/1710 both read "Arena"; 1810–1840 all read "Swarm"; 830/870, 840/880, 850/890 pair up as "Co-op vs AI …". Anything bucketing on the string silently merges distinct queues. The snapshot bucketing in `lol.service.ts` does exactly this.
3. **The filter works by coincidence.** `getCachedMatches` turns a numeric `queue` param back into a label (`where.queueType = queueTypeName(queue)`) and matches on the string. It agrees with the data only because the same function wrote it. Change a label and existing rows stop matching, with no error.

The web side has the same shape in the place it matters most: `filterToSerious` maps the selected ids to labels through its own local `CONFIGURABLE_SERIOUS_QUEUES` copy, then intersects on `m.queueType`. That copy is independent of `QUEUE_TYPES`, so renaming the canonical label for 400 would make Normal Draft **silently vanish from every statistic** rather than fail.

## Scope decision: serious-queues stays as-is

Customs (0, 3100, 3130) are already excluded from every analysis surface, because `CONFIGURABLE_SERIOUS_QUEUES` is an opt-in allowlist of 420/440/400 and nothing else can enter it. **Do not add a parallel `excludeCustoms()` predicate** — the allowlist is the mechanism, and a deny-list beside it would be a second vocabulary for the same decision. The migration rekeys `filterToSerious` from labels to ids; it does not change which surfaces filter.

The identity/cadence surfaces (Recent form, Now playing, Queue distribution, Activity calendar, Stats bar, Duos) deliberately bypass `useSeriousMatches` and show all queues — see the JSDoc on `useSeriousMatches`. That split is intentional and preserved.

## Chunks

- **1 — persist the number.** ✅ 2026-08-01. `queueId` on `MatchSummary` + `MatchDetail`, emitted by both mappers; `Match.queueId Int` + `([puuid, queueId, playedAt])` index; migration `20260801000000_lol_match_queue_id` backfills in-place. Nothing reads it yet.
- **2 — api reads the number.** ✅ 2026-08-01. `getCachedMatches`' filter, the snapshot bucketing in `lol.service.ts`, the ARAM and calibration filters in `lol-analytics.service.ts`, the champion-extras queue filter, and all 11 ranked-queue filters in `lol-moments.service.ts` now match `Match.queueId`. `RANKED_QUEUE_TYPES` (a local string list) is replaced by `RANKED_QUEUE_IDS` in `@vyoh/shared`, derived from `RANKED_QUEUE_MAP`'s keys so the two can't drift.

  Measured effect on the owner's data: filtering Swarm by 1810 returned **155** rows before (every Swarm variant, because they share a label) and returns **145** after; 1820 returned **155** and returns **10**. Every non-colliding queue is unchanged, which is the check that the migration was faithful.

  One label-keyed site deliberately left for chunk 3: `computeCalibrationByQueue` in `packages/shared/src/lol/pregame-signals.ts` buckets on `queueType` and returns a record keyed by label. The *query* feeding it is numeric now; changing the record's keys changes a wire shape that web consumes, so it moves with web.
- **3a — web keys on the number.** ✅ 2026-08-01. `filterToSerious` compares ids (`selectedLabels` deleted); `computeCalibrationByQueue` and `ReplayPoint` rekey to `queueId`, so `PregameCalibrationByQueue` is now `Record<number, …>` on the wire; `queueColor` takes an id; three label Sets living in three separate components (`ARAM_ARENA_QUEUES`, `NON_RIFT_QUEUES`, `SR_QUEUES`) collapse into `NON_LANED_QUEUE_IDS` + `SR_LANE_QUEUE_IDS` in shared; `match-build-order`'s `queueType.includes("Ranked")` becomes `RANKED_QUEUE_IDS`; `QUEUE_TYPE_FOR_BOUNDARIES` was a local duplicate of `RANKED_QUEUE_KEY_TO_ID` and is gone.

  **Watch the set membership when porting a label test to ids.** A label test covered every id sharing that label *for free* — `"Arena"` caught 1700 and 1710 both. An id set has to list them on purpose or it silently narrows, which is a behaviour change disguised as a refactor. Pinned by a test in `queue-types.test.ts`.

  Two things stay label-keyed on purpose, both display-only: the distribution donut groups by label (four Swarm ids are one legend row, not four), and `queueColor` resolves the id to a label before picking a colour so a queue family paints as one colour. Neither is a filter.
- **3b — drop the label.** ✅ 2026-08-01. Display sites render `queueLabel(queueId)`; `queueType` is gone from `MatchSummary`, `MatchDetail` and `LolMomentMatchStats`, and migration `20260801120000_lol_match_drop_queue_type` drops the column. `OgMatchCardData.queueType` became `queueLabel`, since that field really is a pre-rendered string and keeping the old name would have re-seeded the confusion. The api-side `lol/queue-types.ts` shim is deleted — after the mapper stopped calling `queueTypeName`, it re-exported one symbol straight from `@vyoh/shared` to one consumer.

  **The drop was proven lossless before it ran**, not argued to be: `queueLabel(queueId) === queueType` held for all 5781 rows, including the frozen `Queue 0` / `Queue 710` / `Queue 3100` / `Queue 3130` placeholders, which the fallback reproduces character-for-character.

  **Found a live bug while doing it.** `match-detail-recap-tab` gated the owner's CS personal-record wrap on `RANKED_QUEUE_TYPES.has(matchQueueType)`, where the Set held *League-V4* strings (`RANKED_SOLO_5x5`) and the argument was the *Match-V5* label (`Ranked Solo`). It had never matched, in any queue — `Set<string>.has(string)` type-checks perfectly. The prop is now `matchQueueId: number` tested against `RANKED_QUEUE_IDS`, with tests pinning both the ranked and the excluded case. Four `MatchSummary` test fixtures carried the same mix-up in the other direction (`queueType: "RANKED_SOLO_5x5"`), harmless only because nothing read the field.

  Also fixed in passing: `prisma/seed.ts` had been broken since chunk 1 made `queueId` required. `prisma/*.ts` sits outside the api's `include: ["src"]`, so no typecheck covers it.
- **4 — extend the map.** ✅ 2026-08-01. Brawl (2300, 2301–2305), ARAM: Mayhem (2400/2401/2403/2405/2410/2450, 3240/3270/3280), customs (0, 3100), Tournament Draft (3130) and **710 → "Ranked 5s"**. Brawl and Mayhem join `NON_LANED_QUEUE_IDS`; 710 joins `SR_LANE_QUEUE_IDS` (verified from its own payload: mapId 11, 10 participants, `teamPosition` populated). `queueLabelExpanded`'s `queueId === 0` special case folded into the map.

  Because 3b made the label derived, this relabelled every already-stored row on deploy — the reported `Queue 710` included — with no backfill.

  **Names came from CommunityDragon's queue catalogue, not Riot's static `queues.json`, which does not contain 710 at all.** Prefer CommunityDragon when adding a live queue; the static doc lags.

- **5 — the `RANKED_PREMADE_5x5` ladder.** Not started. 710 carries real LP on its own League-V4 ladder, and we throw every capture of it away.

  Confirmed against live Riot data 2026-08-01: League-V4 `entries/by-puuid` returns `RANKED_PREMADE_5x5` (MASTER I, 8W/4L) alongside solo and flex, and match-v5 `ids?queue=710` returns exactly 12 — the same 12 games. Riot has repurposed the legacy premade-team string for this queue.

  **Do not conclude "there is no ladder" from the `RankSnapshot` table.** [lol.service.ts:505](../../../apps/api/src/lol/lol.service.ts) `continue`s past any `queueType` that is not solo or flex before writing, so the table can only ever contain those two — querying it and reading the result as evidence about what League-V4 returns is circular, and did produce a wrong answer once.

  The two-ladder assumption is hardcoded at ~15 sites, so this is not a map edit: `lol.service.ts` (the poller filter, the rank-history fetch pair, the solo/flex snapshot bucketing, the latest-per-queue read), `RankHistoryResponse`'s `{ solo, flex }` wire shape, `live-game-poller`, `og.service`, `nav.tsx`, `$accountSlug/index.tsx`, plus the `RankedQueueKey = "solo" | "flex"` union behind LP history, season history and the hero rank strip.

  Two product decisions gate it: whether 710 enters `RANKED_QUEUE_MAP` (which would put it in `RANKED_QUEUE_IDS` — the moment detectors' "real ELO consequences" filter and the CS personal-record gate), and whether it joins `CONFIGURABLE_SERIOUS_QUEUES` so its games can count toward statistics. Note `RANKED_QUEUE_IDS` is documented as "which queues carry LP"; 710 satisfies that, so leaving it out needs its own reason.

## Constraint: no LoL Classic

Riot Developer Relations announced 2026-07-28 that League Classic match history is **not** exposed through the Riot API, and asked that League Classic data not be aggregated or displayed in any form (Tournament API map-type support is the sole exception). Confirmed against our own data: no unmapped modern queue ids are present, consistent with Classic never arriving. **Do not add a Classic entry to `QUEUE_TYPES` and do not build a workaround.**

One unverified path: `live-game-poller.service.ts` passes `gameQueueConfigId` through with no filter, so if spectator-v5 surfaces a Classic game it would reach the live halo / favicon dot / now-playing strip. Owner to observe next time they play Classic.

## Backfill provenance

The migration reads `MatchDetailCache.detail->'info'->>'queueId'` (5770 of 5776 rows) and falls back to a reverse-map restricted to **injective** labels for the rest (6 rows: 3× Ranked Solo, 1× Ranked Flex, 1× Normal Draft, 1× ARAM). Anything unresolved by both passes aborts the migration with a readable `RAISE EXCEPTION` naming the offending labels, rather than a bare NOT NULL violation. Post-migration verification: 0 nulls, 0 rows disagreeing with the raw payload.
