import { describe, expect, it } from "vitest";
import {
  formatDuration,
  formatGameTime,
  formatGold,
  formatHoursMinutes,
  formatPlaytime,
} from "./format.ts";

describe("formatDuration", () => {
  it("returns 0m 00s for zero seconds", () => {
    expect(formatDuration(0)).toBe("0m 00s");
  });

  it("pads single-digit seconds with a leading zero", () => {
    expect(formatDuration(65)).toBe("1m 05s");
  });

  it("formats the 59m 59s boundary without rolling over to an hour", () => {
    expect(formatDuration(3599)).toBe("59m 59s");
  });

  it("does not convert to hours at 60 minutes — minutes accumulate", () => {
    expect(formatDuration(3600)).toBe("60m 00s");
  });

  it("handles long durations past 24h as raw minute counts", () => {
    expect(formatDuration(86400)).toBe("1440m 00s");
  });
});

describe("formatGameTime", () => {
  it("returns 0:00 for zero ms", () => {
    expect(formatGameTime(0)).toBe("0:00");
  });

  it("formats a typical mid-game timestamp", () => {
    expect(formatGameTime(65_000)).toBe("1:05");
  });

  it("formats the 59:59 boundary without rolling over to an hour", () => {
    expect(formatGameTime(3_599_000)).toBe("59:59");
  });

  it("keeps minutes accumulating past 60 instead of formatting hours", () => {
    expect(formatGameTime(3_600_000)).toBe("60:00");
  });

  it("floors sub-second remainders rather than rounding", () => {
    expect(formatGameTime(1_999)).toBe("0:01");
  });
});

describe("formatGold", () => {
  it("uses the 'g' suffix below 1000", () => {
    expect(formatGold(0)).toBe("0g");
    expect(formatGold(800)).toBe("800g");
    expect(formatGold(999)).toBe("999g");
  });

  it("switches to 'k' with one decimal place at exactly 1000", () => {
    expect(formatGold(1000)).toBe("1.0k");
  });

  it("formats large gold totals to one decimal place", () => {
    expect(formatGold(1500)).toBe("1.5k");
    expect(formatGold(12_345)).toBe("12.3k");
  });
});

describe("formatPlaytime", () => {
  it("uses minutes below one hour", () => {
    expect(formatPlaytime(0)).toBe("0m");
    expect(formatPlaytime(59)).toBe("59m");
  });

  it("rounds to whole hours at and above 60 minutes", () => {
    expect(formatPlaytime(60)).toBe("1h");
    expect(formatPlaytime(89)).toBe("1h");
    expect(formatPlaytime(90)).toBe("2h");
  });

  it("applies en-US thousands separators on large hour counts", () => {
    expect(formatPlaytime(60_000)).toBe("1,000h");
  });
});

describe("formatHoursMinutes", () => {
  it("returns 0m for zero and non-positive inputs", () => {
    expect(formatHoursMinutes(0)).toBe("0m");
    expect(formatHoursMinutes(-5)).toBe("0m");
  });

  it("returns minutes-only when below one hour", () => {
    expect(formatHoursMinutes(45)).toBe("45m");
  });

  it("returns hours-only on exact-hour boundaries", () => {
    expect(formatHoursMinutes(60)).toBe("1h");
    expect(formatHoursMinutes(1440)).toBe("24h");
  });

  it("combines hours and minutes when both are non-zero", () => {
    expect(formatHoursMinutes(65)).toBe("1h 5m");
    expect(formatHoursMinutes(125)).toBe("2h 5m");
  });
});
