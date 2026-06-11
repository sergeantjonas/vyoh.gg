import type { SteamWishlistItem } from "@vyoh/shared";
import { describe, expect, it } from "vitest";
import {
  formatWishlistDateAdded,
  formatWishlistFact,
  formatWishlistReleaseLabel,
} from "./format";
import type { WishlistFact } from "./wishlist-fact";

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
  it("renders a day-precise date for coming-soon items (the diagnosed fix)", () => {
    // Beast of Reincarnation — Aug 3, 2026. Previously collapsed to "Coming 2026".
    const secs = 1_785_776_400;
    expect(
      formatWishlistReleaseLabel(item({ comingSoon: true, releaseDate: secs }))
    ).toBe("Coming Aug 3, 2026");
  });

  it("renders 'Coming Q<n> <year>' for quarter-end placeholders", () => {
    const secs = Math.floor(Date.UTC(2026, 8, 30) / 1000); // Sep 30 → Q3
    expect(
      formatWishlistReleaseLabel(item({ comingSoon: true, releaseDate: secs }))
    ).toBe("Coming Q3 2026");
  });

  it("renders 'Coming <year>' for Dec 31 year placeholders", () => {
    const secs = Math.floor(Date.UTC(2027, 11, 31) / 1000);
    expect(
      formatWishlistReleaseLabel(item({ comingSoon: true, releaseDate: secs }))
    ).toBe("Coming 2027");
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

describe("formatWishlistFact", () => {
  const game = item({ appid: 7, name: "Dawnwalker" });

  it("frames an imminent release with the day count", () => {
    const fact: WishlistFact = { kind: "imminent", item: game, daysUntil: 12 };
    expect(formatWishlistFact(fact)).toBe("Next up: Dawnwalker, in 12 days.");
  });

  it("collapses 0/1 days to out today / out tomorrow", () => {
    expect(formatWishlistFact({ kind: "imminent", item: game, daysUntil: 0 })).toBe(
      "Next up: Dawnwalker, out today."
    );
    expect(formatWishlistFact({ kind: "imminent", item: game, daysUntil: 1 })).toBe(
      "Next up: Dawnwalker, out tomorrow."
    );
  });

  it("frames a dated release as Coming {Month D} (0-based month, no year)", () => {
    const fact: WishlistFact = {
      kind: "dated",
      item: game,
      date: { year: 2026, month: 7, day: 3 }, // month 7 = August
    };
    expect(formatWishlistFact(fact)).toBe("Coming Aug 3: Dawnwalker.");
  });

  it("frames a TBA fallback as still-waiting", () => {
    expect(formatWishlistFact({ kind: "waiting", item: game })).toBe(
      "Still waiting on Dawnwalker."
    );
  });

  it("uses a placeholder name when the item has no title", () => {
    const nameless = item({ appid: 9, name: null });
    expect(formatWishlistFact({ kind: "waiting", item: nameless })).toBe(
      "Still waiting on an untitled game."
    );
  });
});
