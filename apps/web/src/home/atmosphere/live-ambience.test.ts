import type { GradientLayer } from "@/home/ambient-hero";
import { describe, expect, it } from "vitest";
import {
  LIVE_INTENSITY_BOOST,
  LIVE_TINT_WEIGHT,
  applyLiveAmbience,
  lerpHue,
  oklchHueFromHex,
} from "./live-ambience";

describe("oklchHueFromHex", () => {
  it("lands warm champion reds in the red sector", () => {
    // Ahri's extracted dominant. sRGB would call this ~348°; oklch calls it
    // ~19°, and the substrate consumes oklch — the whole reason for this
    // conversion rather than a cheaper HSL one.
    expect(oklchHueFromHex("#c8233e")).toBeCloseTo(19.16, 1);
  });

  it("lands Steam's brand blue in the blue sector", () => {
    expect(oklchHueFromHex("#66c0f4")).toBeCloseTo(236.18, 1);
  });

  it("accepts shorthand hex and a missing leading hash", () => {
    expect(oklchHueFromHex("#0f0")).toBeCloseTo(oklchHueFromHex("#00ff00") ?? 0, 4);
    expect(oklchHueFromHex("c8233e")).toBeCloseTo(19.16, 1);
  });

  it("returns null for achromatic colours so a grey never rotates the page", () => {
    // championTheme's fallback is #888888 — an unrecognised champion must not
    // tilt the palette toward whatever hue rounding noise produces.
    expect(oklchHueFromHex("#888888")).toBeNull();
    expect(oklchHueFromHex("#ffffff")).toBeNull();
    expect(oklchHueFromHex("#000000")).toBeNull();
  });

  it("returns null for values that aren't hex colours", () => {
    expect(oklchHueFromHex("rebeccapurple")).toBeNull();
    expect(oklchHueFromHex("#12345")).toBeNull();
    expect(oklchHueFromHex("")).toBeNull();
  });
});

describe("lerpHue", () => {
  it("takes the short way across 0° rather than sweeping the long arc", () => {
    expect(lerpHue(350, 10, 0.5)).toBeCloseTo(0, 4);
    expect(lerpHue(10, 350, 0.5)).toBeCloseTo(0, 4);
  });

  it("interpolates proportionally within a sector", () => {
    expect(lerpHue(60, 200, 0.45)).toBeCloseTo(123, 4);
  });

  it("returns the endpoints at t=0 and t=1", () => {
    expect(lerpHue(60, 200, 0)).toBeCloseTo(60, 4);
    expect(lerpHue(60, 200, 1)).toBeCloseTo(200, 4);
  });

  it("normalises the result into 0..360", () => {
    const wrapped = lerpHue(10, 350, 1);
    expect(wrapped).toBeGreaterThanOrEqual(0);
    expect(wrapped).toBeLessThan(360);
    expect(wrapped).toBeCloseTo(350, 4);
  });
});

const layers: readonly GradientLayer[] = [
  { cx: 0.22, cy: 0.3, radius: 900, lch: [0.82, 0.15, 50], alpha: 0.36, phase: 0 },
  { cx: 0.68, cy: 0.26, radius: 1000, lch: [0.66, 0.12, 235], alpha: 0.22, phase: 1 },
];

describe("applyLiveAmbience", () => {
  const base = { layers, tintH: 235, intensity: 0.6 };

  it("returns the blend untouched when nothing is live", () => {
    expect(applyLiveAmbience(base, null)).toBe(base);
  });

  it("pulls the published tint hue toward the live subject", () => {
    const out = applyLiveAmbience(base, { kind: "lol", tintH: 19 });
    expect(out.tintH).toBeCloseTo(lerpHue(235, 19, LIVE_TINT_WEIGHT), 4);
    expect(out.tintH).not.toBeCloseTo(235, 1);
  });

  it("raises the blend intensity by the live boost", () => {
    const out = applyLiveAmbience(base, { kind: "steam", tintH: 236 });
    expect(out.intensity).toBeCloseTo(0.6 + LIVE_INTENSITY_BOOST, 4);
  });

  it("clamps intensity at 1 so an already-saturated band can't overshoot", () => {
    const out = applyLiveAmbience(
      { ...base, intensity: 0.95 },
      { kind: "lol", tintH: 19 }
    );
    expect(out.intensity).toBe(1);
  });

  it("keeps the palette's warm/cool split instead of collapsing onto one hue", () => {
    // Each layer rotates by the same fraction of *its own* arc, so dawn's warm
    // and cool radials stay distinguishable. Collapsing them would flatten the
    // wash into a single wall of colour.
    const out = applyLiveAmbience(base, { kind: "lol", tintH: 350 });
    const [warm, cool] = out.layers;
    expect(warm?.lch[2]).not.toBeCloseTo(cool?.lch[2] ?? 0, 0);
    expect(warm?.lch[2]).toBeCloseTo(lerpHue(50, 350, LIVE_TINT_WEIGHT), 4);
    expect(cool?.lch[2]).toBeCloseTo(lerpHue(235, 350, LIVE_TINT_WEIGHT), 4);
  });

  it("leaves lightness, chroma, and geometry alone", () => {
    const out = applyLiveAmbience(base, { kind: "lol", tintH: 19 });
    const [first] = out.layers;
    expect(first?.lch[0]).toBe(0.82);
    expect(first?.lch[1]).toBe(0.15);
    expect(first?.cx).toBe(0.22);
    expect(first?.radius).toBe(900);
    expect(first?.alpha).toBe(0.36);
  });
});
