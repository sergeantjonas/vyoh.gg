-- Adds rendered `about_the_game` HTML from Steam's legacy storefront
-- appdetails endpoint. The existing `fullDescriptionBbcode` column stays in
-- place — it comes from `IStoreBrowseService/GetStoreItemsFull` (batched)
-- and is the bulk-enrichment source of truth. `aboutTheGameHtml` is fetched
-- lazily on first description view and is the only path to the content-
-- hashed `extras/<hash>.poster.avif` + `extras/<hash>.webm` URLs Steam's
-- storefront renders inline — the bbcode contains editorial slugs that
-- the CDN doesn't expose directly.
ALTER TABLE "SteamGameEnrichment" ADD COLUMN "aboutTheGameHtml" TEXT;
