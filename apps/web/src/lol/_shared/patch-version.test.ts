import { describe, expect, it } from "vitest";
import {
  comparePatches,
  findPatchBoundaries,
  groupByPatch,
  truncatePatch,
} from "./patch-version";

describe("truncatePatch", () => {
  it("keeps the first two segments", () => {
    expect(truncatePatch("14.20.586.5840")).toBe("14.20");
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
    expect(comparePatches("14.20", "14.21")).toBeLessThan(0);
    expect(comparePatches("15.1", "14.24")).toBeGreaterThan(0);
    expect(comparePatches("14.20", "14.20")).toBe(0);
  });
});

describe("groupByPatch", () => {
  it("buckets items by truncated patch in chronological order", () => {
    const matches = [
      { id: 1, version: "14.20.1.1" },
      { id: 2, version: "14.21.5.5" },
      { id: 3, version: "14.20.999.0" },
      { id: 4, version: "14.21.1.1" },
    ];
    const buckets = groupByPatch(matches, (m) => m.version);
    expect(buckets.map((b) => b.patch)).toEqual(["14.20", "14.21"]);
    expect(buckets[0]?.items.map((m) => m.id)).toEqual([1, 3]);
    expect(buckets[1]?.items.map((m) => m.id)).toEqual([2, 4]);
  });

  it("drops items with empty gameVersion", () => {
    const matches = [
      { id: 1, version: "" },
      { id: 2, version: "14.20.1.1" },
    ];
    const buckets = groupByPatch(matches, (m) => m.version);
    expect(buckets).toHaveLength(1);
    expect(buckets[0]?.items.map((m) => m.id)).toEqual([2]);
  });
});

describe("findPatchBoundaries", () => {
  it("emits a boundary at each truncated-patch flip", () => {
    const items = [
      { v: "14.20.1.1", t: 100 },
      { v: "14.20.5.5", t: 200 },
      { v: "14.21.1.1", t: 300 },
      { v: "14.21.2.2", t: 400 },
      { v: "14.22.1.1", t: 500 },
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
      fromPatch: "14.20",
      toPatch: "14.21",
    });
    expect(boundaries[1]).toMatchObject({
      ts: 450,
      gameIndex: 4.5,
      fromPatch: "14.21",
      toPatch: "14.22",
    });
  });

  it("does not emit boundaries when patches match (build-only changes)", () => {
    const items = [
      { v: "14.20.1.1", t: 100 },
      { v: "14.20.999.0", t: 200 },
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
      { v: "14.20.1.1", t: 100 },
      { v: "", t: 200 },
      { v: "14.21.1.1", t: 300 },
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
