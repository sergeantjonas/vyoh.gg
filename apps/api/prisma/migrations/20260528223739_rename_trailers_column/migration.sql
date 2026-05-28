/*
  Warnings:

  - You are about to drop the column `trailersJson` on the `SteamGameEnrichment` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "SteamGameEnrichment" DROP COLUMN "trailersJson",
ADD COLUMN     "trailers" JSONB;
