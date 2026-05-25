// Storefront screenshots — captured from IStoreBrowseService's
// `screenshots.{all_ages_screenshots, mature_content_screenshots}`. Each
// entry is a (filename, ordinal) pair; `ordinal` preserves the
// publisher-chosen order across the two buckets, and `filename` is the
// upstream-canonical path relative to the `/store_item_assets/` root
// (typical shape: `steam/apps/{appid}/ss_<hash>.jpg?t=<ts>` — the appid
// segment is baked in, NOT something the caller should prepend, and the
// `?t=` cache-buster is part of what publishers refresh on art swaps).
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
// derivatives. The `?t=` cache-buster lives inside the stored filename
// (publisher refreshes bump it), so we don't add or strip it here.
const SCREENSHOT_BASE = "https://shared.cloudflare.steamstatic.com/store_item_assets";

// `ss_<hash>.600x338.jpg` is Steam's standard preview thumbnail (16:9).
// `ss_<hash>.1920x1080.jpg` is the full-size variant the storefront lightbox
// opens to. Filenames are the base form (no size suffix) — inject `.{size}`
// between basename and extension, preserving any trailing `?t=` query.
function withSizeSuffix(filename: string, size: string): string {
  // Already has a size like `.600x338.` or `.116x65.` baked in? Pass through.
  if (/\.\d+x\d+\./.test(filename)) return filename;
  // Split off query string so the size lands before the extension, not
  // before the `?`.
  const qIdx = filename.indexOf("?");
  const path = qIdx === -1 ? filename : filename.slice(0, qIdx);
  const query = qIdx === -1 ? "" : filename.slice(qIdx);
  // Inject `.{size}` between the basename and the extension. If the filename
  // has no extension (unexpected), return as-is rather than risking a broken
  // URL — the renderer will just 404 and silently fall back.
  const dot = path.lastIndexOf(".");
  if (dot === -1) return filename;
  return `${path.slice(0, dot)}.${size}${path.slice(dot)}${query}`;
}

// `_appid` is preserved in the signature because callers already pass it
// (and it's useful for future per-app proxy rewrites), but it's NOT used to
// compose the URL — the appid segment is already inside `filename`.
export function steamScreenshotThumbUrl(_appid: number, filename: string): string {
  return `${SCREENSHOT_BASE}/${withSizeSuffix(filename, "600x338")}`;
}

export function steamScreenshotFullUrl(_appid: number, filename: string): string {
  return `${SCREENSHOT_BASE}/${withSizeSuffix(filename, "1920x1080")}`;
}
