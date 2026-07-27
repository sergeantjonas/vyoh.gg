// @vitest-environment node

import { describe, expect, it } from "vitest";
import {
  IMMUTABLE_CACHE_CONTROL,
  MUTABLE_CACHE_CONTROL,
  cacheControlFor,
  contentTypeFor,
  resolveClientAsset,
} from "./static-assets.ts";

const ROOT = "/srv/vyoh/client";

describe("resolveClientAsset", () => {
  it("resolves a normal asset path under the client directory", () => {
    expect(resolveClientAsset(ROOT, "/assets/app-abc123.js")).toBe(
      "/srv/vyoh/client/assets/app-abc123.js"
    );
  });

  it("returns null for the document path", () => {
    expect(resolveClientAsset(ROOT, "/")).toBeNull();
    expect(resolveClientAsset(ROOT, "")).toBeNull();
  });

  it.each([
    ["literal traversal", "/../package.json"],
    ["encoded traversal", "/%2e%2e/package.json"],
    ["traversal below a real directory", "/assets/../../.env"],
    ["a dotfile", "/.env"],
    ["Vite's build manifest", "/.vite/manifest.json"],
    ["a null byte", "/assets/app.js\0.png"],
    ["malformed percent-encoding", "/assets/%"],
  ])("returns null for %s", (_label, pathname) => {
    expect(resolveClientAsset(ROOT, pathname)).toBeNull();
  });
});

describe("cacheControlFor", () => {
  it("pins content-hashed assets for a year", () => {
    expect(cacheControlFor("/assets/app-abc123.js")).toBe(IMMUTABLE_CACHE_CONTROL);
  });

  it.each(["/robots.txt", "/manifest.json", "/vyoh-orb-favicon.svg"])(
    "keeps %s revalidating, since the name survives a deploy",
    (pathname) => {
      expect(cacheControlFor(pathname)).toBe(MUTABLE_CACHE_CONTROL);
    }
  );
});

describe("contentTypeFor", () => {
  it.each([
    ["/a/app.js", "text/javascript; charset=utf-8"],
    ["/a/style.css", "text/css; charset=utf-8"],
    ["/a/orb.svg", "image/svg+xml"],
    ["/a/font.woff2", "font/woff2"],
    ["/a/robots.txt", "text/plain; charset=utf-8"],
  ])("types %s", (file, expected) => {
    expect(contentTypeFor(file)).toBe(expected);
  });

  it("falls back to a type the browser will not execute", () => {
    expect(contentTypeFor("/a/thing.unknown")).toBe("application/octet-stream");
  });
});
