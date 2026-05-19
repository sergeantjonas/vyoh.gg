import { describe, expect, it } from "vitest";
import {
  type LolTabDescriptor,
  iconPop,
  isInMatchesSubtree,
  isMatchDetail,
  isTabActive,
  normalizePath,
  resolveTabPath,
  tabIndexFromPath,
} from "./account-tab-helpers";

const SLUG = "jonas-euw";
const TABS: LolTabDescriptor[] = [
  { to: "/lol/$accountSlug", exact: true },
  { to: "/lol/$accountSlug/matches", exact: false },
  { to: "/lol/$accountSlug/trends", exact: false },
  { to: "/lol/$accountSlug/champions", exact: false },
  { to: "/lol/$accountSlug/patches", exact: false },
];

describe("normalizePath", () => {
  it("strips a single trailing slash", () => {
    expect(normalizePath("/lol/jonas-euw/")).toBe("/lol/jonas-euw");
  });

  it("leaves paths without a trailing slash untouched", () => {
    expect(normalizePath("/lol/jonas-euw")).toBe("/lol/jonas-euw");
  });

  it("returns the empty string for an empty input", () => {
    expect(normalizePath("")).toBe("");
  });
});

describe("resolveTabPath", () => {
  it("substitutes $accountSlug and strips trailing slashes", () => {
    expect(resolveTabPath("/lol/$accountSlug/matches/", SLUG)).toBe(
      "/lol/jonas-euw/matches"
    );
  });

  it("returns the tab path unchanged when no $accountSlug placeholder is present", () => {
    expect(resolveTabPath("/lol", SLUG)).toBe("/lol");
  });
});

describe("isTabActive", () => {
  it("matches an exact tab only on the literal substituted path", () => {
    const profile = { to: "/lol/$accountSlug", exact: true };
    expect(isTabActive(profile, "/lol/jonas-euw", SLUG)).toBe(true);
    expect(isTabActive(profile, "/lol/jonas-euw/matches", SLUG)).toBe(false);
  });

  it("matches a prefix tab on the literal path", () => {
    const matches = { to: "/lol/$accountSlug/matches", exact: false };
    expect(isTabActive(matches, "/lol/jonas-euw/matches", SLUG)).toBe(true);
  });

  it("matches a prefix tab on a sub-path", () => {
    const matches = { to: "/lol/$accountSlug/matches", exact: false };
    expect(isTabActive(matches, "/lol/jonas-euw/matches/EUW1_1", SLUG)).toBe(true);
  });

  it("returns false on a near-miss prefix (parent of the tab path)", () => {
    const matches = { to: "/lol/$accountSlug/matches", exact: false };
    expect(isTabActive(matches, "/lol/jonas-euw/matchesz", SLUG)).toBe(false);
  });
});

describe("tabIndexFromPath", () => {
  it("returns the index of the matching tab", () => {
    expect(tabIndexFromPath(TABS, "/lol/jonas-euw", SLUG)).toBe(0);
    expect(tabIndexFromPath(TABS, "/lol/jonas-euw/matches", SLUG)).toBe(1);
    expect(tabIndexFromPath(TABS, "/lol/jonas-euw/trends", SLUG)).toBe(2);
    expect(tabIndexFromPath(TABS, "/lol/jonas-euw/champions", SLUG)).toBe(3);
    expect(tabIndexFromPath(TABS, "/lol/jonas-euw/patches", SLUG)).toBe(4);
  });

  it("normalizes the trailing slash before comparing", () => {
    expect(tabIndexFromPath(TABS, "/lol/jonas-euw/matches/", SLUG)).toBe(1);
  });

  it("returns -1 for paths deeper than any tab (e.g. match-detail subpaths)", () => {
    expect(tabIndexFromPath(TABS, "/lol/jonas-euw/matches/EUW1_1", SLUG)).toBe(-1);
  });

  it("returns -1 for paths outside the account subtree", () => {
    expect(tabIndexFromPath(TABS, "/steam", SLUG)).toBe(-1);
  });
});

describe("isInMatchesSubtree", () => {
  it("returns true for the literal /matches path", () => {
    expect(isInMatchesSubtree("/lol/jonas-euw/matches", SLUG)).toBe(true);
  });

  it("returns true for any /matches/* subpath", () => {
    expect(isInMatchesSubtree("/lol/jonas-euw/matches/EUW1_1", SLUG)).toBe(true);
    expect(isInMatchesSubtree("/lol/jonas-euw/matches/EUW1_1/timeline", SLUG)).toBe(true);
  });

  it("returns false for siblings of the matches subtree", () => {
    expect(isInMatchesSubtree("/lol/jonas-euw/trends", SLUG)).toBe(false);
    expect(isInMatchesSubtree("/lol/jonas-euw", SLUG)).toBe(false);
  });
});

describe("isMatchDetail", () => {
  it("returns false on the bare /matches listing route", () => {
    expect(isMatchDetail("/lol/jonas-euw/matches", SLUG)).toBe(false);
  });

  it("returns true on any /matches/<id> path or deeper", () => {
    expect(isMatchDetail("/lol/jonas-euw/matches/EUW1_1", SLUG)).toBe(true);
    expect(isMatchDetail("/lol/jonas-euw/matches/EUW1_1/timeline", SLUG)).toBe(true);
  });

  it("returns false for non-matches subtrees", () => {
    expect(isMatchDetail("/lol/jonas-euw/trends", SLUG)).toBe(false);
  });
});

describe("iconPop", () => {
  it("returns a distinct variant per known label", () => {
    expect(iconPop("Profile")).toEqual({ scale: 0.75, y: -4 });
    expect(iconPop("Matches")).toEqual({ scale: 0.75, rotate: -12 });
    expect(iconPop("Trends")).toEqual({ scale: 0.75, y: 5 });
    expect(iconPop("Live")).toEqual({ scale: 0.75, y: -4 });
  });

  it("falls back to a generic pop for unknown labels", () => {
    expect(iconPop("Champions")).toEqual({ scale: 0.65, rotate: 8 });
    expect(iconPop("UnknownLabel")).toEqual({ scale: 0.65, rotate: 8 });
  });
});
