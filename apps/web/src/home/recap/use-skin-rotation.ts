import { type MotionValue, useTransform } from "motion/react";
import { useEffect, useState } from "react";

/**
 * Splash-rotation driver for subject chapters. Given the chapter's pin-window
 * progress (0..1) and the curated skin count, returns:
 *
 *   - `activeIndex` — the index into the skin array currently on display.
 *     Changes only at integer breakpoints (`Math.floor(progress * N)`), so
 *     the chapter re-renders only at each transition — never per scroll tick.
 *   - `bloomBlurPx` — a `MotionValue<number>` peaking around each transition
 *     breakpoint. Drives the "ethereal blur moment" between concrete skin
 *     states (see self-portrait-recap-arc.md Subject chapter scroll-timeline,
 *     skin-rotation transition shape). 0 outside the bloom window, ramps up
 *     to `peakBlur` at the breakpoint, ramps back to 0 — symmetric triangle.
 *
 * Single-entry skin lists degrade to "no rotation": `activeIndex` stays at 0
 * and `bloomBlurPx` is always 0. The landing-config seed lands with one entry
 * (Base), so the rotation infrastructure is wired but visually inert until
 * the curated list grows.
 */
export const BLOOM_HALF_WINDOW = 0.05;
export const BLOOM_PEAK_PX = 28;

export function activeIndexAtProgress(progress: number, skinCount: number): number {
  if (skinCount <= 1) return 0;
  if (progress <= 0) return 0;
  if (progress >= 1) return skinCount - 1;
  return Math.min(skinCount - 1, Math.floor(progress * skinCount));
}

export function bloomBlurAtProgress(
  progress: number,
  skinCount: number,
  halfWindow: number = BLOOM_HALF_WINDOW,
  peakBlur: number = BLOOM_PEAK_PX
): number {
  if (skinCount <= 1) return 0;
  for (let i = 1; i < skinCount; i++) {
    const breakpoint = i / skinCount;
    const distance = Math.abs(progress - breakpoint);
    if (distance < halfWindow) {
      const t = 1 - distance / halfWindow;
      return t * peakBlur;
    }
  }
  return 0;
}

export type SkinRotationState = {
  activeIndex: number;
  bloomBlurPx: MotionValue<number>;
};

export function useSkinRotation(
  progress: MotionValue<number>,
  skinCount: number
): SkinRotationState {
  // The bloom MotionValue derives from progress directly — no React state
  // means no per-frame re-renders. The layer reads its `.get()` each tick.
  const bloomBlurPx = useTransform(progress, (p) => bloomBlurAtProgress(p, skinCount));

  const [activeIndex, setActiveIndex] = useState(() =>
    activeIndexAtProgress(progress.get(), skinCount)
  );

  useEffect(() => {
    // Resync once on mount + skin-count change in case the initial state
    // captured the wrong index (progress changed before the listener
    // attached, or skinCount changed mid-life).
    setActiveIndex((prev) => {
      const next = activeIndexAtProgress(progress.get(), skinCount);
      return prev === next ? prev : next;
    });
    const handle = (p: number) => {
      const next = activeIndexAtProgress(p, skinCount);
      setActiveIndex((prev) => (prev === next ? prev : next));
    };
    return progress.on("change", handle);
  }, [progress, skinCount]);

  return { activeIndex, bloomBlurPx };
}
