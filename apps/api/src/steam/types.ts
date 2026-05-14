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
