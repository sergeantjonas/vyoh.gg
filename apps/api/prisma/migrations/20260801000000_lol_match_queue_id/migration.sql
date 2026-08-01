-- Store Riot's numeric queueId next to the existing `queueType` label, and
-- make it the value every filter/bucket keys on. Labels are not injective
-- (1700/1710 both read "Arena", 1810-1840 all read "Swarm", 830/870 both read
-- "Co-op vs AI Intro"), and `queueLabel()` persists a `Queue 3130` placeholder
-- for anything unmapped, which freezes whatever the map happened to say at
-- ingest time. Neither problem is fixable while the string is the stored truth.
--
-- Backfilled here rather than by a follow-up script so the column can be
-- NOT NULL from the moment it exists: a nullable window would force a
-- `?? fallback` at every projection site, and there is no honest fallback
-- (0 is a real queueId meaning Custom).

ALTER TABLE "Match" ADD COLUMN "queueId" INTEGER;

-- Authoritative source: the raw Riot payload we already store per match.
-- Covers 5770 of 5776 rows on the owner's dataset as of 2026-08-01.
UPDATE "Match" m
SET "queueId" = (c.detail -> 'info' ->> 'queueId')::int
FROM "MatchDetailCache" c
WHERE c."matchId" = m."matchId"
  AND c.detail -> 'info' ->> 'queueId' IS NOT NULL;

-- Remaining rows have no detail cache to read. Reverse-mapping the label is
-- only sound for labels that map back to exactly one id, so this list is
-- restricted to the injective ones. Every straggler on the owner's dataset
-- falls in here (3x Ranked Solo, 1x Ranked Flex, 1x Normal Draft, 1x ARAM).
UPDATE "Match"
SET "queueId" = CASE "queueType"
    WHEN 'Ranked Solo'   THEN 420
    WHEN 'Ranked Flex'   THEN 440
    WHEN 'Normal Draft'  THEN 400
    WHEN 'Normal Blind'  THEN 430
    WHEN 'ARAM'          THEN 450
    WHEN 'Swiftplay'     THEN 480
    WHEN 'Quickplay'     THEN 490
    WHEN 'Clash'         THEN 700
    WHEN 'ARAM Clash'    THEN 720
    WHEN 'One for All'   THEN 1020
    WHEN 'Nexus Blitz'   THEN 1300
    WHEN 'Ultimate Spellbook' THEN 1400
  END
WHERE "queueId" IS NULL;

-- A row that survives both passes has an ambiguous label and no cached
-- payload, so there is no way to recover its id here. Fail the migration with
-- something readable instead of a bare NOT NULL violation: the fix is to
-- re-fetch those matches (they will repopulate MatchDetailCache) and re-run.
DO $$
DECLARE unresolved text;
BEGIN
  SELECT string_agg(DISTINCT "queueType", ', ') INTO unresolved
  FROM "Match" WHERE "queueId" IS NULL;

  IF unresolved IS NOT NULL THEN
    RAISE EXCEPTION
      'Cannot derive queueId for Match rows with labels: %. These have no MatchDetailCache entry and a label that maps to more than one queueId. Re-fetch them, then re-run this migration.',
      unresolved;
  END IF;
END $$;

ALTER TABLE "Match" ALTER COLUMN "queueId" SET NOT NULL;

-- Filtering match history by queue previously scanned the label string with
-- only ([puuid, playedAt]) available. This covers the numeric filter and its
-- ordering together.
CREATE INDEX "Match_puuid_queueId_playedAt_idx" ON "Match"("puuid", "queueId", "playedAt");
