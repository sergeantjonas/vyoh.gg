import { describe, expect, it } from "vitest";
import { type SteamTabDescriptor, isSteamTabActive, steamTabIndexOf } from "./tabs";

const PROFILE: SteamTabDescriptor = { to: "/steam", label: "Profile", exact: true };
const LIBRARY: SteamTabDescriptor = {
  to: "/steam/library",
  label: "Library",
  exact: false,
};
const WISHLIST: SteamTabDescriptor = {
  to: "/steam/wishlist",
  label: "Wishlist",
  exact: false,
};
// Synthetic tab kept to cover `extraPrefixes` — no real Steam tab uses it
// today (the prior `/steam/game/$appid` drill-in is now `/steam/library/$appid`,
// natively under the Library prefix), but `extraPrefixes` is still a supported
// field on SteamTabDescriptor and we want its branch tested.
const EXTRA: SteamTabDescriptor = {
  to: "/steam/extra",
  label: "Extra",
  exact: false,
  extraPrefixes: ["/steam/sibling"],
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
    expect(isSteamTabActive(EXTRA, "/steam/sibling/440")).toBe(true);
  });

  it("returns false when no exact match or prefix matches", () => {
    expect(isSteamTabActive(LIBRARY, "/steam/wishlist")).toBe(false);
  });

  it("returns false on prefix near-misses (path is parent of the prefix)", () => {
    expect(isSteamTabActive(LIBRARY, "/steam/libraryz")).toBe(false);
  });
});

describe("steamTabIndexOf", () => {
  it("returns the index of the first active tab", () => {
    expect(steamTabIndexOf(TABS, "/steam")).toBe(0);
    expect(steamTabIndexOf(TABS, "/steam/library/440")).toBe(1);
    expect(steamTabIndexOf(TABS, "/steam/library/730")).toBe(1);
    expect(steamTabIndexOf(TABS, "/steam/wishlist")).toBe(2);
  });

  it("returns -1 when no tab matches", () => {
    expect(steamTabIndexOf(TABS, "/lol")).toBe(-1);
  });
});
