import type { AmbientPalette } from "@/home/ambient-hero";
import {
  type AtmosphereClaim,
  useAtmosphereClaim,
} from "@/home/atmosphere/use-atmosphere-claim";
import type { MotionValue } from "motion/react";
import { type RefObject, useMemo } from "react";

type Args = {
  /** Asset URL (champion splash, Steam library hero). */
  image: string;
  /**
   * Palette that drives the atmosphere blend behind the asset. Source from
   * the asset's dominant color when available (R-2 / R-3); fall back to the
   * current time-of-day palette so the chapter still has a coherent backdrop
   * before the color pipeline lands.
   */
  palette: AmbientPalette;
  /**
   * Blur radius (px). Default 0 — the asset reads sharp; per-band scrims
   * (dark `bg-background/55` cards with `backdrop-blur-sm`) handle copy-area
   * readability locally rather than blurring the whole image. Bump higher
   * only when copy directly overlaps unprotected art and a local scrim
   * isn't on the table.
   */
  blurPx?: number;
  /**
   * Optional MotionValue that adds to `blurPx` each scroll tick. Drives the
   * splash-rotation blur-bloom beat (R-2c) — the layer reads `.get()` in
   * its apply step so the bloom curve runs outside React's render cycle.
   */
  bloomBlurPx?: MotionValue<number>;
  /**
   * Optional asset dominant color (CSS color string). Published as `--accent`
   * on documentElement while this claim is dominant — drives the per-chapter
   * accent cascade (R-2d). Hero / conclusion regions leave it unset so the
   * static neutral token from index.css applies.
   */
  accentHex?: string;
  /** Intensity scalar, 0..1. Drives palette chroma and image alpha. */
  intensity?: number;
};

const DEFAULT_BLUR_PX = 0;
const DEFAULT_INTENSITY = 0.9;

/**
 * Recap-arc asset-claim wrapper around `useAtmosphereClaim`. Mirrors the
 * underlying claim shape but biases defaults toward "recognizable asset at
 * light blur" — the subject-chapter target after ADR-2's retirement.
 *
 * One claim per band ref. Multiple bands within the same chapter each claim
 * separately; the layer weights claims by viewport proximity and crossfades
 * between dominant claims as scroll progresses.
 */
export function useAssetClaim(
  ref: RefObject<HTMLElement | null>,
  {
    image,
    palette,
    blurPx = DEFAULT_BLUR_PX,
    bloomBlurPx,
    accentHex,
    intensity = DEFAULT_INTENSITY,
  }: Args
) {
  const claim = useMemo<AtmosphereClaim>(
    () => ({
      palette,
      image,
      blurPx,
      intensity,
      ...(bloomBlurPx !== undefined ? { bloomBlurPx } : {}),
      ...(accentHex !== undefined ? { accentHex } : {}),
    }),
    [palette, image, blurPx, intensity, bloomBlurPx, accentHex]
  );
  useAtmosphereClaim(ref, claim);
}
