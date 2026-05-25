-- Chunk 9c — sunset the appdetails-side screenshot pipeline. The lazy
-- `screenshots` JSON column + `screenshotsFetchedAt` timestamp were populated
-- on first tile-hover via store.steampowered.com/api/appdetails. Both the
-- library-tile hovercard and the game-detail strip now read from the
-- IStoreBrowseService-derived buckets (`screenshotsAllAges` / `screenshotsMature`)
-- landed in chunks 9a/9b, so the legacy pair is dead weight. Drop in the
-- same commit as the controller/service/hook deletion.
ALTER TABLE "SteamGameEnrichment"
    DROP COLUMN "screenshots",
    DROP COLUMN "screenshotsFetchedAt";
