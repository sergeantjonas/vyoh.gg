import { SITE_URL } from "@/lib/site-url";
import {
  SITEMAP_ACCOUNT_SECTIONS,
  SITEMAP_STATIC_PATHS,
  collectSitemapUrls,
  renderSitemap,
} from "@/lib/sitemap";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.restoreAllMocks();
});

function mockApi(responses: Record<string, unknown | null>) {
  vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
    const url = String(input);
    const key = Object.keys(responses).find((path) => url.endsWith(path));
    const body = key ? responses[key] : null;
    if (body === null || body === undefined) {
      return Promise.resolve(new Response("", { status: 500 }));
    }
    return Promise.resolve(
      new Response(JSON.stringify(body), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );
  });
}

describe("renderSitemap", () => {
  it("emits a urlset with one absolute loc per entry", () => {
    const xml = renderSitemap([{ path: "/" }, { path: "/status" }]);
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    expect(xml).toContain(`<loc>${SITE_URL}/</loc>`);
    expect(xml).toContain(`<loc>${SITE_URL}/status</loc>`);
  });

  it("emits lastmod only for entries that carry one", () => {
    const xml = renderSitemap([
      { path: "/lol/patches/26.14", lastmod: "2026-07-14" },
      { path: "/status" },
    ]);
    expect(xml).toContain("<lastmod>2026-07-14</lastmod>");
    expect(xml.match(/<lastmod>/g)).toHaveLength(1);
  });

  it("escapes XML-significant characters in a path", () => {
    const xml = renderSitemap([{ path: "/lol/a&b" }]);
    expect(xml).toContain("a&amp;b");
    expect(xml).not.toContain("a&b<");
  });
});

describe("collectSitemapUrls", () => {
  it("expands every account across every section route", async () => {
    mockApi({
      "/me": { lol: [{ slug: "ahri" }, { slug: "vyoh" }] },
      "/lol/patches": [],
    });

    const paths = (await collectSitemapUrls()).map((u) => u.path);

    for (const slug of ["ahri", "vyoh"]) {
      for (const section of SITEMAP_ACCOUNT_SECTIONS) {
        expect(paths).toContain(`/lol/${slug}${section}`);
      }
    }
  });

  it("dates each patch entry from its patchDate", async () => {
    mockApi({
      "/me": { lol: [] },
      "/lol/patches": [{ version: "26.14", patchDate: "2026-07-14T22:00:00.000Z" }],
    });

    const urls = await collectSitemapUrls();

    expect(urls).toContainEqual({ path: "/lol/patches/26.14", lastmod: "2026-07-14" });
  });

  // A sitemap that 500s tells a crawler nothing. A sitemap missing its dynamic
  // half still gets the static routes crawled.
  it("still returns the static paths when the api is unreachable", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("ECONNREFUSED"));

    const paths = (await collectSitemapUrls()).map((u) => u.path);

    expect(paths).toEqual([...SITEMAP_STATIC_PATHS]);
  });

  // These are indexable URLs today but serve ~66 characters, because the panels
  // render inside a Radix portal that react-dom/server cannot render.
  it("omits the portal-rendered detail routes", async () => {
    mockApi({
      "/me": { lol: [{ slug: "ahri" }] },
      "/lol/patches": [{ version: "26.14", patchDate: "2026-07-14T22:00:00.000Z" }],
    });

    const paths = (await collectSitemapUrls()).map((u) => u.path);

    expect(paths.some((p) => /\/matches\/[A-Z]/.test(p))).toBe(false);
    expect(paths.some((p) => p.startsWith("/steam/library/"))).toBe(false);
    // `/lol` redirects; a sitemap lists destinations, not hops.
    expect(paths).not.toContain("/lol");
  });
});
