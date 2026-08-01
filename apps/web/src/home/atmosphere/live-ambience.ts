import type { GradientLayer } from "@/home/ambient-hero";

/**
 * The subject the owner is playing right now, reduced to the one thing the
 * atmosphere substrate can act on: a hue.
 *
 * `kind` is not read by the blend — it's carried so a resolved value is
 * self-describing in tests and devtools, and so a future consumer can tell a
 * League tint from a Steam one without re-deriving it.
 */
export type LiveAmbience = {
  kind: "lol" | "steam";
  /** oklch H in degrees, 0..360. */
  tintH: number;
};

/**
 * How far the live subject pulls each palette hue, as a fraction of the arc
 * between the palette's hue and the subject's. 0.45 leaves the time-of-day
 * palette recognisable underneath while reading as clearly tinted — a dusk
 * page during an Ahri game lands warm-pink rather than either pure dusk or
 * pure Ahri.
 */
export const LIVE_TINT_WEIGHT = 0.45;

/**
 * Added to the resolved blend intensity while live. Raises both the gradient
 * chroma (via `intensityToChromaMultiplier`) and the orb halo's alpha, so
 * "someone is playing right now" reads as the page being a little more awake.
 */
export const LIVE_INTENSITY_BOOST = 0.15;

// Below this oklch chroma a colour carries no meaningful hue — `atan2` on a
// near-grey returns whatever the rounding noise says. `championTheme`'s
// `#888888` fallback is exactly this case, so without the guard an
// unrecognised champion would rotate the whole page toward an arbitrary hue.
const MIN_MEANINGFUL_CHROMA = 0.01;

const HEX_PATTERN = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

function srgbToLinear(channel: number): number {
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

/**
 * sRGB hex → oklch hue in degrees, or `null` when the colour is achromatic or
 * the string isn't a hex colour.
 *
 * The substrate speaks oklch end to end — `GradientLayer.lch` is oklch, and
 * `--atmosphere-tint-h` is consumed as `oklch(L C var(--atmosphere-tint-h))`
 * in motion.css. A subject's dominant hex therefore has to arrive in the same
 * space; converting through HSL instead would rotate toward a visibly
 * different colour (sRGB hue and oklch hue disagree most in exactly the
 * blues and purples this palette lives in).
 */
export function oklchHueFromHex(hex: string): number | null {
  const match = HEX_PATTERN.exec(hex.trim());
  const digits = match?.[1];
  if (!digits) return null;
  const full =
    digits.length === 3
      ? digits.replace(/./g, (character) => character + character)
      : digits;
  const int = Number.parseInt(full, 16);
  const r = srgbToLinear(((int >> 16) & 0xff) / 255);
  const g = srgbToLinear(((int >> 8) & 0xff) / 255);
  const b = srgbToLinear((int & 0xff) / 255);

  // Björn Ottosson's oklab matrices (linear sRGB → LMS → cone-root → Lab).
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const labA = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const labB = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;

  if (Math.hypot(labA, labB) < MIN_MEANINGFUL_CHROMA) return null;
  return ((Math.atan2(labB, labA) * 180) / Math.PI + 360) % 360;
}

/**
 * Interpolate between two hues along the shorter arc of the colour wheel, so
 * 350° → 10° passes through 0 rather than sweeping back through 180.
 */
export function lerpHue(from: number, to: number, t: number): number {
  const delta = (((to - from + 540) % 360) - 180) * t;
  return (((from + delta) % 360) + 360) % 360;
}

type Blend = {
  layers: readonly GradientLayer[];
  tintH: number;
  intensity: number;
};

/**
 * Tilt a resolved atmosphere blend toward the subject the owner is currently
 * playing. Returns `base` untouched when nothing is live.
 *
 * Every gradient layer rotates by the same *fraction* of its own arc rather
 * than snapping to a shared hue, which is what keeps the palette's internal
 * contrast intact: dawn's warm layer[0] and cool layer[1] both lean toward the
 * subject while staying warm-and-cool relative to each other. Collapsing them
 * onto one hue would flatten the wash into a single wall of colour.
 *
 * No new compositor layers and no extra paint surface — this only changes the
 * gradient string and the two custom properties the existing layer already
 * writes each tick.
 */
export function applyLiveAmbience(base: Blend, live: LiveAmbience | null): Blend {
  if (!live) return base;
  return {
    layers: base.layers.map((layer) => ({
      ...layer,
      lch: [
        layer.lch[0],
        layer.lch[1],
        lerpHue(layer.lch[2], live.tintH, LIVE_TINT_WEIGHT),
      ] as const,
    })),
    tintH: lerpHue(base.tintH, live.tintH, LIVE_TINT_WEIGHT),
    intensity: Math.min(1, base.intensity + LIVE_INTENSITY_BOOST),
  };
}
