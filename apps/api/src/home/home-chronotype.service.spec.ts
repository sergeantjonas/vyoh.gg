import { describe, expect, it } from "vitest";
import { bucketDates } from "./home-chronotype.service";

const TZ = "Europe/Brussels";

// 2024-06-15 is a Saturday in CEST (UTC+2).
function dateAtHour(localHour: number): Date {
  const h = String(localHour).padStart(2, "0");
  return new Date(`2024-06-15T${h}:30:00+02:00`);
}

describe("bucketDates", () => {
  it("returns 24 buckets for empty input", () => {
    const hours = bucketDates([], TZ);
    expect(hours).toHaveLength(24);
    expect(hours.every((h) => h.count === 0)).toBe(true);
  });

  it("buckets are indexed 0..23 in order", () => {
    const hours = bucketDates([], TZ);
    expect(hours.map((h) => h.hour)).toEqual(Array.from({ length: 24 }, (_, i) => i));
  });

  it("places a single date in the correct bucket", () => {
    const hours = bucketDates([dateAtHour(14)], TZ);
    expect(hours[14]?.count).toBe(1);
    expect(hours.reduce((s, h) => s + h.count, 0)).toBe(1);
  });

  it("accumulates multiple dates in the same hour", () => {
    const dates = [dateAtHour(22), dateAtHour(22), dateAtHour(22)];
    const hours = bucketDates(dates, TZ);
    expect(hours[22]?.count).toBe(3);
  });

  it("distributes dates across distinct hours", () => {
    const dates = [dateAtHour(0), dateAtHour(6), dateAtHour(12), dateAtHour(23)];
    const hours = bucketDates(dates, TZ);
    expect(hours[0]?.count).toBe(1);
    expect(hours[6]?.count).toBe(1);
    expect(hours[12]?.count).toBe(1);
    expect(hours[23]?.count).toBe(1);
    expect(hours.reduce((s, h) => s + h.count, 0)).toBe(4);
  });
});
