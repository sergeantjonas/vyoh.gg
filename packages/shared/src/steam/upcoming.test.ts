import { describe, expect, it } from "vitest";
import type { SteamUpcomingItem } from "./upcoming.ts";
import { classifyReleasePrecision } from "./wishlist.ts";

function upcoming(overrides: Partial<SteamUpcomingItem> = {}): SteamUpcomingItem {
  return {
    appid: 2584270,
    name: "Mortal Shell II",
    storeUrl: "https://store.steampowered.com/app/2584270/",
    releaseDate: Math.floor(Date.UTC(2026, 7, 20) / 1000),
    comingSoon: true,
    dateAdded: Math.floor(Date.UTC(2026, 6, 31) / 1000),
    source: "owned",
    ...overrides,
  };
}

// The reason SteamUpcomingItem mirrors SteamWishlistItem's field names: the
// precision classifier and the bucketing built on it take either item as-is. If
// this stops compiling, the two shapes have drifted and every upcoming renderer
// needs a widened signature.
describe("SteamUpcomingItem", () => {
  it("classifies through the wishlist precision rules unchanged", () => {
    expect(classifyReleasePrecision(upcoming())).toBe("day");
  });

  it("classifies an owned pre-order with no announced date as TBA", () => {
    expect(classifyReleasePrecision(upcoming({ releaseDate: null }))).toBe("tba");
  });

  // Placeholder detection is provenance-blind — a quarter-end date off an owned
  // enrichment row reads the same as one off the live wishlist call.
  it("reads a quarter-end placeholder off an owned item", () => {
    const item = upcoming({ releaseDate: Math.floor(Date.UTC(2026, 8, 30) / 1000) });
    expect(classifyReleasePrecision(item)).toBe("quarter");
  });
});
