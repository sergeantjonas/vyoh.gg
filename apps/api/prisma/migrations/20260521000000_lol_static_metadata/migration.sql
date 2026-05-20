-- LoL static-metadata pipeline (Chunk 4a): five tables that replace the
-- client-side CDragon JSON fetches with a server-side wiki + DDragon-as-bridge
-- pipeline. See docs/working-notes/lol/lol-static-metadata.md.

-- CreateTable
CREATE TABLE "LolItem" (
    "id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "tier" INTEGER,
    "itemType" JSONB NOT NULL DEFAULT '[]',
    "priceTotal" INTEGER,
    "recipe" JSONB NOT NULL DEFAULT '[]',
    "categories" JSONB NOT NULL DEFAULT '[]',
    "stats" JSONB NOT NULL DEFAULT '{}',
    "descriptionWikitext" TEXT,
    "descriptionHtml" TEXT,
    "iconWikiName" TEXT,
    "wikiSyncedAt" TIMESTAMP(3) NOT NULL,
    "wikiSyncedPatchVersion" TEXT,

    CONSTRAINT "LolItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LolItem_name_key" ON "LolItem"("name");

-- CreateTable
CREATE TABLE "LolChampion" (
    "id" INTEGER NOT NULL,
    "alias" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "roles" JSONB NOT NULL DEFAULT '[]',
    "ddragonSyncedAt" TIMESTAMP(3) NOT NULL,
    "wikiSyncedAt" TIMESTAMP(3),
    "wikiSyncedPatchVersion" TEXT,

    CONSTRAINT "LolChampion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LolChampion_alias_key" ON "LolChampion"("alias");

-- CreateIndex
CREATE UNIQUE INDEX "LolChampion_name_key" ON "LolChampion"("name");

-- CreateTable
CREATE TABLE "LolChampionAbility" (
    "championId" INTEGER NOT NULL,
    "slot" TEXT NOT NULL,
    "abilityIndex" INTEGER NOT NULL DEFAULT 0,
    "name" TEXT NOT NULL,
    "iconWikiName" TEXT,
    "descriptionWikitext" TEXT,
    "descriptionHtml" TEXT,

    CONSTRAINT "LolChampionAbility_pkey" PRIMARY KEY ("championId", "slot", "abilityIndex")
);

-- AddForeignKey
ALTER TABLE "LolChampionAbility" ADD CONSTRAINT "LolChampionAbility_championId_fkey" FOREIGN KEY ("championId") REFERENCES "LolChampion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "LolSummonerSpell" (
    "id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "iconWikiName" TEXT,
    "descriptionWikitext" TEXT,
    "descriptionHtml" TEXT,
    "ddragonSyncedAt" TIMESTAMP(3) NOT NULL,
    "wikiSyncedAt" TIMESTAMP(3),
    "wikiSyncedPatchVersion" TEXT,
    "missingSyncCycles" INTEGER NOT NULL DEFAULT 0,
    "retiredAt" TIMESTAMP(3),

    CONSTRAINT "LolSummonerSpell_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LolSummonerSpell_name_key" ON "LolSummonerSpell"("name");

-- CreateTable
CREATE TABLE "LolPerk" (
    "id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "path" TEXT,
    "slot" TEXT,
    "iconWikiName" TEXT,
    "descriptionWikitext" TEXT,
    "descriptionHtml" TEXT,
    "ddragonSyncedAt" TIMESTAMP(3) NOT NULL,
    "wikiSyncedAt" TIMESTAMP(3),
    "wikiSyncedPatchVersion" TEXT,
    "missingSyncCycles" INTEGER NOT NULL DEFAULT 0,
    "retiredAt" TIMESTAMP(3),

    CONSTRAINT "LolPerk_pkey" PRIMARY KEY ("id")
);
