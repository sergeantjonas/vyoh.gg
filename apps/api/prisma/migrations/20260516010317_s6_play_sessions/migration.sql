-- CreateTable
CREATE TABLE "SteamPlaySession" (
    "id" TEXT NOT NULL,
    "appid" INTEGER NOT NULL,
    "gameNameSnapshot" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "SteamPlaySession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SteamPlaySession_endedAt_idx" ON "SteamPlaySession"("endedAt");

-- CreateIndex
CREATE INDEX "SteamPlaySession_appid_startedAt_idx" ON "SteamPlaySession"("appid", "startedAt");
