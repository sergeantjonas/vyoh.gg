-- AlterTable
ALTER TABLE "Match" ADD COLUMN     "snapshotLpBefore" INTEGER,
ADD COLUMN     "snapshotRankBefore" TEXT,
ADD COLUMN     "snapshotTierBefore" TEXT;

-- Backfill: for each ranked Match row, find the most recent RankSnapshot
-- captured strictly before the match was played and copy its tier/rank/LP
-- into the new *Before columns. Decay or any other non-match LP movement
-- between matches no longer poisons per-match delta calculations because
-- delta becomes self-contained: (snapshotLp - snapshotLpBefore).
UPDATE "Match" m
SET
  "snapshotTierBefore" = sub.tier,
  "snapshotRankBefore" = sub.rank,
  "snapshotLpBefore"   = sub."leaguePoints"
FROM (
  SELECT DISTINCT ON (m2."matchId", m2.puuid)
    m2."matchId",
    m2.puuid,
    rs.tier,
    rs.rank,
    rs."leaguePoints"
  FROM "Match" m2
  JOIN "RankSnapshot" rs
    ON rs.puuid = m2.puuid
   AND rs."capturedAt" < m2."playedAt"
   AND rs."queueId" = CASE m2."queueType"
     WHEN 'Ranked Solo' THEN 'RANKED_SOLO_5x5'
     WHEN 'Ranked Flex' THEN 'RANKED_FLEX_SR'
   END
  WHERE m2."queueType" IN ('Ranked Solo', 'Ranked Flex')
  ORDER BY m2."matchId", m2.puuid, rs."capturedAt" DESC
) sub
WHERE m."matchId" = sub."matchId" AND m.puuid = sub.puuid;
