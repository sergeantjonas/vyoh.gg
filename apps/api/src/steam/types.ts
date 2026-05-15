// Raw shapes from the Steam Web API. Mirrors the role of riot/types.ts: server-only
// types for upstream payloads. Public shapes live in packages/shared/src/steam/.

export interface SteamPlayerRaw {
  steamid: string;
  // 1 = private, 2 = friends-only, 3 = public. Anything < 3 means the profile
  // is locked and downstream fields will be sparse.
  communityvisibilitystate: 1 | 2 | 3;
  // 0 = not configured (no display name set yet), 1 = configured.
  profilestate: 0 | 1;
  personaname: string;
  profileurl: string;
  avatarfull: string;
  // 0 offline, 1 online, 2 busy, 3 away, 4 snooze, 5 looking-to-trade, 6 looking-to-play.
  personastate: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  // Present only while in-game.
  gameid?: string;
  gameextrainfo?: string;
}

export interface SteamGetPlayerSummariesResponse {
  response: {
    players: SteamPlayerRaw[];
  };
}

// IWishlistService/GetWishlist/v1/ response shape. Replaced the legacy
// store.steampowered.com/wishlist/profiles/{id}/wishlistdata/ endpoint, which now
// 302s to the store root. Returns appids + dates only — names are resolved via
// IStoreBrowseService/GetItems in a second call.
export interface SteamWishlistItemRaw {
  appid: number;
  // 0 means unprioritized; 1..N is the user's explicit ordering on Steam.
  priority: number;
  // Unix seconds (UTC).
  date_added: number;
}

export interface SteamGetWishlistResponse {
  response: {
    items?: SteamWishlistItemRaw[];
  };
}

// IStoreBrowseService/GetItems/v1/ — minimum-shape projection. The endpoint returns
// far more, but we only need name + appid + visibility. `success` is 1 when the item
// resolved, 0 when it did not (region-locked, delisted, hidden). `visible` echoes the
// same intent for the owner's region.
export interface SteamStoreItemRaw {
  appid: number;
  success: 0 | 1;
  visible?: boolean;
  name?: string;
  store_url_path?: string;
}

export interface SteamGetStoreItemsResponse {
  response: {
    store_items?: SteamStoreItemRaw[];
  };
}

// Full GetItems shape — superset of SteamStoreItemRaw used by the enrichment
// poller. Requested with `include_assets`, `include_release`, `include_categories`.
// `type` is Steam's StoreItemType enum int (0 = Game, 6 = Application).
// `asset_url_format` is a template `"steam/apps/{appid}/${FILENAME}?t={ts}"`
// — each per-asset value is the `${FILENAME}` substitution (hash + filename
// in one path fragment, e.g. `"1eebc7…e4e3/library_capsule.jpg"`).
export interface SteamStoreItemAssetsRaw {
  asset_url_format?: string;
  main_capsule?: string;
  main_capsule_2x?: string;
  small_capsule?: string;
  small_capsule_2x?: string;
  header?: string;
  header_2x?: string;
  hero_capsule?: string;
  hero_capsule_2x?: string;
  library_capsule?: string;
  library_capsule_2x?: string;
  library_hero?: string;
  library_hero_2x?: string;
  community_icon?: string;
  page_background_path?: string;
}

export interface SteamStoreItemCategoriesRaw {
  supported_player_categoryids?: number[];
  feature_categoryids?: number[];
  controller_categoryids?: number[];
}

export interface SteamStoreItemReleaseRaw {
  // Unix seconds (UTC). Absent for unreleased / coming-soon titles.
  steam_release_date?: number;
  is_coming_soon?: boolean;
  original_release_date?: number;
}

// Tag with weight from the community-tag voting system. `tagids` (a separate
// field on the parent) is the same list of ids in the same order, without
// weights. The full list per app can be 20+ entries; the enrichment poller
// keeps top-N to fit the queryable Int[] column.
export interface SteamStoreItemTagRaw {
  tagid: number;
  weight: number;
}

export interface SteamStoreItemFullRaw extends SteamStoreItemRaw {
  // StoreItemType enum int. 0 = Game, 6 = Application (Wallpaper Engine,
  // 3DMark, OBS-class tools). Other values for DLC / bundles / demos.
  type?: number;
  is_free?: boolean;
  tagids?: number[];
  tags?: SteamStoreItemTagRaw[];
  assets?: SteamStoreItemAssetsRaw;
  categories?: SteamStoreItemCategoriesRaw;
  release?: SteamStoreItemReleaseRaw;
}

export interface SteamGetStoreItemsFullResponse {
  response: {
    store_items?: SteamStoreItemFullRaw[];
  };
}

// IPlayerService/GetOwnedGames/v1/. With `include_appinfo=1` Steam returns the
// game name + img hashes; `include_played_free_games=1` keeps F2P titles the
// owner has launched (otherwise they're omitted entirely). `playtime_2weeks`
// is only present when nonzero — we coerce missing to `null` at the boundary
// rather than treating absent as 0, so the column stays honest about
// "Steam didn't report it" vs. "explicitly zero this fortnight".
export interface SteamOwnedGameRaw {
  appid: number;
  name: string;
  playtime_forever: number;
  playtime_2weeks?: number;
  img_icon_url?: string;
  has_community_visible_stats?: boolean;
  playtime_windows_forever?: number;
  playtime_mac_forever?: number;
  playtime_linux_forever?: number;
  playtime_deck_forever?: number;
}

