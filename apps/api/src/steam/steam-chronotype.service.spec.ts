import { describe, expect, it } from "vitest";
import { bucketUnlocks } from "./steam-chronotype.service";

const TZ = "Europe/Brussels";

// 2024-06-15 is a Saturday in CEST (UTC+2). Supplying the offset explicitly
// keeps the test deterministic regardless of where the machine runs.
function dateAtHour(localHour: number): Date {
  const h = String(localHour).padStart(2, "0");
  return new Date(`2024-06-15T${h}:30:00+02:00`);
}

describe("bucketUnlocks", () => {
  it("returns 24 buckets for empty input", () => {
    const hours = bucketUnlocks([], TZ);
    expect(hours).toHaveLength(24);
    expect(hours.every((h) => h.count === 0)).toBe(true);
  });

  it("buckets are indexed 0..23 in order", () => {
    const hours = bucketUnlocks([], TZ);
    expect(hours.map((h) => h.hour)).toEqual(Array.from({ length: 24 }, (_, i) => i));
  });

  it("places a single unlock in the correct bucket", () => {
    const hours = bucketUnlocks([dateAtHour(14)], TZ);
    expect(hours[14]?.count).toBe(1);
    expect(hours.reduce((s, h) => s + h.count, 0)).toBe(1);
  });

  it("accumulates multiple unlocks in the same hour", () => {
    const dates = [dateAtHour(22), dateAtHour(22), dateAtHour(22)];
    const hours = bucketUnlocks(dates, TZ);
    expect(hours[22]?.count).toBe(3);
    expect(hours.reduce((s, h) => s + h.count, 0)).toBe(3);
  });

  it("distributes unlocks across distinct hours", () => {
    const dates = [dateAtHour(0), dateAtHour(6), dateAtHour(12), dateAtHour(23)];
    const hours = bucketUnlocks(dates, TZ);
    expect(hours[0]?.count).toBe(1);
    expect(hours[6]?.count).toBe(1);
    expect(hours[12]?.count).toBe(1);
    expect(hours[23]?.count).toBe(1);
    expect(hours.reduce((s, h) => s + h.count, 0)).toBe(4);
  });

  it("zero-counts non-targeted buckets when only one hour is hit", () => {
    const hours = bucketUnlocks([dateAtHour(3)], TZ);
    const nonTarget = hours.filter((h) => h.hour !== 3);
    expect(nonTarget.every((h) => h.count === 0)).toBe(true);
  });
});
