import type { SteamRecentUnlock } from "@vyoh/shared";
import { describe, expect, it } from "vitest";
import { formatRowDate, groupByMonth, monthKey } from "./group-by-month";

function unlock(iso: string, displayName = "Achievement"): SteamRecentUnlock {
  return {
    appid: 1,
    gameName: "Game",
    apiName: "API_NAME",
    displayName,
    hidden: false,
    unlockedAt: iso,
    globalPercent: null,
  };
}

describe("monthKey", () => {
  it("returns 'Month Year' for a typical ISO timestamp", () => {
    expect(monthKey("2024-06-15T12:00:00Z")).toBe("June 2024");
  });
});

describe("formatRowDate", () => {
  it("returns 'Mon D' day-of-year format", () => {
    expect(formatRowDate("2024-06-15T12:00:00Z")).toBe("Jun 15");
  });
});

describe("groupByMonth", () => {
  it("returns empty when given empty input", () => {
    expect(groupByMonth([])).toEqual([]);
  });

  it("buckets consecutive same-month unlocks into a single group", () => {
    const groups = groupByMonth([
      unlock("2024-06-15T12:00:00Z", "A"),
      unlock("2024-06-10T12:00:00Z", "B"),
      unlock("2024-06-01T12:00:00Z", "C"),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.label).toBe("June 2024");
    expect(groups[0]?.rows.map((r) => r.displayName)).toEqual(["A", "B", "C"]);
  });

  it("preserves insertion order (newest-month-first when input is desc)", () => {
    const groups = groupByMonth([
      unlock("2024-07-01T00:00:00Z"),
      unlock("2024-06-15T00:00:00Z"),
      unlock("2024-05-01T00:00:00Z"),
    ]);
    expect(groups.map((g) => g.label)).toEqual(["July 2024", "June 2024", "May 2024"]);
  });

  it("preserves row order inside a group", () => {
    const groups = groupByMonth([
      unlock("2024-06-30T00:00:00Z", "newest"),
      unlock("2024-06-15T00:00:00Z", "middle"),
      unlock("2024-06-01T00:00:00Z", "oldest"),
    ]);
    expect(groups[0]?.rows.map((r) => r.displayName)).toEqual([
      "newest",
      "middle",
      "oldest",
    ]);
  });
});
