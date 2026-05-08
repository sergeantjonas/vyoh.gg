-- AlterTable
ALTER TABLE "RankSnapshot" ADD COLUMN     "hotStreak" BOOLEAN,
ADD COLUMN     "losses" INTEGER,
ADD COLUMN     "wins" INTEGER;

-- AlterTable
ALTER TABLE "Summoner" ADD COLUMN     "profileIconId" INTEGER,
ADD COLUMN     "summonerLevel" INTEGER;
