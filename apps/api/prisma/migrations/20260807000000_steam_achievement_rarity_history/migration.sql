-- Steam's global achievement percentages are a moving value, and until now we
-- kept only the latest one: `refreshRarity` upserts SteamAchievementGlobalRarity
-- in place, so every weekly pass destroyed the previous reading. A probe on
-- 2026-08-07 across 12 games and 857 achievements measured 91 rows moving in a
-- work-week — in both directions, depending on whether the game's owner base is
-- still growing — so there is a real curve there and none of it was kept.
--
-- This table records it. Nothing reads it yet, and that is the point: the data
-- has a lead time no later work can shorten, so the recording has to start
-- before the surface that renders it exists.

-- CreateTable
CREATE TABLE "SteamAchievementRarityHistory" (
    "id" SERIAL NOT NULL,
    "appid" INTEGER NOT NULL,
    "apiName" TEXT NOT NULL,
    "percent" DOUBLE PRECISION NOT NULL,
    "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SteamAchievementRarityHistory_pkey" PRIMARY KEY ("id")
);

-- Every read this table will ever serve is "the series for one achievement, in
-- order", so the index carries the sort as well as the lookup.
-- CreateIndex
CREATE INDEX "SteamAchievementRarityHistory_appid_apiName_observedAt_idx" ON "SteamAchievementRarityHistory"("appid", "apiName", "observedAt");

-- AddForeignKey
ALTER TABLE "SteamAchievementRarityHistory" ADD CONSTRAINT "SteamAchievementRarityHistory_appid_apiName_fkey" FOREIGN KEY ("appid", "apiName") REFERENCES "SteamGameAchievement"("appid", "apiName") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Seed an origin point per achievement from the value we already hold. Without
-- this, a series would begin at its first *move* rather than at its first known
-- reading, which loses the one endpoint we can still recover — and for the
-- settled back-catalogue games, where moves are rare, that is the difference
-- between a series and an empty table.
INSERT INTO "SteamAchievementRarityHistory" ("appid", "apiName", "percent", "observedAt")
SELECT "appid", "apiName", "percent", "polledAt"
FROM "SteamAchievementGlobalRarity";
