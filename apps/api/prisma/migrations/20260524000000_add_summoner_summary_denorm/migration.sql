-- AlterTable
ALTER TABLE "Summoner" ADD COLUMN     "currentRankDivision" TEXT,
ADD COLUMN     "currentRankLp" INTEGER,
ADD COLUMN     "currentRankQueue" TEXT,
ADD COLUMN     "currentRankTier" TEXT,
ADD COLUMN     "lastPlayedChampionAlias" TEXT,
ADD COLUMN     "summaryUpdatedAt" TIMESTAMP(3);
