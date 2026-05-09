-- Replace opponents String[] with structured laneOpponent Json?
-- Drop the old column (champion-name-only strings), add typed JSON field.
ALTER TABLE "Match" DROP COLUMN "opponents";
ALTER TABLE "Match" ADD COLUMN "laneOpponent" JSONB;

-- Purge projected MatchDetailCache rows so backfill re-stores raw Riot payloads.
-- After this migration every MatchDetailCache miss re-fetches from Riot and stores
-- the raw payload; riotMatchToDetail is called at read time, not write time.
DELETE FROM "MatchDetailCache";
