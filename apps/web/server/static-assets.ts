import { extname, join, sep } from "node:path";

/**
 * Static-file policy for `dist/client`, split out from the adapter because
 * these are the two decisions in it that can be silently wrong: a path that
 * escapes the client directory, and a cache header that pins a mutable file
 * for a year.
 */

const YEAR_SECONDS = 31_536_000;

/** For Vite's content-hashed output: the name changes when the bytes do. */
export const IMMUTABLE_CACHE_CONTROL = `public, max-age=${YEAR_SECONDS}, immutable`;

/** For everything else in `dist/client` — the filename is stable across deploys. */
export const MUTABLE_CACHE_CONTROL = "public, max-age=3600";

/**
 * Only `/assets/**` is content-hashed. `robots.txt`, `manifest.json` and the
 * favicons keep their names forever, so an immutable header there would strand
 * a stale copy in every browser that ever loaded the site.
 */
export function cacheControlFor(pathname: string): string {
  return pathname.startsWith("/assets/")
    ? IMMUTABLE_CACHE_CONTROL
    : MUTABLE_CACHE_CONTROL;
}

/**
 * Resolve a request path to a file inside `clientDir`, or null if it is not a
 * static request at all. Null means "hand it to the SSR handler" — including
 * for a path that looks hostile, since the app's 404 route is a better answer
 * than a 403 that confirms the directory layout.
 *
 * `clientDir` must be absolute and normalised.
 */
export function resolveClientAsset(clientDir: string, pathname: string): string | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    // Malformed percent-encoding. `%2e%2e%2f` decodes fine and is caught below;
    // this branch is a lone `%` or a truncated escape.
    return null;
  }
  if (decoded.includes("\0")) return null;

  const segments = decoded.split("/").filter(Boolean);
  // "/" is the document, not an asset.
  if (segments.length === 0) return null;
  // Any dot-prefixed segment. This is the `..` traversal guard, and it also
  // keeps `.vite/manifest.json` unreachable — Vite writes it next to the
  // assets (`build.manifest` is on for `.size-limit.cjs`) and it describes the
  // whole chunk graph.
  if (segments.some((segment) => segment.startsWith("."))) return null;

  const file = join(clientDir, ...segments);
  // `join` normalises, so the guard above already rules this out. Kept because
  // the cost of being wrong here is arbitrary file read.
  if (!file.startsWith(clientDir + sep)) return null;
  return file;
}

/**
 * Closed map over what the Vite build actually emits, plus the handful of
 * files in `public/`. Unknown extensions fall back to a type browsers will not
 * execute or render.
 */
const CONTENT_TYPES: Record<string, string> = {
  ".avif": "image/avif",
  ".css": "text/css; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".mp4": "video/mp4",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webm": "video/webm",
  ".webmanifest": "application/manifest+json",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".xml": "application/xml; charset=utf-8",
};

export function contentTypeFor(filePath: string): string {
  return CONTENT_TYPES[extname(filePath).toLowerCase()] ?? "application/octet-stream";
}
