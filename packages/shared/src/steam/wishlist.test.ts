import { describe, expect, it } from "vitest";
import { type SteamWishlistItem, classifyReleasePrecision } from "./wishlist.ts";

function item(
  overrides: Partial<SteamWishlistItem>
): Pick<SteamWishlistItem, "releaseDate" | "comingSoon"> {
  return { releaseDate: null, comingSoon: false, ...overrides };
}

describe("classifyReleasePrecision", () => {
  it("returns null for already-released titles regardless of date", () => {
    // 007 First Light from the chunk-0 snapshot: released May 26, 2026.
    const released = Math.floor(Date.UTC(2026, 4, 26) / 1_000);
    expect(
      classifyReleasePrecision(item({ comingSoon: false, releaseDate: released }))
    ).toBeNull();
    expect(
      classifyReleasePrecision(item({ comingSoon: false, releaseDate: null }))
    ).toBeNull();
  });

  it("returns 'tba' for coming-soon titles with no date", () => {
    // Lords of the Fallen II / Tides of Annihilation / 1666: Amsterdam.
    expect(classifyReleasePrecision(item({ comingSoon: true, releaseDate: null }))).toBe(
      "tba"
    );
  });

  it("classifies concrete day-precise dates as 'day' (chunk-0 finding set)", () => {
    // Real production timestamps probed 2026-06-11.
    const beast = 1_785_776_400; // Beast of Reincarnation — Aug 3, 2026
    const control = 1_790_258_400; // CONTROL Resonant — Sep 24, 2026
    expect(classifyReleasePrecision(item({ comingSoon: true, releaseDate: beast }))).toBe(
      "day"
    );
    expect(
      classifyReleasePrecision(item({ comingSoon: true, releaseDate: control }))
    ).toBe("day");
  });

  it("classifies a Dec 31 UTC placeholder as 'year'", () => {
    // ILL / Mortal Shell II / Resident Evil Veronica land on the year band.
    const dec31 = Math.floor(Date.UTC(2027, 11, 31) / 1_000);
    expect(classifyReleasePrecision(item({ comingSoon: true, releaseDate: dec31 }))).toBe(
      "year"
    );
  });

  it("classifies Mar 31 / Jun 30 / Sep 30 UTC placeholders as 'quarter'", () => {
    const q1 = Math.floor(Date.UTC(2026, 2, 31) / 1_000);
    const q2 = Math.floor(Date.UTC(2026, 5, 30) / 1_000);
    const q3 = Math.floor(Date.UTC(2026, 8, 30) / 1_000);
    expect(classifyReleasePrecision(item({ comingSoon: true, releaseDate: q1 }))).toBe(
      "quarter"
    );
    expect(classifyReleasePrecision(item({ comingSoon: true, releaseDate: q2 }))).toBe(
      "quarter"
    );
    expect(classifyReleasePrecision(item({ comingSoon: true, releaseDate: q3 }))).toBe(
      "quarter"
    );
  });

  it("classifies a non-placeholder mid-month date as 'day', not 'quarter'", () => {
    // Guards the quarter-end check against false positives on ordinary dates.
    const midMonth = Math.floor(Date.UTC(2026, 2, 15) / 1_000);
    expect(
      classifyReleasePrecision(item({ comingSoon: true, releaseDate: midMonth }))
    ).toBe("day");
  });
});
