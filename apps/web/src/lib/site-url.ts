// This site's own public origin, for URLs that describe *this* document to a
// crawler: <link rel="canonical">, og:url, and the sitemap.
//
// Separate from api-url.ts on purpose. That module owns the origin the app
// *talks to* and splits by side, because a fetch should take the shortest route
// from wherever it runs. Nothing here is ever fetched, so there is no server
// form to diverge into: a canonical URL naming an internal origin would be a
// crawler instruction pointing at a host the crawler cannot resolve.
//
// Build-time constant for the same reason API_PUBLIC_URL is one. It lands in
// markup, so it has to be byte-identical on both sides of a server render.
// `https://vyoh.gg` is the default rather than a localhost dev origin because a
// canonical tag's whole job is to name the production URL of a page — in dev it
// is inert either way, and a stale localhost canonical shipping to production
// would be worse than an unhelpfully-correct one in dev.

import { envOrigin } from "./env-origin";

const PRODUCTION_ORIGIN = "https://vyoh.gg";

/** Absolute origin of the site, no trailing slash. */
export const SITE_URL: string = envOrigin(
  import.meta.env.VITE_SITE_URL,
  PRODUCTION_ORIGIN
);

/**
 * Absolute URL for a route pathname, normalised so that one page cannot
 * describe itself under two spellings.
 *
 * Trailing slashes are stripped (`/steam/` and `/steam` are the same document,
 * and the router treats them as such) and search is dropped entirely — every
 * search param in this app is view state (`?queue=`, `?as=`, `?tab=`,
 * `?appid=`), so the canonical form of a filtered view is the unfiltered one.
 */
export function canonicalUrl(pathname: string): string {
  const path = pathname.replace(/\/+$/, "");
  return `${SITE_URL}${path === "" ? "/" : path}`;
}
