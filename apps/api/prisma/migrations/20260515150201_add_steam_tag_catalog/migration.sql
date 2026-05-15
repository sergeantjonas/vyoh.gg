-- CreateTable
CREATE TABLE "SteamTag" (
    "id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SteamTag_pkey" PRIMARY KEY ("id")
);
