import type { SteamWishlistItem } from "@vyoh/shared";
import { describe, expect, it } from "vitest";
import { formatWishlistDateAdded, formatWishlistReleaseLabel } from "./format";

function item(overrides: Partial<SteamWishlistItem> = {}): SteamWishlistItem {
  return {
    appid: 1,
    name: "Game",
    dateAdded: 0,
    releaseDate: null,
    comingSoon: false,
    ...overrides,
  } as unknown as SteamWishlistItem;
}

describe("formatWishlistDateAdded", () => {
  it("formats epoch seconds into a Brussels-zoned d MMM yyyy string", () => {
    // 2024-06-15 00:00 UTC → 2024-06-15 02:00 Brussels (CEST UTC+2).
    const secs = Math.floor(Date.UTC(2024, 5, 15, 0, 0, 0) / 1000);
    const formatted = formatWishlistDateAdded(secs);
    expect(formatted).toMatch(/15 Jun 2024/);
  });

  it("formats a Dec 31 23:00 UTC value as Jan 1 of the next year in Brussels", () => {
    // 2024-12-31 23:00 UTC → 2025-01-01 00:00 CET (UTC+1).
    const secs = Math.floor(Date.UTC(2024, 11, 31, 23, 0, 0) / 1000);
    expect(formatWishlistDateAdded(secs)).toMatch(/1 Jan 2025/);
  });
});

describe("formatWishlistReleaseLabel", () => {
  it("returns 'Coming <year>' for coming-soon items with a releaseDate", () => {
    const secs = Math.floor(Date.UTC(2026, 5, 1) / 1000);
    expect(
      formatWishlistReleaseLabel(item({ comingSoon: true, releaseDate: secs }))
    ).toBe("Coming 2026");
  });

  it("returns 'Coming soon' for coming-soon items without a releaseDate", () => {
    expect(
      formatWishlistReleaseLabel(item({ comingSoon: true, releaseDate: null }))
    ).toBe("Coming soon");
  });

  it("returns 'Released <year>' for released items with a releaseDate", () => {
    const secs = Math.floor(Date.UTC(2007, 9, 10) / 1000);
    expect(
      formatWishlistReleaseLabel(item({ comingSoon: false, releaseDate: secs }))
    ).toBe("Released 2007");
  });

  it("returns null when released and no releaseDate is set", () => {
    expect(
      formatWishlistReleaseLabel(item({ comingSoon: false, releaseDate: null }))
    ).toBeNull();
  });
});
