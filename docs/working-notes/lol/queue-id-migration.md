# Queue identity: migrate `Match.queueType` label → numeric `queueId`

**Status:** Active — chunk 1 of 4 shipped 2026-08-01 (column added, all 5776 rows backfilled, nothing reads it yet). Next: chunk 2, move api reads onto the number.

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
- **2 — api reads the number.** Move `getCachedMatches`' filter, the snapshot bucketing in `lol.service.ts`, `RANKED_QUEUE_TYPES` in `lol-moments.service.ts`, and the label-keyed sites in `lol-analytics.service.ts` / `lol-champion-analytics.service.ts` off the string.
- **3 — web reads the number.** `filterToSerious` compares ids and `selectedLabels` is deleted; `queue-color.ts` anchors rekey from labels to ids; labels become render-time `queueLabel(queueId)`. Then drop `queueType` from the wire types and the column.
- **4 — extend the map.** Brawl (2300, 2301–2305) and ARAM: Mayhem (2400/2401/2403/2405/2410/2450, 3240/3270/3280) are live public modes with no entry today; customs (0, 3100, 3130) get real labels. Must follow chunk 2 — adding a label for a currently-unmapped id while the filter still round-trips strings would break existing rows.

## Constraint: no LoL Classic

Riot Developer Relations announced 2026-07-28 that League Classic match history is **not** exposed through the Riot API, and asked that League Classic data not be aggregated or displayed in any form (Tournament API map-type support is the sole exception). Confirmed against our own data: no unmapped modern queue ids are present, consistent with Classic never arriving. **Do not add a Classic entry to `QUEUE_TYPES` and do not build a workaround.**

One unverified path: `live-game-poller.service.ts` passes `gameQueueConfigId` through with no filter, so if spectator-v5 surfaces a Classic game it would reach the live halo / favicon dot / now-playing strip. Owner to observe next time they play Classic.

## Backfill provenance

The migration reads `MatchDetailCache.detail->'info'->>'queueId'` (5770 of 5776 rows) and falls back to a reverse-map restricted to **injective** labels for the rest (6 rows: 3× Ranked Solo, 1× Ranked Flex, 1× Normal Draft, 1× ARAM). Anything unresolved by both passes aborts the migration with a readable `RAISE EXCEPTION` naming the offending labels, rather than a bare NOT NULL violation. Post-migration verification: 0 nulls, 0 rows disagreeing with the raw payload.
