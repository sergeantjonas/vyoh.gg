# vyoh.gg — Match cache storage arc

**Status: parked.** Read this when DB size becomes a cost / quota issue, when feature scope on Profile / Matches / Trends / Champions / Match detail feels stable, or when explicitly revisiting storage cost.

This is a deliberate hold, not an oversight. The conversation that produced this note was on 2026-05-10, when `MatchSummary` had just been extended with `csAt10`, `csAt15`, `goldAt10`, `goldAt15`, and two more fields — proving the "don't strip caches mid-iteration" point in real time. The arc waits until features stabilize.

---

## Why this exists

The match caches store Riot's raw JSON payload. Each row is huge and most of the bytes are fields we never read. Once feature scope on the read paths stops moving, we can dramatically shrink storage without losing anything we use.

## Current state — what we store

Two Prisma `Json` columns (Postgres `jsonb` under the hood):

- [`MatchDetailCache.detail`](../../apps/api/prisma/schema.prisma#L42-L46) — full raw `RiotMatch` payload from `/lol/match/v5/matches/{id}`. **Typical size: 80–120KB per row.**
- [`MatchTimelineCache.timeline`](../../apps/api/prisma/schema.prisma#L48-L52) — full raw `RiotMatchTimeline` payload. **Typical size: 200–500KB per row.**

We project these to leaner shapes (`MatchDetail`, `MatchTimelineProjection`) at **read time** via [`riotMatchToDetail`](../../apps/api/src/lol/match-mapper.ts) and [`riotTimelineToProjection`](../../apps/api/src/lol/timeline-mapper.ts). The mappers read maybe 20 fields per row out of the ~100+ Riot returns. Everything else is dead weight on disk that survives only as a forward-compat hedge.

Napkin scale: ~400KB/match × 1000 matches × 2 accounts ≈ 800MB. Free-tier Postgres (Neon, Supabase) sits at 0.5–1GB. We're close to the ceiling now and will cross it with normal usage.

What Postgres already does for free: `jsonb` auto-TOAST-compresses values over ~2KB with `pglz` (the default). It helps, but it's a mediocre compressor that doesn't dedupe repeated key strings across rows.

## Why this is parked

The biggest lever (Tier 1 below — strip unused fields before storing) is also the most forward-incompatible. **Riot serves match data for ~2 years.** If we strip a field today that we want for a feature next month, we either refetch (rate-limited, slow) or permanently degrade matches older than 2 years.

Premature stripping costs permanent data. The conversation that produced this note showed the hazard directly: a session-ago, `MatchSummary` didn't have `csAt10` / `goldAt10` / etc. If we'd stripped to "what we read" before adding those fields, every match in the cache would be retroactively incomplete.

So the rule is: **stabilize feature scope first, then strip.**

Two things in this arc are *not* parked — they're safe regardless of feature churn and pair cleanly with Tier 1 + 2 later. Land them whenever there's a slot.

---

## Triggers — when to start (Tier 1+)

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

## Tier 1 — Strip unused fields on ingest (the big win, PARKED)

**Goal:** Project Riot payloads to a "stored shape" that's a strict superset of what the mappers consume. Drop the obvious dead-weight fields. **Estimated effect: detail 100KB → ~15–20KB, timeline 300KB → ~50KB. ~5–7× smaller with no compression engine involved.**

**Files (modify):**

- [`apps/api/src/riot/types.ts`](../../apps/api/src/riot/types.ts) — define a leaner `StoredRiotMatch` / `StoredRiotTimeline` interface alongside the raw `RiotMatch` / `RiotMatchTimeline`
- [`apps/api/src/lol/lol.service.ts`](../../apps/api/src/lol/lol.service.ts) `getMatchDetail` / `getMatchTimeline` — project to stored shape before `matchDetailCache.create` / `matchTimelineCache.create`
- [`apps/api/src/lol/match-mapper.ts`](../../apps/api/src/lol/match-mapper.ts) — accept `StoredRiotMatch` as input
- [`apps/api/src/lol/timeline-mapper.ts`](../../apps/api/src/lol/timeline-mapper.ts) — accept `StoredRiotTimeline`

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

- `perks.statPerks` — keystone is used; the 3 stat shards might be picked up later
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

- A cron / scheduled task in [`apps/api/src/lol/match-sync.service.ts`](../../apps/api/src/lol/match-sync.service.ts) (or a sibling) that runs daily:
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

## Migration safety notes (applies to Tier 1 + 2)

- **Snapshot fixtures before stripping.** Save ~10 representative raw Riot payloads to a test fixture. Useful as regression insurance and for replaying through a different strip-list if the first one turns out wrong.
- **Migrations are idempotent.** If the script crashes halfway, re-running picks up where it left off (process in batches with a clear "done" marker per row, e.g. existence of the new column value).
- **`VACUUM FULL` locks the table.** Either run during a quiet window or use `pg_repack` to do it online. For a personal app this is fine to run during a deploy.
- **Keep the raw fixture archived** for the first few weeks after Tier 1 ships — it's the recovery path if we missed something in the strip-list.

---

## Decision log

Empty until we measure. Fill in:

- Date measured, p50/p95/p99 row sizes, total table sizes
- Decision and rationale for each tier when actioned
- Migration timing and outcomes

---

## Open questions (resolve when starting)

1. **Exact strip-list for Tier 1.** The conservative list above is a starting point; expand or contract based on what `MatchSummary`/`MatchDetail`/`MatchTimelineProjection` look like at that point.
2. **Compression level for Tier 2.** zstd levels 3, 6, and 9 all have different ratio/CPU tradeoffs. Benchmark on representative data before committing.
3. **Dictionary versioning if Tier 3 happens.** How do we keep old rows readable when a new dictionary is trained?
4. **TTL window for Tier 5.** 180 days is a guess. Inform with read-frequency data once we have it.
5. **Hosting implications.** Does the chosen hosting option (see [hosting.md](hosting.md)) provide Postgres 14+ for `lz4`, and `VACUUM FULL` privileges? Verify before Tier 4.

---

## Connections to existing notes

- [hosting.md](hosting.md) — DB hosting choice (Neon / Railway-managed / Fly Postgres) determines available compression options and storage limits.
- [project-history.md](project-history.md) — once any tier lands, log it here as a shipped initiative.
- [case-study-topics.md](case-study-topics.md) — "Cut DB row size 30× via projection-on-ingest + zstd" is a strong standalone write-up if Tier 1 + 2 land.
- [vnext-ideas.md](vnext-ideas.md) — record the trigger conditions here too if the team wants visibility into "what's parked and why."
