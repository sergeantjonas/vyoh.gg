-- Chunk 6 — publishers / developers / franchises flat string arrays for the
-- ⌘K palette grammar (`pub:` / `dev:` / `franchise:` verbs). Native Postgres
-- arrays rather than Json so future indexed filters can use `&&` / `@>` ops.
ALTER TABLE "SteamGameEnrichment"
    ADD COLUMN "publisherNames" TEXT[] DEFAULT ARRAY[]::TEXT[],
    ADD COLUMN "developerNames" TEXT[] DEFAULT ARRAY[]::TEXT[],
    ADD COLUMN "franchiseNames" TEXT[] DEFAULT ARRAY[]::TEXT[];
