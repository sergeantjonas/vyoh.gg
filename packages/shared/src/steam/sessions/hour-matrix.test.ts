import { describe, expect, it } from "vitest";
import { OWNER_TIME_ZONE } from "../../time-zone.ts";
import {
  buildHourMatrix,
  hourMatrixCellRank,
  hourMatrixTotalMinutes,
  localSlot,
} from "./hour-matrix.ts";

// 2026-09-08 is a Tuesday. Brussels is UTC+2 in September.
const TUE_2240_LOCAL = new Date("2026-09-08T20:40:00Z");
const WED_0252_LOCAL = new Date("2026-09-09T00:52:00Z");

describe("localSlot", () => {
  it("reads the owner-local weekday and hour, Monday-first", () => {
    expect(localSlot(TUE_2240_LOCAL, OWNER_TIME_ZONE)).toEqual({ weekday: 1, hour: 22 });
    expect(localSlot(WED_0252_LOCAL, OWNER_TIME_ZONE)).toEqual({ weekday: 2, hour: 2 });
  });

  it("puts Sunday last", () => {
    expect(localSlot(new Date("2026-09-13T12:00:00Z"), OWNER_TIME_ZONE).weekday).toBe(6);
  });
});

describe("buildHourMatrix", () => {
  it("splits a session across hour cells and across midnight", () => {
    const matrix = buildHourMatrix(
      [{ startedAt: TUE_2240_LOCAL, endedAt: WED_0252_LOCAL }],
      OWNER_TIME_ZONE
    );
    expect(matrix[1]?.[22]).toBe(20);
    expect(matrix[1]?.[23]).toBe(60);
    expect(matrix[2]?.[0]).toBe(60);
    expect(matrix[2]?.[1]).toBe(60);
    expect(matrix[2]?.[2]).toBe(52);
    expect(hourMatrixTotalMinutes(matrix)).toBe(252);
  });

  it("is 7 × 24 of zeros for no sessions", () => {
    const matrix = buildHourMatrix([], OWNER_TIME_ZONE);
    expect(matrix).toHaveLength(7);
    for (const row of matrix) expect(row).toEqual(Array.from({ length: 24 }, () => 0));
  });

  it("accumulates overlapping sessions into the same cell", () => {
    const a = {
      startedAt: new Date("2026-09-08T19:00:00Z"),
      endedAt: new Date("2026-09-08T19:30:00Z"),
    };
    const b = {
      startedAt: new Date("2026-09-15T19:10:00Z"),
      endedAt: new Date("2026-09-15T19:40:00Z"),
    };
    const matrix = buildHourMatrix([a, b], OWNER_TIME_ZONE);
    expect(matrix[1]?.[21]).toBe(60);
  });
});

describe("buildHourMatrix across DST", () => {
  // Brussels falls back at 03:00 → 02:00 on 2026-10-25 and springs forward at
  // 02:00 → 03:00 on 2026-03-29. Both nights are Saturday → Sunday. The walk
  // steps by UTC hour and asks Intl for the local slot each time, so the
  // repeated 02:00 hour lands twice in the same cell and the skipped hour
  // stays empty, with no minute lost either way.
  it("puts the repeated hour's minutes in one cell on fall-back night", () => {
    const matrix = buildHourMatrix(
      [
        {
          startedAt: new Date("2026-10-24T23:30:00Z"), // 01:30 CEST
          endedAt: new Date("2026-10-25T01:30:00Z"), // 02:30 CET, after the repeat
        },
      ],
      OWNER_TIME_ZONE
    );
    expect(matrix[6]?.[1]).toBe(30);
    expect(matrix[6]?.[2]).toBe(90);
    expect(hourMatrixTotalMinutes(matrix)).toBe(120);
  });

  it("leaves the skipped hour empty on spring-forward night", () => {
    const matrix = buildHourMatrix(
      [
        {
          startedAt: new Date("2026-03-29T00:30:00Z"), // 01:30 CET
          endedAt: new Date("2026-03-29T02:30:00Z"), // 04:30 CEST
        },
      ],
      OWNER_TIME_ZONE
    );
    expect(matrix[6]?.[1]).toBe(30);
    expect(matrix[6]?.[2]).toBe(0);
    expect(matrix[6]?.[3]).toBe(60);
    expect(matrix[6]?.[4]).toBe(30);
    expect(hourMatrixTotalMinutes(matrix)).toBe(120);
  });
});

describe("hourMatrixCellRank", () => {
  it("ranks the fullest cell first and shares rank on ties", () => {
    const matrix = buildHourMatrix([], OWNER_TIME_ZONE);
    const set = (weekday: number, hour: number, minutes: number) => {
      const row = matrix[weekday];
      if (!row) throw new Error(`no row ${weekday}`);
      row[hour] = minutes;
    };
    set(1, 21, 120);
    set(3, 21, 120);
    set(5, 14, 30);
    expect(hourMatrixCellRank(matrix, { weekday: 1, hour: 21 })).toBe(1);
    expect(hourMatrixCellRank(matrix, { weekday: 3, hour: 21 })).toBe(1);
    expect(hourMatrixCellRank(matrix, { weekday: 5, hour: 14 })).toBe(3);
    expect(hourMatrixCellRank(matrix, { weekday: 0, hour: 0 })).toBe(4);
  });
});
