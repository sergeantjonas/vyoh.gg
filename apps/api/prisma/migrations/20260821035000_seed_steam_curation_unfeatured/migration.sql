-- Move the two hand-maintained curation entries onto the `unfeatured` axis.
--
-- These appids were duplicated in `recap-curation.ts` and `landing-config.ts` as
-- "RECAP_HIDDEN_APPIDS" / "HIDDEN_APPIDS", but neither was ever about privacy:
-- both games stay fully visible in the library, wishlist and achievement feeds
-- and are only barred from being chosen as a chapter subject on `/`. Seeding
-- `unfeaturedAt` (not `hiddenAt`) is what preserves today's behaviour exactly.
--
-- `reviewedAt` is stamped because an owner ruling is precisely what these rows
-- encode; leaving it null would drop them into the needs-review queue that
-- exists for newly-detected purchases.
INSERT INTO "SteamGameCuration"
  ("appid", "name", "unfeaturedAt", "reviewedAt", "note", "createdAt", "updatedAt")
VALUES
  (
    1034140,
    'Subverse',
    NOW(),
    NOW(),
    'Editorial: not chapter material on /.',
    NOW(),
    NOW()
  ),
  (
    1091500,
    'Cyberpunk 2077',
    NOW(),
    NOW(),
    'Editorial: high lifetime hours but stale; do not feature on /.',
    NOW(),
    NOW()
  )
ON CONFLICT ("appid") DO NOTHING;
