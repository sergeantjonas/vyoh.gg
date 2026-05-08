-- CreateTable
CREATE TABLE "RankSnapshot" (
    "id" SERIAL NOT NULL,
    "puuid" TEXT NOT NULL,
    "queueId" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "rank" TEXT NOT NULL,
    "leaguePoints" INTEGER NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RankSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RankSnapshot_puuid_queueId_capturedAt_idx" ON "RankSnapshot"("puuid", "queueId", "capturedAt");

-- AddForeignKey
ALTER TABLE "RankSnapshot" ADD CONSTRAINT "RankSnapshot_puuid_fkey" FOREIGN KEY ("puuid") REFERENCES "Summoner"("puuid") ON DELETE RESTRICT ON UPDATE CASCADE;
