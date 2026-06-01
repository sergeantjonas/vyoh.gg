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
   * Blur radius (px). Light blur (~4–8) lands recognizable assets; heavier
   * (~16–32) edges back toward atmospheric. Defaults to 6 — the recap arc's
   * "recognizable but masked" target for subject chapters.
   */
  blurPx?: number;
  /**
   * Optional MotionValue that adds to `blurPx` each scroll tick. Drives the
   * splash-rotation blur-bloom beat (R-2c) — the layer reads `.get()` in
   * its apply step so the bloom curve runs outside React's render cycle.
   */
  bloomBlurPx?: MotionValue<number>;
  /** Intensity scalar, 0..1. Drives palette chroma and image alpha. */
  intensity?: number;
};

const DEFAULT_BLUR_PX = 6;
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
    }),
    [palette, image, blurPx, intensity, bloomBlurPx]
  );
  useAtmosphereClaim(ref, claim);
}
