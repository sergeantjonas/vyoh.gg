import type { SteamUpcomingItem } from "@vyoh/shared";
import { describe, expect, it } from "vitest";
import {
  type CivilDate,
  type DayRelease,
  brusselsCivilDate,
  civilDayDiff,
  daysUntilRelease,
  groupUpcoming,
  pickCalendarAnchor,
  pickImminentRelease,
  utcCivilDate,
} from "./bucketing";

// Unix seconds for a UTC calendar day at noon — far enough from either midnight
// that no realistic tz read shifts the civil day, matching Steam's placeholder
// shape (a date, not a precise instant).
function utcDay(year: number, month0: number, day: number): number {
  return Date.UTC(year, month0, day, 12, 0, 0) / 1_000;
}

function item(overrides: Partial<SteamUpcomingItem> = {}): SteamUpcomingItem {
  return {
    appid: 1,
    name: "Game",
    dateAdded: 1_700_000_000,
    source: "wishlist",
    storeUrl: "https://store.steampowered.com/app/1",
    releaseDate: null,
    comingSoon: true,
    ...overrides,
  };
}

describe("brusselsCivilDate", () => {
  it("flips the day at Brussels midnight, not UTC midnight (summer, UTC+2)", () => {
    // 22:30 UTC on Jun 11 is already 00:30 Jun 12 in Brussels (CEST).
    expect(brusselsCivilDate(new Date("2026-06-11T22:30:00Z"))).toEqual({
      year: 2026,
      month: 5,
      day: 12,
    });
  });

  it("respects the winter offset (UTC+1)", () => {
    // 23:30 UTC on Jan 15 is 00:30 Jan 16 in Brussels (CET).
    expect(brusselsCivilDate(new Date("2026-01-15T23:30:00Z"))).toEqual({
      year: 2026,
      month: 0,
      day: 16,
    });
  });
});

describe("utcCivilDate", () => {
  it("reads a placeholder as its UTC calendar day", () => {
    // Beast of Reincarnation — Aug 3, 2026 from the chunk-0 probe.
    expect(utcCivilDate(1_785_776_400)).toEqual({ year: 2026, month: 7, day: 3 });
  });
});

describe("civilDayDiff", () => {
  it("counts whole days across a month boundary", () => {
    const a: CivilDate = { year: 2026, month: 6, day: 2 }; // Jul 2
    const b: CivilDate = { year: 2026, month: 5, day: 28 }; // Jun 28
    expect(civilDayDiff(a, b)).toBe(4);
    expect(civilDayDiff(b, a)).toBe(-4);
  });

  it("is DST-immune across a spring-forward boundary", () => {
    // Brussels springs forward on Mar 29, 2026; the civil-day count must stay
    // whole regardless (both triples re-anchor to UTC midnight).
    const a: CivilDate = { year: 2026, month: 2, day: 30 };
    const b: CivilDate = { year: 2026, month: 2, day: 28 };
    expect(civilDayDiff(a, b)).toBe(2);
  });
});

describe("daysUntilRelease", () => {
  const now = new Date("2026-06-11T10:00:00Z"); // midday Brussels Jun 11

  it("is positive for a future release", () => {
    expect(daysUntilRelease(utcDay(2026, 5, 21), now)).toBe(10);
  });

  it("is zero on release day", () => {
    expect(daysUntilRelease(utcDay(2026, 5, 11), now)).toBe(0);
  });

  it("is negative for a release that already passed (ghost)", () => {
    expect(daysUntilRelease(utcDay(2026, 5, 1), now)).toBe(-10);
  });
});

