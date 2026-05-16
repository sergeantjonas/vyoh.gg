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
  // Unix seconds (UTC) when Steam has committed a release date; null for titles
  // without a published date (TBA or pre-announcement). Frontend formats this
  // in Europe/Brussels. Independent of `comingSoon` — Steam can flag a title as
  // coming-soon *and* have a target date, or have a date without the flag (the
  // common case for already-released titles).
  releaseDate: number | null;
  // True when Steam still classifies the title as unreleased (the store
  // "Coming soon" badge). Stays true past `releaseDate` until Steam flips it on
  // the actual launch sweep.
  comingSoon: boolean;
}

export interface SteamWishlist {
  steamId: string;
  items: SteamWishlistItem[];
  fetchedAt: number;
}
