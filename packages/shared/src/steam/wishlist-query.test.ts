import { describe, expect, it } from "vitest";
import { parseWishlistQuery } from "./wishlist-query.ts";

describe("parseWishlistQuery", () => {
  it("returns null when the input heads with neither keyword", () => {
    expect(parseWishlistQuery("")).toBeNull();
    expect(parseWishlistQuery("steam")).toBeNull();
    expect(parseWishlistQuery("dev:from-software")).toBeNull();
    // The head token must be one of the keywords; a trailing occurrence does not
    // count.
    expect(parseWishlistQuery("add to wishlist")).toBeNull();
    expect(parseWishlistQuery("what is upcoming")).toBeNull();
  });

  it("resolves bare `wishlist` to navigation with no target and no query", () => {
    expect(parseWishlistQuery("wishlist")).toEqual({
      kind: "wishlist",
      target: null,
      query: "",
    });
  });

  it("resolves `upcoming` to the calendar route", () => {
    expect(parseWishlistQuery("upcoming")).toEqual({
      kind: "wishlist",
      target: "upcoming",
      query: "",
    });
  });

  // The two routes were two tabs of one, and the palette taught `wishlist
  // upcoming` for the whole time they were. Both phrasings keep resolving.
  it("keeps resolving the pre-split `wishlist upcoming` / `wishlist all` phrasing", () => {
    expect(parseWishlistQuery("wishlist upcoming")).toEqual({
      kind: "wishlist",
      target: "upcoming",
      query: "",
    });
    expect(parseWishlistQuery("wishlist all")).toEqual({
      kind: "wishlist",
      target: "wishlist",
      query: "",
    });
  });

  it("is case- and whitespace-insensitive", () => {
    expect(parseWishlistQuery("  WishList   Upcoming ")).toEqual({
      kind: "wishlist",
      target: "upcoming",
      query: "",
    });
    expect(parseWishlistQuery(" UPCOMING ")).toEqual({
      kind: "wishlist",
      target: "upcoming",
      query: "",
    });
  });

  it("treats free text after the head as a name query", () => {
    expect(parseWishlistQuery("wishlist elden ring")).toEqual({
      kind: "wishlist",
      target: null,
      query: "elden ring",
    });
  });

  it("treats a keyword followed by more tokens as a name query (no combined target)", () => {
    expect(parseWishlistQuery("wishlist upcoming hollow")).toEqual({
      kind: "wishlist",
      target: null,
      query: "upcoming hollow",
    });
  });

  // The calendar has no per-item anchor to search toward, so `upcoming` takes no
  // arguments — and yielding null rather than a bare navigation leaves the input
  // to whichever parser does own it.
  it("declines `upcoming` with trailing tokens instead of ignoring them", () => {
    expect(parseWishlistQuery("upcoming hollow")).toBeNull();
  });
});
