import { afterEach, describe, expect, it } from "vitest";

import { preloadLinkAsImage } from "./preload-link";

function findPreloadLinks(): HTMLLinkElement[] {
  return Array.from(
    document.head.querySelectorAll('link[rel="preload"]')
  ) as HTMLLinkElement[];
}

afterEach(() => {
  for (const link of findPreloadLinks()) {
    link.remove();
  }
});

describe("preloadLinkAsImage", () => {
  it("appends a link[rel=preload][as=image] for the given href", () => {
    preloadLinkAsImage("https://test/hero.jpg");
    const links = findPreloadLinks();
    expect(links).toHaveLength(1);
    const link = links[0];
    if (!link) throw new Error("link missing");
    expect(link.rel).toBe("preload");
    expect(link.as).toBe("image");
    expect(link.href).toBe("https://test/hero.jpg");
  });

  it("is a no-op when called with the same href twice", () => {
    preloadLinkAsImage("https://test/hero.jpg");
    preloadLinkAsImage("https://test/hero.jpg");
    expect(findPreloadLinks()).toHaveLength(1);
  });

  it("is a no-op for null/undefined href", () => {
    preloadLinkAsImage(null);
    preloadLinkAsImage(undefined);
    expect(findPreloadLinks()).toHaveLength(0);
  });

  it("cleanup removes the inserted link", () => {
    const cleanup = preloadLinkAsImage("https://test/hero.jpg");
    expect(findPreloadLinks()).toHaveLength(1);
    cleanup();
    expect(findPreloadLinks()).toHaveLength(0);
  });

  it("cleanup is a no-op when the href was already present (didn't insert anything)", () => {
    preloadLinkAsImage("https://test/hero.jpg");
    const cleanup = preloadLinkAsImage("https://test/hero.jpg");
    expect(findPreloadLinks()).toHaveLength(1);
    cleanup();
    // Pre-existing link remains; cleanup only owns the link THIS call inserted.
    expect(findPreloadLinks()).toHaveLength(1);
  });

  it("escapes special characters in hrefs when checking for duplicates", () => {
    // Steam asset URLs include query string with cache-busting timestamps —
    // CSS.escape must handle them so the selector doesn't bail.
    const href = "https://cdn.test/library_hero.jpg?t=1717248000&v=2";
    preloadLinkAsImage(href);
    preloadLinkAsImage(href);
    expect(findPreloadLinks()).toHaveLength(1);
  });

  it("inserts separate links for distinct hrefs", () => {
    preloadLinkAsImage("https://test/a.jpg");
    preloadLinkAsImage("https://test/b.jpg");
    expect(findPreloadLinks()).toHaveLength(2);
  });
});
