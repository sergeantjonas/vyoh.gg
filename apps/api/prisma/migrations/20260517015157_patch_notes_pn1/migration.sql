-- CreateTable
CREATE TABLE "PatchVersion" (
    "version" TEXT NOT NULL,
    "patchDate" TIMESTAMP(3),
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PatchVersion_pkey" PRIMARY KEY ("version")
);

-- CreateTable
CREATE TABLE "ChampionPatchChange" (
    "id" SERIAL NOT NULL,
    "patchVersion" TEXT NOT NULL,
    "championKey" TEXT NOT NULL,
    "ability" TEXT,
    "changeText" TEXT NOT NULL,
    "changeType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChampionPatchChange_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChampionPatchChange_patchVersion_championKey_idx" ON "ChampionPatchChange"("patchVersion", "championKey");

-- AddForeignKey
ALTER TABLE "ChampionPatchChange" ADD CONSTRAINT "ChampionPatchChange_patchVersion_fkey" FOREIGN KEY ("patchVersion") REFERENCES "PatchVersion"("version") ON DELETE RESTRICT ON UPDATE CASCADE;
