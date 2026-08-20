-- CreateTable
CREATE TABLE "SteamGameCuration" (
    "appid" INTEGER NOT NULL,
    "name" TEXT,
    "hiddenAt" TIMESTAMP(3),
    "unfeaturedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SteamGameCuration_pkey" PRIMARY KEY ("appid")
);
