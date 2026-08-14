-- AlterTable
ALTER TABLE "LolAccount" ADD COLUMN     "hiddenAt" TIMESTAMP(3),
ADD COLUMN     "syncPausedAt" TIMESTAMP(3);
