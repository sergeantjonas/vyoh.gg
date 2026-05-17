import { describe, expect, it } from "vitest";
import { normalizeChampions } from "./patch.controller";

describe("normalizeChampions", () => {
  it("returns an empty list when the query param is missing", () => {
    expect(normalizeChampions(undefined)).toEqual([]);
  });

  it("wraps a single string into a one-element list and trims whitespace", () => {
    expect(normalizeChampions("  Ahri  ")).toEqual(["Ahri"]);
  });

  it("dedupes repeated names while preserving first-seen order", () => {
    expect(normalizeChampions(["Ahri", "Yasuo", "Ahri", "Lee Sin"])).toEqual([
      "Ahri",
      "Yasuo",
      "Lee Sin",
    ]);
  });

  it("caps the list at 20 entries", () => {
    const many = Array.from({ length: 30 }, (_, i) => `Champion${i}`);
    expect(normalizeChampions(many)).toHaveLength(20);
  });

  it("drops empty strings without consuming a slot", () => {
    expect(normalizeChampions(["Ahri", "", "  ", "Yasuo"])).toEqual(["Ahri", "Yasuo"]);
  });
});
