-- CreateTable
CREATE TABLE "SteamOwnedGame" (
    "appid" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removedAt" TIMESTAMP(3),

    CONSTRAINT "SteamOwnedGame_pkey" PRIMARY KEY ("appid")
);

-- CreateTable
CREATE TABLE "SteamPlaytimeSnapshot" (
    "appid" INTEGER NOT NULL,
    "snapshotDate" DATE NOT NULL,
    "playtimeForeverMinutes" INTEGER NOT NULL,
    "playtime2WeeksMinutes" INTEGER,

    CONSTRAINT "SteamPlaytimeSnapshot_pkey" PRIMARY KEY ("appid","snapshotDate")
);

-- CreateIndex
CREATE INDEX "SteamPlaytimeSnapshot_snapshotDate_idx" ON "SteamPlaytimeSnapshot"("snapshotDate");

-- AddForeignKey
ALTER TABLE "SteamPlaytimeSnapshot" ADD CONSTRAINT "SteamPlaytimeSnapshot_appid_fkey" FOREIGN KEY ("appid") REFERENCES "SteamOwnedGame"("appid") ON DELETE RESTRICT ON UPDATE CASCADE;
