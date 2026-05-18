import { describe, expect, it } from "vitest";
import { excludeRemakes } from "./exclude-remakes.ts";

describe("excludeRemakes", () => {
  it("returns an empty array for empty input", () => {
    expect(excludeRemakes([])).toEqual([]);
  });

  it("returns no matches when all are remakes", () => {
    const input = [{ remake: true }, { remake: true }];
    expect(excludeRemakes(input)).toEqual([]);
  });

  it("returns every match when none are remakes", () => {
    const input = [{ remake: false }, { remake: false }];
    expect(excludeRemakes(input)).toEqual(input);
  });

  it("drops only the remake entries from a mixed set", () => {
    const a = { remake: false, id: "a" };
    const b = { remake: true, id: "b" };
    const c = { remake: false, id: "c" };
    expect(excludeRemakes([a, b, c])).toEqual([a, c]);
  });

  it("preserves subtype fields on retained matches", () => {
    type WithKda = { remake: boolean; kda: number };
    const matches: WithKda[] = [
      { remake: false, kda: 3.5 },
      { remake: true, kda: 0 },
    ];
    const kept = excludeRemakes(matches);
    expect(kept).toHaveLength(1);
    expect(kept[0]?.kda).toBe(3.5);
  });
});
