-- CreateTable
CREATE TABLE "MatchDetailCache" (
    "matchId" TEXT NOT NULL,
    "detail" JSONB NOT NULL,
    "cachedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MatchDetailCache_pkey" PRIMARY KEY ("matchId")
);
