-- Records when the lazily fetched `aboutTheGameHtml` was last answered by
-- Steam, so the description endpoint can refresh it on view. Existing rows
-- stay null and read as stale, which re-fetches each one once on its next
-- view — including rows holding the `""` sentinel from a launch-day blank.
ALTER TABLE "SteamGameEnrichment" ADD COLUMN "aboutTheGameHtmlFetchedAt" TIMESTAMP(3);