export interface SteamGetOwnedGamesResponse {
  response: {
    game_count?: number;
    games?: SteamOwnedGameRaw[];
  };
}

// IPlayerService/GetProfileItemsEquipped/v1/. Returns the cosmetic items the
// owner has equipped on their community profile. All slots are optional — an
// account with the default profile returns `{ response: {} }`. `image_large`
// and the `movie_*` fields are relative paths under the Steam community CDN;
// callers prefix them to build absolute URLs.
export interface SteamProfileItemRaw {
  communityitemid?: string;
  image_large?: string;
  image_small?: string;
  movie_webm?: string;
  movie_mp4?: string;
  name?: string;
  item_title?: string;
  item_description?: string;
  appid?: number;
  item_type?: number;
  item_class?: number;
}

// IStoreService/GetTagList — full community-tag catalog. The endpoint also
// accepts `have_version_hash` for an "unchanged" short-circuit; we don't pass
// it because the monthly cadence is cheap enough that a full pull is simpler
// than threading the hash through.
export interface SteamTagListItemRaw {
  tagid: number;
  name: string;
}

export interface SteamGetTagListResponse {
  response: {
    version_hash?: string;
    tags?: SteamTagListItemRaw[];
  };
}

// ISteamUserStats/GetSchemaForGame/v2/. Games with no stats (demos,
// dedicated-launcher entries) return `{ game: {} }`. Games with stats but
// no achievements (CS2 historically) return `availableGameStats.stats` and
// omit `achievements` entirely. We only surface achievements — `stats` is
// a separate Steam concept (numeric counters) that isn't on the roadmap.
//
// `hidden = 1` is Steam's spoiler flag: the client must mask `displayName`
// and `description` until the owner unlocks the achievement. `icon` and
// `icongray` are absolute community-CDN URLs returned directly.
export interface SteamGameSchemaAchievementRaw {
  name: string; // internal apiName (e.g. "ACH_KILL_BOSS")
  defaultvalue: number;
  displayName: string;
  hidden: 0 | 1;
  description?: string;
  icon: string;
  icongray: string;
}

export interface SteamGameSchemaAvailableStatsRaw {
  achievements?: SteamGameSchemaAchievementRaw[];
}

export interface SteamGetGameSchemaResponse {
  game: {
    gameName?: string;
    gameVersion?: string;
    availableGameStats?: SteamGameSchemaAvailableStatsRaw;
  };
}

// ISteamUserStats/GetPlayerAchievements/v1/. When `success` is false the
// owner has no playerstats for the game (no schema, never launched the
// stats subsystem, or library hidden). Steam returns 200 OK in that case —
// only invalid appids produce 4xx. `unlocktime` is Unix seconds (UTC); 0
// when not yet unlocked.
export interface SteamPlayerAchievementRaw {
  apiname: string;
  achieved: 0 | 1;
  unlocktime: number;
  // Echoed when `l=english` is passed, but we don't persist either field —
  // schema table is the source of truth for `displayName`. `description` is
  // genuinely unavailable from the Steam Web API for hidden achievements:
  // `GetSchemaForGame` blanks `description` on `hidden:1` rows (anti-
  // spoiler, can't identify caller), and `GetPlayerAchievements` blanks it
  // too, even for the owner's unlocked rows (verified 2026-05-15). The
  // Steam client only knows hidden descriptions via game-shipped manifests
  // or non-Web-API protocols — neither reachable from the server.
  name?: string;
  description?: string;
}

export interface SteamGetPlayerAchievementsResponse {
  playerstats: {
    steamID?: string;
    gameName?: string;
    achievements?: SteamPlayerAchievementRaw[];
    success: boolean;
    error?: string;
  };
}

// ISteamUserStats/GetGlobalAchievementPercentagesForApp/v0002/. Public,
// no API key. Empty array for games without achievements.
//
// `percent` arrives as a JSON string (e.g. `"70.4"`) from the v0002
// endpoint despite the field semantically being a float. The client
// service coerces it to a number at the boundary so downstream sees a
// real Float (Prisma rejects strings on the `percent` column otherwise).
export interface SteamGlobalAchievementPercentageRaw {
  name: string;
  percent: number; // 0..100 float — coerced from string at the client boundary
}

export interface SteamGetGlobalAchievementPercentagesResponse {
  achievementpercentages: {
    achievements?: SteamGlobalAchievementPercentageRaw[];
  };
}

export interface SteamGetProfileItemsEquippedResponse {
  response: {
    profile_background?: SteamProfileItemRaw;
    mini_profile_background?: SteamProfileItemRaw;
    avatar_frame?: SteamProfileItemRaw;
    animated_avatar?: SteamProfileItemRaw;
    profile_modifier?: SteamProfileItemRaw;
    steam_deck_keyboard_skin?: SteamProfileItemRaw;
  };
}
