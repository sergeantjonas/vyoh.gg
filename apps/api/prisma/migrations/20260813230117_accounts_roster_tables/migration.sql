-- CreateTable
CREATE TABLE "LolAccount" (
    "slug" TEXT NOT NULL,
    "gameName" TEXT NOT NULL,
    "tagLine" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "isOwner" BOOLEAN NOT NULL DEFAULT false,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LolAccount_pkey" PRIMARY KEY ("slug")
);

-- CreateTable
CREATE TABLE "SteamAccount" (
    "steamId64" TEXT NOT NULL,
    "isOwner" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SteamAccount_pkey" PRIMARY KEY ("steamId64")
);

-- CreateIndex
CREATE UNIQUE INDEX "LolAccount_gameName_tagLine_region_key" ON "LolAccount"("gameName", "tagLine", "region");

-- Seed the roster the JSON config carried until this migration. `createdAt`
-- is staggered in config order because reads sort on it, so the nav keeps
-- rendering the accounts in the order it always has.
INSERT INTO "LolAccount" ("slug", "gameName", "tagLine", "region", "isOwner", "isPrimary", "createdAt", "updatedAt") VALUES
    ('ahri', 'Vyoh', 'Ahri', 'euw1', true, true, '2026-08-13 23:01:17.000', '2026-08-13 23:01:17.000'),
    ('vyoh', 'Ahri', 'Vyoh', 'euw1', true, false, '2026-08-13 23:01:18.000', '2026-08-13 23:01:18.000'),
    ('9tails', 'Νine Tailed Fox', 'EUW', 'euw1', true, false, '2026-08-13 23:01:19.000', '2026-08-13 23:01:19.000'),
    ('miyeon', 'Cho Miyeon Fan', 'EUW', 'euw1', true, false, '2026-08-13 23:01:20.000', '2026-08-13 23:01:20.000'),
    ('tifa', 'TIFΑ', '7777', 'euw1', false, false, '2026-08-13 23:01:21.000', '2026-08-13 23:01:21.000'),
    ('tifa2', 'twtv tifa lol', 'meow', 'euw1', false, false, '2026-08-13 23:01:22.000', '2026-08-13 23:01:22.000'),
    ('tifa3', 'twtv TIFA LOL', '7777', 'euw1', false, false, '2026-08-13 23:01:23.000', '2026-08-13 23:01:23.000'),
    ('twix', 'Twix1232', 'EUW', 'euw1', false, false, '2026-08-13 23:01:24.000', '2026-08-13 23:01:24.000'),
    ('agurin', 'Agurin', 'DND', 'euw1', false, false, '2026-08-13 23:01:25.000', '2026-08-13 23:01:25.000');
