-- Chunk 8 — store the raw BBCode body from `full_description_bbcode` so the
-- web side can sanitise + render the "About this game" block on the
-- /steam/game/:appid detail page without an extra upstream round-trip.
ALTER TABLE "SteamGameEnrichment"
    ADD COLUMN "fullDescriptionBbcode" TEXT;
