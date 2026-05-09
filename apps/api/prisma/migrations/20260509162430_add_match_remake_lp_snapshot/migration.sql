-- AlterTable
ALTER TABLE "Match" ADD COLUMN     "remake" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "snapshotLp" INTEGER,
ADD COLUMN     "snapshotRank" TEXT,
ADD COLUMN     "snapshotTier" TEXT;
