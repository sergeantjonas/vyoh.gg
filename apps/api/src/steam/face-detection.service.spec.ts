import { describe, expect, it } from "vitest";
import { isInEdgeGuard, unrotateCenter } from "./face-detection.service";

describe("unrotateCenter", () => {
  // The forward mapping (source → rotated, sharp's clockwise rotate) is
  // documented inline in face-detection.service.ts. These cases verify the
  // inverse: a point at the given rotated-image coords un-rotates back to
  // the matching source-image coords. Keeping the math in unit-square
  // normalized space sidesteps aspect-ratio concerns.

  it("passes a point through unchanged at 0°", () => {
    expect(unrotateCenter(0.3, 0.7, 0)).toEqual({ x: 0.3, y: 0.7 });
  });

  it("inverts 180° rotation (both axes flipped)", () => {
    // Stellar Blade case: the face detected at (44.6%, 22.7%) in the
    // 180°-rotated image corresponds to source (55.4%, 77.3%) — the face
    // is right-of-center and ~3/4 down the original source.
    const { x, y } = unrotateCenter(0.446, 0.227, 180);
    expect(x).toBeCloseTo(0.554, 3);
    expect(y).toBeCloseTo(0.773, 3);
  });

  it("inverts 90° clockwise rotation", () => {
    // A point at the right edge of the rotated image (x=0.9, y=0.5)
    // corresponds to the bottom-half of source (x=0.5, y=0.1).
    const { x, y } = unrotateCenter(0.9, 0.5, 90);
    expect(x).toBeCloseTo(0.5, 3);
    expect(y).toBeCloseTo(0.1, 3);
  });

  it("inverts 270° clockwise rotation", () => {
    const { x, y } = unrotateCenter(0.5, 0.9, 270);
    expect(x).toBeCloseTo(0.1, 3);
    expect(y).toBeCloseTo(0.5, 3);
  });

  it("round-trips a forward → inverse pass at 180°", () => {
    // Forward: source (0.554, 0.773) → rotated (1−0.554, 1−0.773) = (0.446, 0.227).
    // unrotateCenter inverts: rotated (0.446, 0.227) → source (0.554, 0.773).
    const rotated = { x: 1 - 0.554, y: 1 - 0.773 };
    const back = unrotateCenter(rotated.x, rotated.y, 180);
    expect(back.x).toBeCloseTo(0.554, 3);
    expect(back.y).toBeCloseTo(0.773, 3);
  });
});

describe("isInEdgeGuard", () => {
  // Edge-guard rejects positions in the outer 10% strip on any axis —
  // used only for non-0° rotations where edge-adjacent "faces" are
  // virtually always phantoms from rotated-frame edge artifacts.

  it("rejects the BFG-style phantom at source bottom (y > 90%)", () => {
    // DOOM 3 BFG's 180° detection un-rotates to source (58%, 92%); the
    // detector latched onto fire effects at the source bottom edge.
    expect(isInEdgeGuard({ x: 0.58, y: 0.92 })).toBe(true);
  });

  it("rejects positions near the top edge", () => {
    expect(isInEdgeGuard({ x: 0.5, y: 0.05 })).toBe(true);
  });

  it("rejects positions near the side edges", () => {
    expect(isInEdgeGuard({ x: 0.05, y: 0.5 })).toBe(true);
    expect(isInEdgeGuard({ x: 0.95, y: 0.5 })).toBe(true);
  });

  it("accepts Stellar Blade's 180° detection at source (55%, 77%)", () => {
    // EVE's face after un-rotation lands well inside the frame.
    expect(isInEdgeGuard({ x: 0.55, y: 0.77 })).toBe(false);
  });

  it("accepts centered detections", () => {
    expect(isInEdgeGuard({ x: 0.5, y: 0.5 })).toBe(false);
  });
});
