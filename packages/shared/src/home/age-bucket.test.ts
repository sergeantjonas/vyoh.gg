import { describe, expect, it } from "vitest";
import { ageBucketFromDaysSince, daysSinceIso } from "./age-bucket.ts";

describe("ageBucketFromDaysSince", () => {
  it("buckets 0–7 days as current", () => {
    expect(ageBucketFromDaysSince(0)).toBe("current");
    expect(ageBucketFromDaysSince(7)).toBe("current");
  });

  it("buckets 8–30 days as recent", () => {
    expect(ageBucketFromDaysSince(8)).toBe("recent");
    expect(ageBucketFromDaysSince(30)).toBe("recent");
  });

  it("buckets 31–90 days as season", () => {
    expect(ageBucketFromDaysSince(31)).toBe("season");
    expect(ageBucketFromDaysSince(90)).toBe("season");
  });

  it("buckets >90 days as year", () => {
    expect(ageBucketFromDaysSince(91)).toBe("year");
    expect(ageBucketFromDaysSince(10_000)).toBe("year");
  });

  it("collapses negative days to current (clock skew tolerance)", () => {
    expect(ageBucketFromDaysSince(-3)).toBe("current");
  });

  it("throws on non-finite input", () => {
    expect(() => ageBucketFromDaysSince(Number.NaN)).toThrow();
    expect(() => ageBucketFromDaysSince(Number.POSITIVE_INFINITY)).toThrow();
  });
});

describe("daysSinceIso", () => {
  const now = new Date("2026-06-02T12:00:00Z");

  it("returns null for null input", () => {
    expect(daysSinceIso(null, now)).toBeNull();
  });

  it("returns null for unparseable strings", () => {
    expect(daysSinceIso("not-a-date", now)).toBeNull();
  });

  it("floors so a few hours ago reads as 0 days", () => {
    expect(daysSinceIso("2026-06-02T06:00:00Z", now)).toBe(0);
  });

  it("computes whole days for prior dates", () => {
    expect(daysSinceIso("2026-05-26T12:00:00Z", now)).toBe(7);
    expect(daysSinceIso("2026-03-04T12:00:00Z", now)).toBe(90);
  });

  it("returns a negative number for future timestamps (caller decides policy)", () => {
    expect(daysSinceIso("2026-06-05T12:00:00Z", now)).toBe(-3);
  });
});
