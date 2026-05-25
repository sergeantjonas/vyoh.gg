// Storefront screenshots — captured from IStoreBrowseService's
// `screenshots.{all_ages_screenshots, mature_content_screenshots}`. Each
// entry is a (filename, ordinal) pair; `filename` is the path under
// `https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/{appid}/`
// and `ordinal` preserves the publisher-chosen order across the two buckets.
//
// Why the JSON column on the API side and a plain interface here: the shape
// is two scalars per row, no joins, no nested objects — flattening into a
// per-screenshot SQL table would burn a model definition without unlocking
// any query we plan to run. The shape is stable enough that a JSON column +
// boundary cast (`as unknown as SteamScreenshotEntry[]`) is the right
// trade-off, mirroring the `reviewSummary` / `gameRating` columns.

export interface SteamScreenshotEntry {
  filename: string;
  ordinal: number;
}

// Steam serves storefront screenshots under one CDN host with two size
// derivatives. Steam itself appends a `?t=` cache-buster on the storefront,
// but the screenshot filenames are content-hashed and already cache-stable
// for our purposes — omit the param to keep URLs short.
const SCREENSHOT_BASE =
  "https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps";

// `ss_<hash>.600x338.jpg` is Steam's standard preview thumbnail (16:9).
// `ss_<hash>.1920x1080.jpg` is the full-size variant the storefront lightbox
// opens to. Filenames in the JSON column are the *base* form (e.g.
// `ss_abc.jpg`); the size suffix is inserted before the extension.
function withSizeSuffix(filename: string, size: string): string {
  // `ss_abc.jpg` → `ss_abc.600x338.jpg`. If the filename already carries a
  // size (publisher quirks), pass it through unchanged.
  if (/\.\d+x\d+\./.test(filename)) return filename;
  const dot = filename.lastIndexOf(".");
  if (dot === -1) return filename;
  return `${filename.slice(0, dot)}.${size}${filename.slice(dot)}`;
}

export function steamScreenshotThumbUrl(appid: number, filename: string): string {
  return `${SCREENSHOT_BASE}/${appid}/${withSizeSuffix(filename, "600x338")}`;
}

export function steamScreenshotFullUrl(appid: number, filename: string): string {
  return `${SCREENSHOT_BASE}/${appid}/${withSizeSuffix(filename, "1920x1080")}`;
}
