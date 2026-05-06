/*
  Warnings:

  - The primary key for the `Match` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - Added the required column `puuid` to the `Match` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Match" DROP CONSTRAINT "Match_pkey",
ADD COLUMN     "puuid" TEXT NOT NULL,
ADD CONSTRAINT "Match_pkey" PRIMARY KEY ("matchId", "puuid");

-- CreateTable
CREATE TABLE "Summoner" (
    "puuid" TEXT NOT NULL,
    "gameName" TEXT NOT NULL,
    "tagLine" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Summoner_pkey" PRIMARY KEY ("puuid")
);

-- CreateIndex
CREATE UNIQUE INDEX "Summoner_gameName_tagLine_region_key" ON "Summoner"("gameName", "tagLine", "region");

-- CreateIndex
CREATE INDEX "Match_puuid_playedAt_idx" ON "Match"("puuid", "playedAt");

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_puuid_fkey" FOREIGN KEY ("puuid") REFERENCES "Summoner"("puuid") ON DELETE RESTRICT ON UPDATE CASCADE;
