import { API_URL } from "@/lib/api-url";
import { SITE_URL } from "@/lib/site-url";

// URL collection and XML rendering for `/sitemap.xml`. Split out of the route
// file so both halves are directly testable — importing a route module pulls in
// `createFileRoute`, which wants a registered route tree.

interface PatchListEntry {
  version: string;
  patchDate: string;
}

export interface SitemapUrl {
  path: string;
  lastmod?: string;
}

/**
 * Paths that exist regardless of data. Every one renders real text server-side.
 *
 * Deliberately absent:
 *
 *   - `/lol` — redirects to the primary account, and a sitemap should list
 *     destinations rather than hops.
 *   - the detail routes (`matches/$matchId`, `champions/$championKey`,
 *     `library/$appid`) — they render inside a Radix Dialog portal, which
 *     `react-dom/server` cannot render at all, so each one currently serves ~66
 *     characters. Submitting thousands of URLs whose HTML is empty is worse
 *     than not submitting them; they belong here once the panels gain a
 *     non-portaled server variant.
 *   - `/lol/$slug/live` — empty unless a game is in progress.
 */
export const SITEMAP_STATIC_PATHS = [
  "/",
  "/lol/patches",
  "/steam",
  "/steam/achievements",
  "/steam/achievements/signature",
  "/steam/wishlist",
  "/steam/library",
  "/status",
] as const;

/** Per-account section routes, appended to `/lol/$slug`. */
export const SITEMAP_ACCOUNT_SECTIONS = [
  "",
  "/matches",
  "/champions",
  "/trends",
  "/recap",
] as const;

async function fetchJson<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${API_URL}${path}`);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/**
 * The full URL list, static paths plus whatever the api can currently answer.
 *
 * A partial sitemap beats a 500: if the api is unreachable the static paths are
 * still correct and still worth serving, and the dynamic sections just go
 * missing until the next crawl.
 */
export async function collectSitemapUrls(): Promise<SitemapUrl[]> {
  const [me, patches] = await Promise.all([
    fetchJson<{ lol: Array<{ slug: string }> }>("/me"),
    fetchJson<PatchListEntry[]>("/lol/patches"),
  ]);

  const urls: SitemapUrl[] = SITEMAP_STATIC_PATHS.map((path) => ({ path }));

  for (const account of me?.lol ?? []) {
    for (const section of SITEMAP_ACCOUNT_SECTIONS) {
      urls.push({ path: `/lol/${account.slug}${section}` });
    }
  }

  for (const patch of patches ?? []) {
    urls.push({
      path: `/lol/patches/${patch.version}`,
      lastmod: patch.patchDate.slice(0, 10),
    });
  }

  return urls;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function renderSitemap(urls: SitemapUrl[]): string {
  const entries = urls
    .map(({ path, lastmod }) => {
      const loc = `<loc>${escapeXml(`${SITE_URL}${path}`)}</loc>`;
      const mod = lastmod ? `<lastmod>${escapeXml(lastmod)}</lastmod>` : "";
      return `  <url>${loc}${mod}</url>`;
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries}
</urlset>
`;
}
