-- CreateTable
CREATE TABLE "Match" (
    "matchId" TEXT NOT NULL,
    "queueType" TEXT NOT NULL,
    "champion" TEXT NOT NULL,
    "kills" INTEGER NOT NULL,
    "deaths" INTEGER NOT NULL,
    "assists" INTEGER NOT NULL,
    "win" BOOLEAN NOT NULL,
    "durationSec" INTEGER NOT NULL,
    "playedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Match_pkey" PRIMARY KEY ("matchId")
);
