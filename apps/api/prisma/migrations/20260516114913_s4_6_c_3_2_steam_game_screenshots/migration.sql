-- AlterTable
ALTER TABLE "SteamGameEnrichment" ADD COLUMN     "screenshots" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "screenshotsFetchedAt" TIMESTAMP(3);
