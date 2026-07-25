import { isWebKit } from "@/lib/is-webkit";
import { getNavigationType } from "@/lib/navigation-type";
import { supportsViewTransitions } from "@/lib/view-transition-nav";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/view-transition-nav", () => ({ supportsViewTransitions: vi.fn() }));
vi.mock("@/lib/is-webkit", () => ({ isWebKit: vi.fn() }));

// Only getNavigationType is exported; the five private helpers (lolTabIndex,
// steamTabIndex, lolSlug, isLolListDetailPair, isSteamLibraryPair) are driven
// through it.
function nav(from: string | undefined, to: string) {
  return getNavigationType(from === undefined ? undefined : { pathname: from }, {
    pathname: to,
  });
}

beforeEach(() => {
  // happy-dom has no document.startViewTransition, so the real
  // supportsViewTransitions() would short-circuit every case to false.
  vi.mocked(supportsViewTransitions).mockReturnValue(true);
  vi.mocked(isWebKit).mockReturnValue(false);
});

describe("getNavigationType — skip conditions", () => {
  it("skips on first navigation, when there is no from location", () => {
    expect(nav(undefined, "/lol/ahri")).toBe(false);
  });

  it("skips when the pathname is unchanged", () => {
    expect(nav("/lol/ahri/matches", "/lol/ahri/matches")).toBe(false);
  });

  // The engine gate is uniform: returning a types array would still make
  // TanStack Router call startViewTransition.
  it("skips entirely when the engine gate reports no view-transition support", () => {
    vi.mocked(supportsViewTransitions).mockReturnValue(false);
    expect(nav("/lol/ahri/matches", "/lol/ahri/trends")).toBe(false);
  });
});

describe("getNavigationType — cross-section", () => {
  it("classifies a scope change as cross-section", () => {
    expect(nav("/steam/library", "/lol/ahri")).toEqual(["cross-section"]);
    expect(nav("/lol/ahri", "/steam")).toEqual(["cross-section"]);
  });

  // Neither scope is /lol or /steam, so it falls through to the terminal
  // return rather than the early scope-mismatch one.
  it("classifies same-scope navigation outside lol and steam as cross-section", () => {
    expect(nav("/patches", "/patches/26-3")).toEqual(["cross-section"]);
  });

  // lolSlug returns null for a bare "/lol/" because the segment is empty.
  it("treats a lol path with no slug as cross-section", () => {
    expect(nav("/lol/", "/lol/ahri")).toEqual(["cross-section"]);
  });
});

describe("getNavigationType — lol section", () => {
  it("classifies a different slug as an account swap", () => {
    expect(nav("/lol/ahri/matches", "/lol/vyoh/matches")).toEqual(["account-swap"]);
  });

  // List-detail pairs are owned by per-element handlers; a router VT would
  // only add a viewport freeze.
  it("skips the matches list-detail pair", () => {
    expect(nav("/lol/ahri/matches", "/lol/ahri/matches/EUW1_123")).toBe(false);
    expect(nav("/lol/ahri/matches/EUW1_123", "/lol/ahri/matches")).toBe(false);
  });

  it("skips the champions list-detail pair", () => {
    expect(nav("/lol/ahri/champions", "/lol/ahri/champions/ahri")).toBe(false);
  });

  it("slides left when moving to a later tab", () => {
    expect(nav("/lol/ahri/matches", "/lol/ahri/trends")).toEqual(["slide-left"]);
    expect(nav("/lol/ahri", "/lol/ahri/live")).toEqual(["slide-left"]);
  });

  it("slides right when moving to an earlier tab", () => {
    expect(nav("/lol/ahri/trends", "/lol/ahri/matches")).toEqual(["slide-right"]);
    expect(nav("/lol/ahri/champions", "/lol/ahri")).toEqual(["slide-right"]);
  });

  // An unrecognised segment yields index -1 on one side.
  it("falls back to intra-section for a tab outside the known order", () => {
    expect(nav("/lol/ahri/matches", "/lol/ahri/nonsense")).toEqual(["intra-section"]);
  });

  it("treats the trailing-slash account root as tab index 0", () => {
    expect(nav("/lol/ahri/", "/lol/ahri/trends")).toEqual(["slide-left"]);
  });
});

describe("getNavigationType — steam section", () => {
  it("skips the library list-detail pair", () => {
    expect(nav("/steam/library", "/steam/library/42")).toBe(false);
  });

  // Engine gate, not a page gate: WebKit bypasses router VT for every sibling
  // tab nav in the section and uses the CSS-slide substitute instead.
  it("bypasses router view transitions entirely on WebKit", () => {
    vi.mocked(isWebKit).mockReturnValue(true);
    expect(nav("/steam/library", "/steam/wishlist")).toBe(false);
    expect(nav("/steam", "/steam/achievements")).toBe(false);
  });

  it("slides left when moving to a later tab", () => {
    expect(nav("/steam/library", "/steam/wishlist")).toEqual(["slide-left"]);
    expect(nav("/steam", "/steam/library")).toEqual(["slide-left"]);
  });

  it("slides right when moving to an earlier tab", () => {
    expect(nav("/steam/achievements", "/steam/library")).toEqual(["slide-right"]);
  });

  it("falls back to intra-section for a tab outside the known order", () => {
    expect(nav("/steam/library", "/steam/nonsense")).toEqual(["intra-section"]);
  });

  it("treats the trailing-slash section root as tab index 0", () => {
    expect(nav("/steam/", "/steam/wishlist")).toEqual(["slide-left"]);
  });
});
