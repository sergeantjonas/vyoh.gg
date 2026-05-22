-- PN3: explicit "this row has timeline-derived metrics" flag.
-- Before: `csAt10 > 0` was the implicit sentinel for "timeline projected".
-- That sentinel breaks once we backfill csAt10 from challenges.laneMinionsFirst10Minutes
-- for matches that never had a timeline fetched. The flag disambiguates the two.
ALTER TABLE "Match" ADD COLUMN "hasTimeline" BOOLEAN NOT NULL DEFAULT false;

-- Backfill: any row that already has timeline-derived data (non-empty deathTimings,
-- or non-zero csAt15/goldAt10 — all only ever populated from a timeline fetch)
-- gets the flag set true. csAt10 alone is not enough because PN3 will soon
-- populate csAt10 from challenges, so we'd be unable to distinguish the source.
UPDATE "Match"
SET "hasTimeline" = true
WHERE cardinality("deathTimings") > 0
   OR "csAt15" > 0
   OR "goldAt10" > 0;