describe("groupUpcoming", () => {
  const now = new Date("2026-06-11T10:00:00Z");

  it("partitions into day / quarter / year / tba and drops released titles", () => {
    const released = item({
      appid: 10,
      comingSoon: false,
      releaseDate: utcDay(2025, 0, 1),
    });
    const dayFuture = item({ appid: 11, releaseDate: utcDay(2026, 7, 3) }); // Aug 3
    const dayPast = item({ appid: 12, releaseDate: utcDay(2026, 4, 28) }); // May 28, passed
    const quarter = item({ appid: 13, releaseDate: utcDay(2026, 8, 30) }); // Sep 30 → Q3
    const year = item({ appid: 14, releaseDate: utcDay(2026, 11, 31) }); // Dec 31 → 2026
    const tba = item({ appid: 15, releaseDate: null });

    const out = groupUpcoming([released, dayFuture, dayPast, quarter, year, tba], now);

    expect(out.dayReleases.map((d) => d.item.appid)).toEqual([12, 11]); // sorted by date
    expect(out.dayReleases.find((d) => d.item.appid === 12)?.isPast).toBe(true);
    expect(out.dayReleases.find((d) => d.item.appid === 11)?.isPast).toBe(false);

    expect(out.quarterBands).toHaveLength(1);
    expect(out.quarterBands[0]).toMatchObject({ year: 2026, quarter: 3 });
    expect(out.quarterBands[0]?.items.map((i) => i.appid)).toEqual([13]);

    expect(out.yearBands).toHaveLength(1);
    expect(out.yearBands[0]).toMatchObject({ year: 2026 });
    expect(out.yearBands[0]?.items.map((i) => i.appid)).toEqual([14]);

    expect(out.tba.map((i) => i.appid)).toEqual([15]);
  });

  it("groups multiple quarter-precise titles into one band, chronological", () => {
    const sep = item({ appid: 1, releaseDate: utcDay(2026, 8, 30) }); // Sep 30 → Q3
    const jul = item({ appid: 2, releaseDate: utcDay(2026, 5, 30) }); // Jun 30 → Q2
    const out = groupUpcoming([sep, jul], now);
    // Q2 band sorts before Q3 band.
    expect(out.quarterBands.map((b) => b.quarter)).toEqual([2, 3]);
  });

  it("orders the TBA pile newest-added first", () => {
    const older = item({ appid: 1, releaseDate: null, dateAdded: 1_600_000_000 });
    const newer = item({ appid: 2, releaseDate: null, dateAdded: 1_700_000_000 });
    const out = groupUpcoming([older, newer], now);
    expect(out.tba.map((i) => i.appid)).toEqual([2, 1]);
  });
});

describe("pickCalendarAnchor", () => {
  const today: CivilDate = { year: 2026, month: 5, day: 11 }; // June 2026

  function dayRel(year: number, month: number, isPast = false): DayRelease {
    return {
      item: item({ releaseDate: utcDay(year, month, 15) }),
      date: { year, month, day: 15 },
      daysUntil: isPast ? -5 : 30,
      isPast,
    };
  }

  it("anchors on the current month when the default window is dense enough", () => {
    const releases = [dayRel(2026, 5), dayRel(2026, 6)]; // June + July
    expect(pickCalendarAnchor(releases, today)).toEqual({ year: 2026, month: 5, day: 1 });
  });

  it("shifts to the nearest future month when the default window is sparse", () => {
    const releases = [dayRel(2026, 7), dayRel(2026, 8)]; // Aug + Sep, none in Jun/Jul
    expect(pickCalendarAnchor(releases, today)).toEqual({ year: 2026, month: 7, day: 1 });
  });

  it("falls back to the current month when there are no future day-releases", () => {
    const releases = [dayRel(2026, 4, true)]; // only a past ghost
    expect(pickCalendarAnchor(releases, today)).toEqual({ year: 2026, month: 5, day: 1 });
  });
});

describe("pickImminentRelease", () => {
  function dayRel(appid: number, daysUntil: number, isPast = false): DayRelease {
    return {
      item: item({ appid, releaseDate: utcDay(2026, 7, 3) }),
      date: { year: 2026, month: 7, day: 3 },
      daysUntil,
      isPast,
    };
  }

  it("picks the nearest future day-release inside the horizon", () => {
    const out = pickImminentRelease([dayRel(1, 53), dayRel(2, 12), dayRel(3, 40)]);
    expect(out?.item.appid).toBe(2);
  });

  it("ignores past-but-still-wishlisted ghosts — the hero is forward-looking", () => {
    const out = pickImminentRelease([dayRel(1, -3, true), dayRel(2, 20)]);
    expect(out?.item.appid).toBe(2);
  });

  it("returns null when the nearest day-release is beyond the horizon", () => {
    expect(pickImminentRelease([dayRel(1, 90), dayRel(2, 120)])).toBeNull();
  });

  it("honours a custom horizon", () => {
    expect(pickImminentRelease([dayRel(1, 45)], 30)).toBeNull();
    expect(pickImminentRelease([dayRel(1, 45)], 60)?.item.appid).toBe(1);
  });

  it("returns null for an empty day-release list", () => {
    expect(pickImminentRelease([])).toBeNull();
  });
});
