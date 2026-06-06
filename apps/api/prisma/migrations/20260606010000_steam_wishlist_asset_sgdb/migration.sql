-- AlterTable
ALTER TABLE "SteamWishlistAsset"
  ADD COLUMN "sgdbHeroUrl" TEXT,
  ADD COLUMN "sgdbHeroWidth" INTEGER,
  ADD COLUMN "sgdbHeroHeight" INTEGER,
  ADD COLUMN "sgdbEnrichedAt" TIMESTAMP(3);
