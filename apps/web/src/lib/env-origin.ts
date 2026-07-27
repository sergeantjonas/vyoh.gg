/**
 * Read an origin out of a build-time env var, falling back when it carries no
 * value.
 *
 * The reason this is not `value ?? fallback`: a Docker `ARG` that the build was
 * not given arrives as an **empty string**, not as unset. `ENV VITE_SITE_URL=`
 * and `VITE_SITE_URL: ${VITE_SITE_URL:-}` in compose both produce it, and `??`
 * passes an empty string straight through. Found 2026-07-27 by reading what the
 * production stack actually served: every page came back with
 * `<link rel="canonical" href="/lol/patches">` — a relative canonical, which is
 * legal HTML and useless to a crawler.
 *
 * Trailing slashes come off here too, so `https://api.vyoh.gg/` cannot compose
 * into `https://api.vyoh.gg//lol/summoners`.
 */
export function envOrigin(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim();
  return (trimmed ? trimmed : fallback).replace(/\/+$/, "");
}
