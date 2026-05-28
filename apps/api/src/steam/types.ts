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
// far more, but we only need name + appid + visibility + release. `success` is 1
// when the item resolved, 0 when it did not (region-locked, delisted, hidden).
// `visible` echoes the same intent for the owner's region. `release` is populated
// only when the caller sets `data_request.include_release: true`.
export interface SteamStoreItemRaw {
  appid: number;
  success: 0 | 1;
  visible?: boolean;
  name?: string;
  store_url_path?: string;
  release?: SteamStoreItemReleaseRaw;
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

// Each publisher/developer/franchise object on basic_info carries a `name`
// and, for entities Steam can resolve to a community page, a
// `creator_clan_account_id` (Steam Group account id — the same id space the
// frontend can deep-link to /groups/{id}).
export interface SteamStoreItemBasicInfoEntityRaw {
  name?: string;
  creator_clan_account_id?: number;
}

export interface SteamStoreItemBasicInfoRaw {
  short_description?: string;
  publishers?: SteamStoreItemBasicInfoEntityRaw[];
  developers?: SteamStoreItemBasicInfoEntityRaw[];
  franchises?: SteamStoreItemBasicInfoEntityRaw[];
}

// `steam_deck_compat_category`: 0 Unknown / 1 Unsupported / 2 Playable /
// 3 Verified — matches Steam's public Deck-compat enum.
// `vr_support` is an object whose keys enumerate supported VR modes
// (`vr_supported`, `vr_only`, etc.). Empty object `{}` means non-VR.
export interface SteamStoreItemPlatformsRaw {
  windows?: boolean;
  mac?: boolean;
  linux?: boolean;
  steam_deck_compat_category?: number;
  vr_support?: Record<string, unknown>;
}

// `review_score` is Steam's 1-9 internal scale; `review_score_label` is the
// human label ("Very Positive", "Mostly Positive", …) that the storefront
// surfaces. `summary_filtered` excludes off-topic review bombs and is what
// the storefront chip reads; `summary_language_specific` is the same shape
// restricted to the requested `language`.
export interface SteamStoreItemReviewSummaryRaw {
  review_count?: number;
  percent_positive?: number;
  review_score?: number;
  review_score_label?: string;
}

export interface SteamStoreItemReviewsRaw {
  summary_filtered?: SteamStoreItemReviewSummaryRaw;
  summary_language_specific?: SteamStoreItemReviewSummaryRaw;
}

// `game_rating` is `null` (or omitted) for titles whose publisher skipped
// ESRB submission — typically AO-rated games (e.g. Subverse). Must NOT be
// used as a maturity signal; it's editorial-only.
// `type` is the rating authority ("esrb", "pegi", …); `rating` is its label
// ("M", "18", …); `descriptors` is the free-text descriptor list; `image_url`
// is a CDN path under `https://store.cloudflare.steamstatic.com/`.
export interface SteamStoreItemGameRatingRaw {
  type?: string;
  rating?: string;
  descriptors?: string[];
  required_age?: number;
  use_age_gate?: boolean;
  image_url?: string;
}

// Each `microtrailer` entry is a 6-second silent loop the storefront plays
// on hover. `filename` is a CDN-resolvable path
// `{appid}/{movieid}/.../microtrailer.{webm|mp4}` under
// `https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/`.
// Trailers also carry full-length variants Steam plays on click; those
// fields are present in the response but typed lazily — add when a chunk
// actually consumes them.
export interface SteamStoreItemTrailerSourceRaw {
  filename?: string;
  type?: string;
}

export interface SteamStoreItemTrailerHighlightRaw {
  microtrailer?: SteamStoreItemTrailerSourceRaw[];
  // Poster frame Steam shows before the microtrailer plays. CDN-resolvable
  // path under the same `steam/apps/{appid}/` prefix as `microtrailer`. The
  // hover-preview renderer uses it as the still under the `<video>` so the
  // pre-play frame matches the trailer's first frame; without it the tile
  // would fall back to the library capsule art for the static poster.
  screenshot_medium?: string;
  // Editorial label ("Full Launch trailer", "Gameplay trailer", etc.) — used
  // as the `<video>`'s `aria-label` for screen readers and as the hovercard
  // tooltip on touch surfaces. Distinct from microtrailer URLs because Steam
  // associates the name with the trailer entry as a whole, not per-source.
  trailer_name?: string;
}

export interface SteamStoreItemTrailersRaw {
  highlights?: SteamStoreItemTrailerHighlightRaw[];
}

// Two server-side buckets. `all_ages_screenshots` is the storefront default;
// `mature_content_screenshots` is gated behind Steam's own maturity toggle.
// `filename` resolves under
// `https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/{appid}/`.
// `ordinal` pairs filenames to preserve publisher-chosen order.
export interface SteamStoreItemScreenshotRaw {
  filename?: string;
  ordinal?: number;
}

export interface SteamStoreItemScreenshotsRaw {
  all_ages_screenshots?: SteamStoreItemScreenshotRaw[];
  mature_content_screenshots?: SteamStoreItemScreenshotRaw[];
}

// `elanguage` is Steam's internal language id. `supported` is non-zero when
// the language is supported at all; `full_audio` and `subtitles` flag the
// per-language audio/subtitle availability. Backlogged consumer (Chunk 10);
// shape is typed conservatively against the documented field set.
export interface SteamStoreItemSupportedLanguageRaw {
  elanguage?: number;
  eadditionallanguage?: number;
  supported?: number;
  full_audio?: number;
  subtitles?: number;
}

// `included_apps` is the list of appids bundled into the parent (collection,
// franchise pack). Backlogged consumer (Chunk 12); only `appid` is typed for
// now — extend when a chunk lands that reads richer fields.
export interface SteamStoreItemIncludedAppRaw {
  appid?: number;
}

export interface SteamStoreItemIncludedItemsRaw {
  included_apps?: SteamStoreItemIncludedAppRaw[];
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
  // Umbrella additions (Chunk 0 in library-card-enrichment.md). Each block
  // is gated by its `include_*` flag in getStoreItemsFull's data_request and
  // is upstream-optional per item. projectEnrichment doesn't read these yet
  // — per-field projection lands per-chunk.
  basic_info?: SteamStoreItemBasicInfoRaw;
  platforms?: SteamStoreItemPlatformsRaw;
  reviews?: SteamStoreItemReviewsRaw;
  // Null (not just absent) is a real upstream value — see comment on the
  // interface. Don't infer maturity from absence.
  game_rating?: SteamStoreItemGameRatingRaw | null;
  trailers?: SteamStoreItemTrailersRaw;
  screenshots?: SteamStoreItemScreenshotsRaw;
  // BBCode markup, ~2-8KB typical. Sanitised at render time via the LoL
  // wiki-HTML pipeline (see rich-descriptions arc).
  full_description_bbcode?: string;
  supported_languages?: SteamStoreItemSupportedLanguageRaw[];
  included_items?: SteamStoreItemIncludedItemsRaw;
}

export interface SteamGetStoreItemsFullResponse {
  response: {
    store_items?: SteamStoreItemFullRaw[];
  };
}

// Legacy storefront endpoint at `store.steampowered.com/api/appdetails`. Used
// only for `about_the_game` HTML — the modern `IStoreBrowseService` returns
// `full_description_bbcode` but not the rendered HTML, and that HTML is the
// only path to Steam's content-hashed `extras/<hash>.{webm,poster.avif}`
// asset URLs (bbcode carries publisher slugs, the CDN doesn't expose them).
// Keyed by appid stringified; `success: false` for delisted/private games.
export interface SteamAppDetailsEntry {
  success: boolean;
  data?: {
    about_the_game?: string;
  };
}
export type SteamAppDetailsResponse = Record<string, SteamAppDetailsEntry>;

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
  // Unix epoch (seconds) of the most recent launch as reported by the Steam
  // client. 0 / absent on titles the owner has never started — `> 0` is the
  // meaningful signal, not just `!= undefined`.
  rtime_last_played?: number;
}

