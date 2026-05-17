import { describe, expect, it } from "vitest";
import { bucketDates, mergePerStream } from "./home-chronotype.service";

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

describe("mergePerStream", () => {
  it("returns 24 buckets when both streams are empty", () => {
    const merged = mergePerStream(bucketDates([], TZ), bucketDates([], TZ));
    expect(merged).toHaveLength(24);
    expect(merged.every((h) => h.total === 0 && h.lol === 0 && h.steam === 0)).toBe(true);
  });

  it("keeps per-stream counts alongside the total", () => {
    const lol = bucketDates([dateAtHour(20), dateAtHour(20), dateAtHour(21)], TZ);
    const steam = bucketDates([dateAtHour(20), dateAtHour(22)], TZ);
    const merged = mergePerStream(lol, steam);
    expect(merged[20]).toEqual({ hour: 20, total: 3, lol: 2, steam: 1 });
    expect(merged[21]).toEqual({ hour: 21, total: 1, lol: 1, steam: 0 });
    expect(merged[22]).toEqual({ hour: 22, total: 1, lol: 0, steam: 1 });
  });

  it("attributes streams independently — no double counting", () => {
    const lol = bucketDates([dateAtHour(9)], TZ);
    const steam = bucketDates([dateAtHour(9)], TZ);
    const merged = mergePerStream(lol, steam);
    expect(merged[9]).toEqual({ hour: 9, total: 2, lol: 1, steam: 1 });
    // Total across all hours should equal lol+steam total — never doubled.
    const totalSum = merged.reduce((s, h) => s + h.total, 0);
    const lolSum = merged.reduce((s, h) => s + h.lol, 0);
    const steamSum = merged.reduce((s, h) => s + h.steam, 0);
    expect(totalSum).toBe(lolSum + steamSum);
  });

  it("hour ordering is preserved 0..23", () => {
    const merged = mergePerStream(bucketDates([], TZ), bucketDates([], TZ));
    expect(merged.map((h) => h.hour)).toEqual(Array.from({ length: 24 }, (_, i) => i));
  });
});
