-- CreateTable
CREATE TABLE "SteamPlayerState" (
    "steamId" TEXT NOT NULL,
    "personaName" TEXT NOT NULL,
    "avatarUrl" TEXT NOT NULL,
    "personaState" TEXT NOT NULL,
    "profileVisibility" INTEGER NOT NULL,
    "currentAppid" INTEGER,
    "currentGameName" TEXT,
    "lastPolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SteamPlayerState_pkey" PRIMARY KEY ("steamId")
);
