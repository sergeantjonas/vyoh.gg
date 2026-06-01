import {
  type MotionValue,
  animate,
  useMotionValue,
  useReducedMotion,
} from "motion/react";
import { useEffect, useState } from "react";

/**
 * Auto-cycling splash rotation for subject chapters. Each entry holds for
 * `HOLD_MS`, then a soft blur-bloom crossfade swaps in the next skin —
 * timer-driven, not scroll-coupled. Earlier the rotation rode pin progress
 * directly, which meant fast scrolls cascaded through several skin swaps
 * in quick succession (jarring). Time-based cycling stays passive: the
 * background reads as ambient, the user's scroll position drives the
 * reveal animations and nothing else.
 *
 *   - `activeIndex` — the index currently on display, updated at the
 *     midpoint of each crossfade (when the bloom peaks and the image is
 *     temporarily unrecognizable). Cycles modulo `skinCount`.
 *   - `bloomBlurPx` — a `MotionValue<number>` that animates 0 → peak → 0
 *     across each transition. The atmosphere layer reads `.get()` each
 *     tick outside React's render cycle.
 *
 * Single-entry skin lists degrade to "no rotation": `activeIndex` stays at
 * 0 and `bloomBlurPx` is always 0. Under `prefers-reduced-motion` the
 * rotation pauses entirely on the first entry — no cycling, no bloom.
 */
export const HOLD_MS = 4500;
export const FADE_HALF_MS = 400;
// Subtle "ethereal blur moment" between concrete skin states — at 10px the
// transition reads as a soft pulse, not a "the splash broke" moment. Heavier
// peaks (28+) feel like glitches when observed at the cadence the auto-cycle
// runs at. Tune up only if the transition feels too hard.
export const BLOOM_PEAK_PX = 10;

export type SkinRotationState = {
  activeIndex: number;
  bloomBlurPx: MotionValue<number>;
};

export function useSkinRotation(skinCount: number): SkinRotationState {
  const bloomBlurPx = useMotionValue(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (skinCount <= 1 || reduced) return;

    let stopped = false;
    let pendingTimer: ReturnType<typeof setTimeout> | null = null;
    let bloomAnim: { stop: () => void } | null = null;

    function cycle() {
      if (stopped) return;
      // Phase 1: blur ramps 0 → peak over FADE_HALF_MS.
      bloomAnim = animate(bloomBlurPx, BLOOM_PEAK_PX, {
        duration: FADE_HALF_MS / 1000,
        ease: "easeInOut",
      });
      pendingTimer = setTimeout(() => {
        if (stopped) return;
        // Swap image at peak — neither splash is recognizable at this moment
        // (per the recap arc's "ethereal blur" transition shape).
        setActiveIndex((prev) => (prev + 1) % skinCount);
        // Phase 2: blur ramps peak → 0 over FADE_HALF_MS, new splash resolves.
        bloomAnim = animate(bloomBlurPx, 0, {
          duration: FADE_HALF_MS / 1000,
          ease: "easeInOut",
        });
        pendingTimer = setTimeout(() => {
          if (stopped) return;
          cycle();
        }, HOLD_MS);
      }, FADE_HALF_MS);
    }

    // Initial hold before the first transition lets the opening splash
    // settle for a beat.
    pendingTimer = setTimeout(cycle, HOLD_MS);

    return () => {
      stopped = true;
      if (pendingTimer) clearTimeout(pendingTimer);
      bloomAnim?.stop();
      bloomBlurPx.set(0);
    };
  }, [skinCount, reduced, bloomBlurPx]);

  return { activeIndex, bloomBlurPx };
}
