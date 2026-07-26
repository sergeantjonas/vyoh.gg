import { SITE_URL, canonicalUrl } from "@/lib/site-url";
import { describe, expect, it } from "vitest";

describe("SITE_URL", () => {
  it("is an absolute origin with no trailing slash", () => {
    expect(SITE_URL).toMatch(/^https?:\/\/[^/]+$/);
  });
});

describe("canonicalUrl", () => {
  it("maps the root path to a single trailing slash", () => {
    expect(canonicalUrl("/")).toBe(`${SITE_URL}/`);
  });

  it("keeps a nested path as-is", () => {
    expect(canonicalUrl("/lol/patches/26.14")).toBe(`${SITE_URL}/lol/patches/26.14`);
  });

  // A page reachable at both spellings must name one of them, or the two are
  // indexed as duplicates of each other.
  it("collapses a trailing slash onto the unslashed form", () => {
    expect(canonicalUrl("/steam/wishlist/")).toBe(canonicalUrl("/steam/wishlist"));
  });

  it("never emits a doubled slash after the origin", () => {
    expect(canonicalUrl("//")).toBe(`${SITE_URL}/`);
  });
});
