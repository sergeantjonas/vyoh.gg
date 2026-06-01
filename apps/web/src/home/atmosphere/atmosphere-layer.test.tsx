import { motionValue } from "motion/react";
import { describe, expect, it } from "vitest";
import { __testing } from "./atmosphere-layer";
import type { AtmosphereClaim } from "./use-atmosphere-claim";

const { proximityWeight, resolveAtmosphere } = __testing;

const palette: AtmosphereClaim["palette"] = {
  timeOfDay: "day",
  layers: [
    { cx: 0.5, cy: 0.5, radius: 800, lch: [0.7, 0.1, 200], alpha: 0.3, phase: 0 },
    { cx: 0.7, cy: 0.3, radius: 600, lch: [0.6, 0.12, 60], alpha: 0.2, phase: 1 },
  ],
};

describe("proximityWeight", () => {
  it("returns 0 for offscreen bands", () => {
    expect(proximityWeight(-0.1)).toBe(0);
    expect(proximityWeight(0)).toBe(0);
    expect(proximityWeight(1)).toBe(0);
    expect(proximityWeight(1.2)).toBe(0);
  });

  it("peaks at viewport center", () => {
    expect(proximityWeight(0.5)).toBe(1);
  });

  it("falls linearly toward the edges", () => {
    expect(proximityWeight(0.25)).toBeCloseTo(0.5, 5);
    expect(proximityWeight(0.75)).toBeCloseTo(0.5, 5);
  });
});

describe("resolveAtmosphere", () => {
  it("returns null when no claim carries weight", () => {
    expect(resolveAtmosphere([])).toBeNull();
    expect(
      resolveAtmosphere([{ claim: { palette, intensity: 0.5 }, weight: 0 }])
    ).toBeNull();
  });

  it("returns the single claim's atmosphere with full intensity", () => {
    const resolved = resolveAtmosphere([
      { claim: { palette, intensity: 0.8 }, weight: 1 },
    ]);
    expect(resolved).not.toBeNull();
    expect(resolved?.backgroundImage).toContain("radial-gradient");
    expect(resolved?.imageUrl).toBeNull();
    expect(resolved?.imageAlpha).toBe(0);
    expect(resolved?.intensity).toBeCloseTo(0.8, 5);
    // Tint hue comes from the *second* palette layer (the accent) so the orb
    // halo carries a complement of layer[0] and stays readable on the bg.
    expect(resolved?.tintH).toBe(60);
  });

  it("falls back to layer[0]'s hue when the palette has no accent layer", () => {
    const monoPalette: AtmosphereClaim["palette"] = {
      timeOfDay: "day",
      layers: [
        { cx: 0.5, cy: 0.5, radius: 800, lch: [0.7, 0.1, 200], alpha: 0.3, phase: 0 },
      ],
    };
    const resolved = resolveAtmosphere([
      { claim: { palette: monoPalette, intensity: 0.5 }, weight: 1 },
    ]);
    expect(resolved?.tintH).toBe(200);
  });

  it("blends intensity by weight while keeping the dominant claim's palette", () => {
    const altPalette: AtmosphereClaim["palette"] = {
      timeOfDay: "night",
      layers: [
        { cx: 0.4, cy: 0.4, radius: 600, lch: [0.4, 0.2, 280], alpha: 0.5, phase: 0 },
      ],
    };
    const resolved = resolveAtmosphere([
      { claim: { palette, intensity: 1 }, weight: 0.25 },
      { claim: { palette: altPalette, intensity: 0.2 }, weight: 0.75 },
    ]);
    expect(resolved).not.toBeNull();
    // Dominant weight is altPalette — its gradient string should appear.
    expect(resolved?.backgroundImage).toContain("600px");
    // Blended intensity = (1 * 0.25 + 0.2 * 0.75) / 1 = 0.4.
    // We can't introspect the intensity directly, but the gradient string
    // encodes the chroma — re-resolving with that intensity should match.
    const blended = resolveAtmosphere([
      { claim: { palette: altPalette, intensity: 0.4 }, weight: 1 },
    ]);
    expect(resolved?.backgroundImage).toBe(blended?.backgroundImage);
  });

  it("includes image-alpha proportional to dominant weight and intensity", () => {
    const resolved = resolveAtmosphere([
      {
        claim: { palette, intensity: 0.5, image: "https://example.test/blur.jpg" },
        weight: 0.4,
      },
    ]);
    expect(resolved?.imageUrl).toBe("https://example.test/blur.jpg");
    expect(resolved?.imageAlpha).toBeCloseTo(0.4 * 0.5, 5);
  });

  it("defaults to heavy blur when claim omits blurPx", () => {
    const resolved = resolveAtmosphere([
      {
        claim: { palette, intensity: 0.5, image: "https://example.test/x.jpg" },
        weight: 1,
      },
    ]);
    // Default preserves the substrate's original ambient look — anything below
    // ~32px starts to leak recognizable detail through the image layer.
    expect(resolved?.imageBlurPx).toBe(80);
  });

  it("carries per-claim blur from the dominant claim through to the resolved atmosphere", () => {
    const resolved = resolveAtmosphere([
      {
        claim: {
          palette,
          intensity: 0.8,
          image: "https://example.test/splash.jpg",
          blurPx: 4,
        },
        weight: 1,
      },
    ]);
    expect(resolved?.imageBlurPx).toBe(4);
  });

  it("adds the bloom MotionValue to the base blur each tick", () => {
    const bloom = motionValue(0);
    const claim: AtmosphereClaim = {
      palette,
      intensity: 0.8,
      image: "https://example.test/splash.jpg",
      blurPx: 4,
      bloomBlurPx: bloom,
    };
    expect(resolveAtmosphere([{ claim, weight: 1 }])?.imageBlurPx).toBe(4);
    bloom.set(28);
    // Subsequent resolves read the current MV value — drives the bloom curve
    // without re-rendering the layer.
    expect(resolveAtmosphere([{ claim, weight: 1 }])?.imageBlurPx).toBe(32);
    bloom.set(0);
    expect(resolveAtmosphere([{ claim, weight: 1 }])?.imageBlurPx).toBe(4);
  });
});
