import { MAX_COUNT } from "@/lol/matches/match-count-selector";
import { describe, expect, it } from "vitest";
import { validateAccountSearch } from "./account-search";

describe("validateAccountSearch", () => {
  it("returns an empty object when neither queue nor count is present", () => {
    expect(validateAccountSearch({})).toEqual({});
  });

  it("ignores non-numeric queue values", () => {
    expect(validateAccountSearch({ queue: "soloduo" })).toEqual({});
    expect(validateAccountSearch({ queue: null })).toEqual({});
  });

  it("passes through valid queue values", () => {
    expect(validateAccountSearch({ queue: 420 })).toEqual({ queue: 420 });
  });

  it("ignores non-positive count values", () => {
    expect(validateAccountSearch({ count: 0 })).toEqual({});
    expect(validateAccountSearch({ count: -5 })).toEqual({});
  });

  it("ignores non-numeric count values", () => {
    expect(validateAccountSearch({ count: "20" })).toEqual({});
  });

  it("passes through valid count values", () => {
    expect(validateAccountSearch({ count: 50 })).toEqual({ count: 50 });
  });

  it("clamps count to MAX_COUNT", () => {
    const out = validateAccountSearch({ count: MAX_COUNT + 100 });
    expect(out.count).toBe(MAX_COUNT);
  });

  it("preserves both queue and count when both are valid", () => {
    expect(validateAccountSearch({ queue: 420, count: 20 })).toEqual({
      queue: 420,
      count: 20,
    });
  });
});
