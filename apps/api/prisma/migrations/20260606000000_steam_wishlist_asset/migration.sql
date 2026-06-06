-- CreateTable
CREATE TABLE "SteamWishlistAsset" (
    "appid" INTEGER NOT NULL,
    "assetUrlFormat" TEXT,
    "assetTimestamp" BIGINT,
    "libraryCapsulePath" TEXT,
    "libraryCapsule2xPath" TEXT,
    "libraryHeroPath" TEXT,
    "libraryHero2xPath" TEXT,
    "headerPath" TEXT,
    "heroCapsulePath" TEXT,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SteamWishlistAsset_pkey" PRIMARY KEY ("appid")
);
