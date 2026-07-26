import { collectSitemapUrls, renderSitemap } from "@/lib/sitemap";
import { createFileRoute } from "@tanstack/react-router";

// `/sitemap.xml`, generated per request from live data. Replaces a
// hand-maintained four-URL file in `public/` that had been stale since
// 2026-05-25 and never listed a single patch-notes page — which is to say it
// omitted exactly the content the SSR migration exists to get indexed.
//
// A server route rather than a build-time artefact because the interesting URLs
// are data, not routes: patch versions arrive on Riot's cadence, and a build
// step would have to reach the api anyway, then go stale until the next deploy.
//
// The filename escapes the dot as `[.]` — a bare `.` is a route-segment
// separator in file-based routing, so `sitemap.xml.ts` would declare
// `/sitemap/xml`. The generator rewrites the path literal below to the
// unescaped form, which is why it reads `/sitemap.xml` while the file does not.
export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const body = renderSitemap(await collectSitemapUrls());
        return new Response(body, {
          headers: {
            "content-type": "application/xml; charset=utf-8",
            // An hour is well inside the patch cadence (roughly fortnightly)
            // and keeps a crawler that re-requests aggressively off the api.
            "cache-control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
