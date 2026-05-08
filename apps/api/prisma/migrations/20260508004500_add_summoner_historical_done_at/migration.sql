-- One-shot Prisma migration: tracks when a summoner's historical backfill
-- worker has reached genesis (Riot returned a short page) so the cron stops
-- asking for older matches. Nullable; null = still walking.
-- AlterTable
ALTER TABLE "Summoner" ADD COLUMN "historicalDoneAt" TIMESTAMP(3);
