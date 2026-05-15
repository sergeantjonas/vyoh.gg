-- CreateTable
CREATE TABLE "SteamGameAchievement" (
    "appid" INTEGER NOT NULL,
    "apiName" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "iconUrl" TEXT NOT NULL,
    "iconGrayUrl" TEXT NOT NULL,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "schemaFetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SteamGameAchievement_pkey" PRIMARY KEY ("appid","apiName")
);

-- CreateTable
CREATE TABLE "SteamPlayerUnlock" (
    "appid" INTEGER NOT NULL,
    "apiName" TEXT NOT NULL,
    "unlockedAt" TIMESTAMP(3) NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SteamPlayerUnlock_pkey" PRIMARY KEY ("appid","apiName")
);

-- CreateTable
CREATE TABLE "SteamAchievementGlobalRarity" (
    "appid" INTEGER NOT NULL,
    "apiName" TEXT NOT NULL,
    "percent" DOUBLE PRECISION NOT NULL,
    "polledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SteamAchievementGlobalRarity_pkey" PRIMARY KEY ("appid","apiName")
);

-- CreateTable
CREATE TABLE "SteamGameAchievementMeta" (
    "appid" INTEGER NOT NULL,
    "achievementCount" INTEGER,
    "lastSchemaCheckedAt" TIMESTAMP(3),
    "lastUnlocksCheckedAt" TIMESTAMP(3),
    "lastRarityCheckedAt" TIMESTAMP(3),

    CONSTRAINT "SteamGameAchievementMeta_pkey" PRIMARY KEY ("appid")
);

-- CreateIndex
CREATE INDEX "SteamPlayerUnlock_unlockedAt_idx" ON "SteamPlayerUnlock"("unlockedAt");

-- AddForeignKey
ALTER TABLE "SteamGameAchievement" ADD CONSTRAINT "SteamGameAchievement_appid_fkey" FOREIGN KEY ("appid") REFERENCES "SteamOwnedGame"("appid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SteamPlayerUnlock" ADD CONSTRAINT "SteamPlayerUnlock_appid_apiName_fkey" FOREIGN KEY ("appid", "apiName") REFERENCES "SteamGameAchievement"("appid", "apiName") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SteamAchievementGlobalRarity" ADD CONSTRAINT "SteamAchievementGlobalRarity_appid_apiName_fkey" FOREIGN KEY ("appid", "apiName") REFERENCES "SteamGameAchievement"("appid", "apiName") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SteamGameAchievementMeta" ADD CONSTRAINT "SteamGameAchievementMeta_appid_fkey" FOREIGN KEY ("appid") REFERENCES "SteamOwnedGame"("appid") ON DELETE RESTRICT ON UPDATE CASCADE;
