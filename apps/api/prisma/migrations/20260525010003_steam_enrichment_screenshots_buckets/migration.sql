-- Chunk 9a — store IStoreBrowseService screenshots into two server-side
-- buckets so the game-detail strip and library-tile hovercard rotation can
-- read directly from the enrichment row without a lazy appdetails fetch.
-- `all_ages_screenshots` matches Steam's storefront default; the mature
-- bucket is gated behind an owner-side toggle (see Chunk 9b).
-- The older `screenshots` + `screenshotsFetchedAt` pair stays in place until
-- Chunk 9c, which drops them in the same commit as the appdetails sunset.
ALTER TABLE "SteamGameEnrichment"
    ADD COLUMN "screenshotsAllAges" JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN "screenshotsMature" JSONB NOT NULL DEFAULT '[]'::jsonb;
