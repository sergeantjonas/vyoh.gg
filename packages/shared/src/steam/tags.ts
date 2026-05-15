// Steam community-tag catalog. Returned by GET /api/steam/tags. Mirrors the
// rows of the SteamTag table — pulled monthly from IStoreService/GetTagList.
// The library page joins these labels to `tagIds` already returned on each
// SteamOwnedGame, so the catalog is decoupled from any single game's record
// and the same payload feeds every faceted-filter surface that needs labels.

export interface SteamTagListEntry {
  id: number;
  name: string;
}

export interface SteamTagCatalog {
  tags: SteamTagListEntry[];
  // ISO-8601 of the most-recent SteamTag.updatedAt, or null when no sync has
  // completed yet (first-deploy state — the on-boot backfill resolves this
  // before the first user request that needs labels in practice).
  lastSyncedAt: string | null;
}
