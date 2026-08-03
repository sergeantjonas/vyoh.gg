import { describe, expect, it } from "vitest";
import {
  STEAM_TAB_SEGMENTS,
  type SteamTabDescriptor,
  isSteamTabActive,
  steamTabIndex,
  steamTabIndexOf,
} from "./tabs";

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

// This is the ordering three call sites used to keep by hand — the strip, the
// router's slide classifier and the WebKit substitute animation. A wrong index
// here does not throw, it slides the wrong way, so the ordering itself is what
// the test pins.
describe("steamTabIndex", () => {
  it("orders the tabs the way the strip renders them", () => {
    expect(STEAM_TAB_SEGMENTS).toEqual([
      "",
      "portrait",
      "library",
      "wishlist",
      "achievements",
    ]);
    expect(steamTabIndex("/steam")).toBe(0);
    expect(steamTabIndex("/steam/portrait")).toBe(1);
    expect(steamTabIndex("/steam/library")).toBe(2);
    expect(steamTabIndex("/steam/wishlist")).toBe(3);
    expect(steamTabIndex("/steam/achievements")).toBe(4);
  });

  it("treats the trailing-slash index as the index", () => {
    expect(steamTabIndex("/steam/")).toBe(0);
  });

  it("resolves a drill-in to the tab that owns it", () => {
    expect(steamTabIndex("/steam/library/1245620")).toBe(2);
    expect(steamTabIndex("/steam/achievements/signature")).toBe(4);
  });

  it("returns -1 outside the section, so a cross-section nav gets no slide", () => {
    expect(steamTabIndex("/lol/ahri")).toBe(-1);
    expect(steamTabIndex("/")).toBe(-1);
    // A path under /steam that is not a tab: still no direction to compute.
    expect(steamTabIndex("/steam/nonsense")).toBe(-1);
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
