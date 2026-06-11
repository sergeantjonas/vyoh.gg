import { describe, expect, it } from "vitest";
import { parseWishlistQuery } from "./wishlist-query.ts";

describe("parseWishlistQuery", () => {
  it("returns null when the input does not start with `wishlist`", () => {
    expect(parseWishlistQuery("")).toBeNull();
    expect(parseWishlistQuery("steam")).toBeNull();
    expect(parseWishlistQuery("dev:from-software")).toBeNull();
    // The head token must be `wishlist`; a trailing occurrence does not count.
    expect(parseWishlistQuery("add to wishlist")).toBeNull();
  });

  it("resolves bare `wishlist` to navigation with no tab and no query", () => {
    expect(parseWishlistQuery("wishlist")).toEqual({
      kind: "wishlist",
      tab: null,
      query: "",
    });
  });

  it("resolves `wishlist upcoming` / `wishlist all` to a tab navigation", () => {
    expect(parseWishlistQuery("wishlist upcoming")).toEqual({
      kind: "wishlist",
      tab: "upcoming",
      query: "",
    });
    expect(parseWishlistQuery("wishlist all")).toEqual({
      kind: "wishlist",
      tab: "all",
      query: "",
    });
  });

  it("is case- and whitespace-insensitive", () => {
    expect(parseWishlistQuery("  WishList   Upcoming ")).toEqual({
      kind: "wishlist",
      tab: "upcoming",
      query: "",
    });
  });

  it("treats free text after the head as a name query", () => {
    expect(parseWishlistQuery("wishlist elden ring")).toEqual({
      kind: "wishlist",
      tab: null,
      query: "elden ring",
    });
  });

  it("treats a tab keyword followed by more tokens as a name query (no combined target)", () => {
    expect(parseWishlistQuery("wishlist upcoming hollow")).toEqual({
      kind: "wishlist",
      tab: null,
      query: "upcoming hollow",
    });
  });
});
