CREATE TABLE "MatchTimelineCache" (
    "matchId" TEXT NOT NULL,
    "timeline" JSONB NOT NULL,
    "cachedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MatchTimelineCache_pkey" PRIMARY KEY ("matchId")
);
