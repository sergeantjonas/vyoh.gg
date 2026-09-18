import { describe, expect, it } from "vitest";
import { OWNER_TIME_ZONE } from "../../time-zone.ts";
import {
  buildDayStrip,
  dayStripActiveDays,
  dayStripPeakMinutes,
  localDay,
} from "./day-strip.ts";

// Brussels is UTC+2 in September, so 20:40Z is 22:40 local the same day and
// 00:52Z is 02:52 local the next one.
const TUE_2240_LOCAL = new Date("2026-09-08T20:40:00Z");
const WED_0252_LOCAL = new Date("2026-09-09T00:52:00Z");
const THROUGH = new Date("2026-09-10T12:00:00Z");

const session = (
  startedAt: Date,
  endedAt: Date,
  unlocks = 0,
  appid = 1,
  name = "Onimusha"
) => ({
  appid,
  name,
  startedAt,
  endedAt,
  unlocks: Array.from({ length: unlocks }, (_, i) => ({ id: i })),
});

describe("localDay", () => {
  it("reads the owner-local calendar day, not the UTC one", () => {
    expect(localDay(WED_0252_LOCAL, OWNER_TIME_ZONE)).toBe("2026-09-09");
  });
});

describe("buildDayStrip", () => {
  it("splits a session across the two local days it touched", () => {
    const cells = buildDayStrip(
      [session(TUE_2240_LOCAL, WED_0252_LOCAL)],
      OWNER_TIME_ZONE,
      4,
      THROUGH
    );
    const byDay = new Map(cells.map((c) => [c.day, c]));
    expect(byDay.get("2026-09-08")?.minutes).toBe(80);
    expect(byDay.get("2026-09-09")?.minutes).toBe(172);
  });

  it("counts a midnight-spanning session once, on the day it started", () => {
    const cells = buildDayStrip(
      [session(TUE_2240_LOCAL, WED_0252_LOCAL, 2)],
      OWNER_TIME_ZONE,
      4,
      THROUGH
    );
    const byDay = new Map(cells.map((c) => [c.day, c]));
    expect(byDay.get("2026-09-08")?.sessionCount).toBe(1);
    expect(byDay.get("2026-09-08")?.unlockCount).toBe(2);
    expect(byDay.get("2026-09-09")?.sessionCount).toBe(0);
  });

  it("emits one cell per day in the window, oldest first, gaps included", () => {
    const cells = buildDayStrip([], OWNER_TIME_ZONE, 5, THROUGH);
    expect(cells.map((c) => c.day)).toEqual([
      "2026-09-06",
      "2026-09-07",
      "2026-09-08",
      "2026-09-09",
      "2026-09-10",
    ]);
    expect(cells.every((c) => c.minutes === 0)).toBe(true);
  });

  // A local day either side of a transition is 23 or 25 hours long, so walking
  // the instant back in 24 h steps skips 29 March and loses a cell at the
  // fall-back. Both instants below are ones that shape reached.
  it("emits one cell per day across a spring-forward", () => {
    // 22:30Z on 29 March is 00:30 local on the 30th, the hour after the jump.
    const cells = buildDayStrip([], OWNER_TIME_ZONE, 4, new Date("2026-03-29T22:30:00Z"));
    expect(cells.map((c) => c.day)).toEqual([
      "2026-03-27",
      "2026-03-28",
      "2026-03-29",
      "2026-03-30",
    ]);
  });

  it("emits one cell per day across a fall-back", () => {
    const cells = buildDayStrip([], OWNER_TIME_ZONE, 4, new Date("2026-10-25T22:30:00Z"));
    expect(cells.map((c) => c.day)).toEqual([
      "2026-10-22",
      "2026-10-23",
      "2026-10-24",
      "2026-10-25",
    ]);
  });

  it("keeps the spring-forward day's play rather than dropping its cell", () => {
    const cells = buildDayStrip(
      [session(new Date("2026-03-29T08:00:00Z"), new Date("2026-03-29T10:00:00Z"))],
      OWNER_TIME_ZONE,
      4,
      new Date("2026-03-29T22:30:00Z")
    );
    expect(cells.find((c) => c.day === "2026-03-29")?.minutes).toBe(120);
    expect(dayStripActiveDays(cells)).toBe(1);
  });

  it("rounds a session's minutes once rather than per hour slice", () => {
    // 90 s into the hour, running 2 h: per-slice rounding sums to 121.
    const cells = buildDayStrip(
      [
        session(
          new Date("2026-09-09T10:00:30Z"),
          new Date("2026-09-09T12:00:30Z"),
          0,
          1,
          "Onimusha"
        ),
      ],
      OWNER_TIME_ZONE,
      5,
      THROUGH
    );
    expect(cells.find((c) => c.day === "2026-09-09")?.minutes).toBe(120);
  });

  it("ignores sessions outside the window", () => {
    const old = new Date("2026-08-01T10:00:00Z");
    const cells = buildDayStrip(
      [session(old, new Date("2026-08-01T12:00:00Z"))],
      OWNER_TIME_ZONE,
      5,
      THROUGH
    );
    expect(dayStripActiveDays(cells)).toBe(0);
  });

  it("drops blip sessions rather than drawing them as a played day", () => {
    const tick = new Date("2026-09-10T08:00:00Z");
    const cells = buildDayStrip([session(tick, tick)], OWNER_TIME_ZONE, 5, THROUGH);
    expect(dayStripActiveDays(cells)).toBe(0);
    expect(cells.at(-1)?.sessionCount).toBe(0);
  });

  it("splits a day's minutes by game, most played first", () => {
    const cells = buildDayStrip(
      [
        session(
          new Date("2026-09-09T10:00:00Z"),
          new Date("2026-09-09T10:30:00Z"),
          0,
          2,
          "Mortal Shell II"
        ),
        session(TUE_2240_LOCAL, WED_0252_LOCAL),
      ],
      OWNER_TIME_ZONE,
      5,
      THROUGH
    );
    const wed = cells.find((c) => c.day === "2026-09-09");
    expect(wed?.byGame).toEqual([
      { appid: 1, name: "Onimusha", minutes: 172 },
      { appid: 2, name: "Mortal Shell II", minutes: 30 },
    ]);
  });

  it("reports the fullest day for scaling", () => {
    const cells = buildDayStrip(
      [
        session(new Date("2026-09-09T10:00:00Z"), new Date("2026-09-09T11:00:00Z")),
        session(TUE_2240_LOCAL, WED_0252_LOCAL),
      ],
      OWNER_TIME_ZONE,
      5,
      THROUGH
    );
    expect(dayStripPeakMinutes(cells)).toBe(232);
    expect(dayStripActiveDays(cells)).toBe(2);
  });
});
