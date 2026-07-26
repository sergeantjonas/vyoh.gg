import { describe, expect, it } from "vitest";
import { API_PUBLIC_URL, API_URL } from "./api-url";

describe("api base", () => {
  it("falls back to the dev api origin when VITE_API_URL is unset", () => {
    // Over a hundred fetch assertions across the suite compare against this
    // literal. This is the one place that states it, so a changed fallback
    // fails here first rather than as a hundred unrelated-looking failures.
    expect(API_PUBLIC_URL).toBe("http://localhost:2010");
  });

  it("keeps the fetch origin equal to the public one outside SSR", () => {
    // The two diverge only when rendering on a server. In a browser build —
    // and in this suite — they must be the same string, or a fetched URL and
    // a rendered <img src> would point at different origins.
    expect(import.meta.env.SSR).toBe(false);
    expect(API_URL).toBe(API_PUBLIC_URL);
  });

  it("exposes bare origins with no trailing slash", () => {
    // Every caller composes `${API_URL}/some/path`. A trailing slash would
    // yield `//some/path`, which is a protocol-relative URL, not a path.
    expect(API_PUBLIC_URL.endsWith("/")).toBe(false);
    expect(API_URL.endsWith("/")).toBe(false);
  });
});
