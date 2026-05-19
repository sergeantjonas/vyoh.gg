import { describe, expect, it } from "vitest";
import { type SteamTabDescriptor, isSteamTabActive, steamTabIndexOf } from "./tabs";

const PROFILE: SteamTabDescriptor = { to: "/steam", label: "Profile", exact: true };
const LIBRARY: SteamTabDescriptor = {
  to: "/steam/library",
  label: "Library",
  exact: false,
  extraPrefixes: ["/steam/game"],
};
const WISHLIST: SteamTabDescriptor = {
  to: "/steam/wishlist",
  label: "Wishlist",
  exact: false,
};
const TABS = [PROFILE, LIBRARY, WISHLIST] as const;

describe("isSteamTabActive", () => {
  it("matches exact-only tabs only on the literal path", () => {
    expect(isSteamTabActive(PROFILE, "/steam")).toBe(true);
    expect(isSteamTabActive(PROFILE, "/steam/library")).toBe(false);
  });

  it("matches prefix tabs on the literal path", () => {
    expect(isSteamTabActive(LIBRARY, "/steam/library")).toBe(true);
  });

  it("matches prefix tabs on subpaths", () => {
    expect(isSteamTabActive(LIBRARY, "/steam/library/440")).toBe(true);
  });

  it("matches via extraPrefixes when the active path is a sibling drill-in", () => {
    expect(isSteamTabActive(LIBRARY, "/steam/game/440")).toBe(true);
  });

  it("returns false when no exact match, prefix, or extraPrefix matches", () => {
    expect(isSteamTabActive(LIBRARY, "/steam/wishlist")).toBe(false);
  });

  it("returns false on extraPrefix near-misses (path is parent of the prefix)", () => {
    expect(isSteamTabActive(LIBRARY, "/steam/gamez")).toBe(false);
  });
});

describe("steamTabIndexOf", () => {
  it("returns the index of the first active tab", () => {
    expect(steamTabIndexOf(TABS, "/steam")).toBe(0);
    expect(steamTabIndexOf(TABS, "/steam/library/440")).toBe(1);
    expect(steamTabIndexOf(TABS, "/steam/game/730")).toBe(1);
    expect(steamTabIndexOf(TABS, "/steam/wishlist")).toBe(2);
  });

  it("returns -1 when no tab matches", () => {
    expect(steamTabIndexOf(TABS, "/lol")).toBe(-1);
  });
});
