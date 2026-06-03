import { describe, expect, it } from "vitest";

import { discretizeBeat } from "./use-beat-index";

describe("discretizeBeat", () => {
  it("returns 0 for any progress when beatCount is 1", () => {
    expect(discretizeBeat(0, 1)).toBe(0);
    expect(discretizeBeat(0.5, 1)).toBe(0);
    expect(discretizeBeat(1, 1)).toBe(0);
  });

  it("returns 0 when beatCount is 0 or negative (defensive)", () => {
    expect(discretizeBeat(0.5, 0)).toBe(0);
    expect(discretizeBeat(0.5, -1)).toBe(0);
  });

  it("partitions [0,1) into beatCount equal bands", () => {
    expect(discretizeBeat(0, 4)).toBe(0);
    expect(discretizeBeat(0.24, 4)).toBe(0);
    expect(discretizeBeat(0.25, 4)).toBe(1);
    expect(discretizeBeat(0.49, 4)).toBe(1);
    expect(discretizeBeat(0.5, 4)).toBe(2);
    expect(discretizeBeat(0.749, 4)).toBe(2);
    expect(discretizeBeat(0.75, 4)).toBe(3);
    expect(discretizeBeat(0.99, 4)).toBe(3);
  });

  it("clamps progress 1 (and above) to the last beat", () => {
    expect(discretizeBeat(1, 4)).toBe(3);
    expect(discretizeBeat(1.5, 4)).toBe(3);
    expect(discretizeBeat(99, 4)).toBe(3);
  });

  it("clamps negative progress to beat 0", () => {
    expect(discretizeBeat(-0.1, 4)).toBe(0);
    expect(discretizeBeat(-10, 4)).toBe(0);
  });

  it("works for arbitrary beat counts", () => {
    expect(discretizeBeat(0.5, 2)).toBe(1);
    expect(discretizeBeat(0.33, 3)).toBe(0);
    expect(discretizeBeat(0.34, 3)).toBe(1);
    expect(discretizeBeat(0.67, 3)).toBe(2);
  });
});
