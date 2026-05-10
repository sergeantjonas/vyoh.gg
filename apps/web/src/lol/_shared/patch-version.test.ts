import { describe, expect, it } from "vitest";
import {
  comparePatches,
  findPatchBoundaries,
  groupByPatch,
  truncatePatch,
} from "./patch-version";

describe("truncatePatch", () => {
  it("translates Riot's season-based major to year-based (+10)", () => {
    expect(truncatePatch("16.9.772.8292")).toBe("26.9");
    expect(truncatePatch("14.20.586.5840")).toBe("24.20");
  });

  it("passes through a major that already looks year-shaped (>= 20)", () => {
    expect(truncatePatch("26.9.1.1")).toBe("26.9");
  });

  it("returns empty string for empty input", () => {
    expect(truncatePatch("")).toBe("");
  });

  it("returns empty string for malformed input", () => {
    expect(truncatePatch("notaversion")).toBe("");
  });
});

describe("comparePatches", () => {
  it("orders by major then minor numerically", () => {
    expect(comparePatches("26.20", "26.21")).toBeLessThan(0);
    expect(comparePatches("27.1", "26.24")).toBeGreaterThan(0);
    expect(comparePatches("26.20", "26.20")).toBe(0);
  });
});

describe("groupByPatch", () => {
  it("buckets items by truncated patch in chronological order", () => {
    const matches = [
      { id: 1, version: "16.8.1.1" },
      { id: 2, version: "16.9.5.5" },
      { id: 3, version: "16.8.999.0" },
      { id: 4, version: "16.9.1.1" },
    ];
    const buckets = groupByPatch(matches, (m) => m.version);
    expect(buckets.map((b) => b.patch)).toEqual(["26.8", "26.9"]);
    expect(buckets[0]?.items.map((m) => m.id)).toEqual([1, 3]);
    expect(buckets[1]?.items.map((m) => m.id)).toEqual([2, 4]);
  });

  it("drops items with empty gameVersion", () => {
    const matches = [
      { id: 1, version: "" },
      { id: 2, version: "16.9.1.1" },
    ];
    const buckets = groupByPatch(matches, (m) => m.version);
    expect(buckets).toHaveLength(1);
    expect(buckets[0]?.items.map((m) => m.id)).toEqual([2]);
  });
});

describe("findPatchBoundaries", () => {
  it("emits a boundary at each truncated-patch flip", () => {
    const items = [
      { v: "16.8.1.1", t: 100 },
      { v: "16.8.5.5", t: 200 },
      { v: "16.9.1.1", t: 300 },
      { v: "16.9.2.2", t: 400 },
      { v: "17.1.1.1", t: 500 },
    ];
    const boundaries = findPatchBoundaries(
      items,
      (i) => i.v,
      (i) => i.t
    );
    expect(boundaries).toHaveLength(2);
    expect(boundaries[0]).toMatchObject({
      ts: 250,
      gameIndex: 2.5,
      fromPatch: "26.8",
      toPatch: "26.9",
    });
    expect(boundaries[1]).toMatchObject({
      ts: 450,
      gameIndex: 4.5,
      fromPatch: "26.9",
      toPatch: "27.1",
    });
  });

  it("does not emit boundaries when patches match (build-only changes)", () => {
    const items = [
      { v: "16.9.1.1", t: 100 },
      { v: "16.9.999.0", t: 200 },
    ];
    expect(
      findPatchBoundaries(
        items,
        (i) => i.v,
        (i) => i.t
      )
    ).toHaveLength(0);
  });

  it("skips boundaries against rows with empty gameVersion", () => {
    const items = [
      { v: "16.8.1.1", t: 100 },
      { v: "", t: 200 },
      { v: "16.9.1.1", t: 300 },
    ];
    expect(
      findPatchBoundaries(
        items,
        (i) => i.v,
        (i) => i.t
      )
    ).toHaveLength(0);
  });
});