export interface SteamGetOwnedGamesResponse {
  response: {
    game_count?: number;
    games?: SteamOwnedGameRaw[];
  };
}

// IPlayerService/GetRecentlyPlayedGames/v1/. Same per-game shape as
// GetOwnedGames but only the rolling 2-week set (≤10 entries by default).
// The Steam API trims to games with non-zero `playtime_2weeks`, so each
// row here is a hot candidate for an event-driven unlock refresh.
export interface SteamGetRecentlyPlayedGamesResponse {
  response: {
    total_count?: number;
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
// IPlayerService/GetGameAchievements/v1/. Supersedes ISteamUserStats/
// GetSchemaForGame for our use case: the older schema endpoint blanks
// `description` on hidden achievements anti-spoiler (caller can't be
// identified). This newer endpoint returns the real `localized_desc`
// for hidden rows. Anonymous-callable; the param is `language=english`
// (not `l=english` — `l` returns an empty `{"response":{}}` here). As
// a bonus, `player_percent_unlocked` carries the same global rarity the
// v0002 rarity endpoint exposes, but we still rely on the separate
// rarity poller until that consolidation lands. Empty `achievements`
// array (or missing key) for games without an achievement schema.
//
// Icon fields are filenames only (e.g. `"abc.jpg"`), not absolute URLs
// like the old endpoint returned. The client method composes the full
// community-CDN URL at the boundary so downstream sees the same
// `iconUrl`/`iconGrayUrl` strings the previous endpoint produced.
export interface SteamPlayerServiceAchievementRaw {
  internal_name: string;
  localized_name: string;
  localized_desc: string;
  icon: string;
  icon_gray: string;
  hidden: boolean;
  player_percent_unlocked: string; // float-as-string, e.g. "17.9"
  internal_key: number;
  min_progress: number;
  max_progress: number;
  groupid: number;
  archived: boolean;
}

export interface SteamGetGameAchievementsResponse {
  response: {
    achievements?: SteamPlayerServiceAchievementRaw[];
  };
}

// Normalized internal shape the schema service consumes. Decouples the
// schema service from the raw endpoint response so we can swap endpoints
// (or consolidate) without rippling field-name churn.
export interface SteamGameAchievementSchema {
  apiName: string;
  displayName: string;
  description: string;
  iconUrl: string;
  iconGrayUrl: string;
  hidden: boolean;
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
