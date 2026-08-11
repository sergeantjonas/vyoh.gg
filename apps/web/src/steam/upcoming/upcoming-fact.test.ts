import type { SteamUpcomingItem } from "@vyoh/shared";
import { describe, expect, it } from "vitest";
import { type UpcomingFact, formatUpcomingFact, pickUpcomingFact } from "./upcoming-fact";

// Anchor "now" at a winter date so Brussels (UTC+1) and UTC civil dates agree on
// the day, keeping daysUntil arithmetic obvious in the fixtures below.
const NOW = new Date("2026-01-15T12:00:00Z");

// Epoch (seconds) for a UTC date at noon — avoids any tz day-shift and keeps the
// dates clear of the quarter/year placeholder shapes (Mar 31 / Jun 30 / Sep 30 /
// Dec 31) that classifyReleasePrecision treats as coarse precision.
function release(year: number, month1: number, day: number): number {
  return Date.UTC(year, month1 - 1, day, 12, 0, 0) / 1_000;
}

function makeItem(overrides: Partial<SteamUpcomingItem> = {}): SteamUpcomingItem {
  return {
    appid: 1,
    name: "Test Game",
    dateAdded: 1_577_836_800, // 2020-01-01
    source: "wishlist",
    storeUrl: "https://store.steampowered.com/app/1",
    releaseDate: null,
    comingSoon: false,
    ...overrides,
  };
}

function dated(overrides: Partial<SteamUpcomingItem>): SteamUpcomingItem {
  return makeItem({ comingSoon: true, ...overrides });
}

describe("pickUpcomingFact", () => {
  it("returns null for an empty wishlist", () => {
    expect(pickUpcomingFact([], NOW)).toBeNull();
  });

  it("picks the nearest day-precise release within 30 days as `imminent`", () => {
    const fact = pickUpcomingFact(
      [
        dated({ appid: 10, name: "Soon", releaseDate: release(2026, 1, 25) }), // +10d
        dated({ appid: 11, name: "Later", releaseDate: release(2026, 3, 10) }), // +54d
      ],
      NOW
    );
    expect(fact).toEqual({
      kind: "imminent",
      item: expect.objectContaining({ appid: 10 }),
      daysUntil: 10,
    });
  });

  it("treats a release on today as imminent with daysUntil 0", () => {
    const fact = pickUpcomingFact(
      [dated({ appid: 12, releaseDate: release(2026, 1, 15) })],
      NOW
    );
    expect(fact).toMatchObject({ kind: "imminent", daysUntil: 0 });
  });

  it("frames a 31–90 day release as `dated` with its civil date (0-based month)", () => {
    const fact = pickUpcomingFact(
      [dated({ appid: 20, name: "March", releaseDate: release(2026, 3, 10) })], // +54d
      NOW
    );
    expect(fact).toEqual({
      kind: "dated",
      item: expect.objectContaining({ appid: 20 }),
      date: { year: 2026, month: 2, day: 10 },
    });
  });

  it("ignores already-released (past) day-precise entries and picks the next future one", () => {
    const fact = pickUpcomingFact(
      [
        dated({ appid: 30, name: "Ghost", releaseDate: release(2026, 1, 10) }), // -5d
        dated({ appid: 31, name: "Next", releaseDate: release(2026, 1, 25) }), // +10d
      ],
      NOW
    );
    expect(fact).toMatchObject({ kind: "imminent", item: { appid: 31 } });
  });

  it("falls through to the longest-waiting TBA item when the nearest release is beyond 90 days", () => {
    const fact = pickUpcomingFact(
      [
        dated({ appid: 40, name: "Far", releaseDate: release(2026, 6, 1) }), // +137d
        dated({
          appid: 41,
          name: "Old TBA",
          releaseDate: null,
          dateAdded: 1_400_000_000,
        }),
        dated({
          appid: 42,
          name: "New TBA",
          releaseDate: null,
          dateAdded: 1_700_000_000,
        }),
      ],
      NOW
    );
    // Oldest TBA = smallest dateAdded.
    expect(fact).toMatchObject({ kind: "waiting", item: { appid: 41 } });
  });

  it("returns null when the nearest release is beyond 90 days and there is no TBA item", () => {
    const fact = pickUpcomingFact(
      [dated({ appid: 50, releaseDate: release(2026, 6, 1) })], // +137d
      NOW
    );
    expect(fact).toBeNull();
  });

  // Guards the deliberate omission of spec tier 3 ("N launches in {Month}"): even
  // when many day-precise releases share one near month, the picker still resolves
  // to the single nearest release, never a cluster fact. See the gate note in
  // upcoming-fact.ts — tier 3 is structurally unreachable for a personal wishlist.
  it("does not emit a cluster fact when several day-precise releases share a month", () => {
    const items = Array.from({ length: 6 }, (_, i) =>
      dated({ appid: 60 + i, name: `Feb ${i + 1}`, releaseDate: release(2026, 2, 3 + i) })
    );
    const fact = pickUpcomingFact(items, NOW);
    // Nearest is Feb 3 (+19d) → a single imminent fact, not a "6 launches in
    // February" cluster. The cluster tier does not exist.
    expect(fact).toMatchObject({ kind: "imminent", item: { appid: 60 } });
  });
});

describe("formatUpcomingFact", () => {
  const game = makeItem({ appid: 7, name: "Dawnwalker" });
  const bought = makeItem({ appid: 7, name: "Dawnwalker", source: "owned" });

  it("frames an imminent release with the day count", () => {
    const fact: UpcomingFact = { kind: "imminent", item: game, daysUntil: 12 };
    expect(formatUpcomingFact(fact)).toBe("Next up: Dawnwalker, in 12 days.");
  });

  it("collapses 0/1 days to out today / out tomorrow", () => {
    expect(formatUpcomingFact({ kind: "imminent", item: game, daysUntil: 0 })).toBe(
      "Next up: Dawnwalker, out today."
    );
    expect(formatUpcomingFact({ kind: "imminent", item: game, daysUntil: 1 })).toBe(
      "Next up: Dawnwalker, out tomorrow."
    );
  });

  it("frames a dated release as Coming {Month D} (0-based month, no year)", () => {
    const fact: UpcomingFact = {
      kind: "dated",
      item: game,
      date: { year: 2026, month: 7, day: 3 }, // month 7 = August
    };
    expect(formatUpcomingFact(fact)).toBe("Coming Aug 3: Dawnwalker.");
  });

  // "Next up" reads as anticipation of a purchase decision that has already been
  // made. The card is the only surface that knows the difference.
  it("says so when the nearest release is already bought", () => {
    expect(formatUpcomingFact({ kind: "imminent", item: bought, daysUntil: 9 })).toBe(
      "Already yours: Dawnwalker, in 9 days."
    );
    expect(
      formatUpcomingFact({
        kind: "dated",
        item: bought,
        date: { year: 2026, month: 7, day: 3 },
      })
    ).toBe("Bought, lands Aug 3: Dawnwalker.");
  });

  it("frames a TBA fallback as still-waiting", () => {
    expect(formatUpcomingFact({ kind: "waiting", item: game })).toBe(
      "Still waiting on Dawnwalker."
    );
  });

  it("uses a placeholder name when the item has no title", () => {
    const nameless = makeItem({ appid: 9, name: null });
    expect(formatUpcomingFact({ kind: "waiting", item: nameless })).toBe(
      "Still waiting on an untitled game."
    );
  });
});
