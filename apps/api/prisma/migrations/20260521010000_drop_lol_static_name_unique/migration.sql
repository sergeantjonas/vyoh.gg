-- Riot legitimately reuses display names across ids (DDragon ships two
-- "Flash" rows, two "Mark" rows, two "Placeholder" rows in summoner.json
-- for ARAM and URF variants). The unique constraint dropped the second of
-- each pair on sync, breaking Flash icon rendering. id is the real key;
-- name is purely display.

DROP INDEX "LolItem_name_key";
DROP INDEX "LolSummonerSpell_name_key";
