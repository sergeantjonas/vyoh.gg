-- CreateTable
CREATE TABLE "SteamGameEnrichment" (
    "appid" INTEGER NOT NULL,
    "assetUrlFormat" TEXT,
    "assetTimestamp" BIGINT,
    "libraryCapsulePath" TEXT,
    "libraryCapsule2xPath" TEXT,
    "libraryHeroPath" TEXT,
    "libraryHero2xPath" TEXT,
    "headerPath" TEXT,
    "heroCapsulePath" TEXT,
    "appType" INTEGER,
    "releaseDate" DATE,
    "isFree" BOOLEAN,
    "tagIds" INTEGER[],
    "featureCategoryIds" INTEGER[],
    "enrichedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SteamGameEnrichment_pkey" PRIMARY KEY ("appid")
);

-- AddForeignKey
ALTER TABLE "SteamGameEnrichment" ADD CONSTRAINT "SteamGameEnrichment_appid_fkey" FOREIGN KEY ("appid") REFERENCES "SteamOwnedGame"("appid") ON DELETE RESTRICT ON UPDATE CASCADE;
