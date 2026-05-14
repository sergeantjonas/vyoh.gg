// Public-profile wishlist surface. Returned by GET /api/steam/wishlist.
//
// Backed by two Steam Web API calls: IWishlistService/GetWishlist (appid + date_added
// + priority) and IStoreBrowseService/GetItems (appid -> name). Names can be null when
// GetItems returns success=0 for an item (region-restricted, delisted, or hidden); the
// frontend renders these honestly rather than dropping the row.

export interface SteamWishlistItem {
  appid: number;
  name: string | null;
  // Unix seconds (UTC). Frontend formats in Europe/Brussels (owner timezone).
  dateAdded: number;
  // 0 means unprioritized; 1..N is explicit ordering set by the owner on Steam.
  priority: number;
  storeUrl: string;
}

export interface SteamWishlist {
  steamId: string;
  items: SteamWishlistItem[];
  fetchedAt: number;
}
