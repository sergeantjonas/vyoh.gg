import { mainScrollRef } from "@/lib/scroll-container";
import {
  type AnimationPlaybackControls,
  type MotionValue,
  animate,
  useMotionValue,
  useReducedMotion,
} from "motion/react";
import { type RefObject, useEffect } from "react";

/**
 * Time-based chapter reveal progress, triggered by the chapter element
 * intersecting the viewport. Returns a `MotionValue<number>` that:
 *
 *   - Stays at 0 until the chapter outer first intersects the viewport.
 *   - Animates 0 → 1 over `durationMs` once intersection fires.
 *   - Stays at 1 after the animation completes.
 *
 * Replaces the earlier scroll-coupled progress: tying band reveals to scroll
 * position created an "empty scrims" window where the chapter chrome had
 * faded in but the inner content was still gated on further scrolling. By
 * triggering a time-based animation on intersection, scrim and content land
 * on a single timeline — the user crosses the threshold once and the reveal
 * commits regardless of subsequent scroll behaviour.
 *
 * Reduced motion: progress jumps to 1 immediately (no animation). Missing
 * IntersectionObserver (older test envs): same fallback.
 */
const DEFAULT_DURATION_MS = 1600;
// Effective root = top 75% of viewport. Chapters render their bands near
// the top of the sticky child (with a small top-padding for breathing
// room), so the band stack's top edge enters the viewport once the
// chapter outer's top is at ~75–80vh — i.e., the chapter has only just
// started intersecting the viewport. -25% from the bottom triggers the
// reveal at roughly that moment: bands are about to appear, the splash is
// becoming dominant, and the animation runs as the bands rise into their
// pinned position. Looser margins fire too early (splash with no content
// for the rest of the approach); tighter margins fire too late (animation
// completes before the user can see it). Chapters whose bands aren't at
// the top of the pin should pass a custom rootMargin via options.
const DEFAULT_ROOT_MARGIN = "0px 0px -25% 0px";

export function useChapterRevealProgress(
  ref: RefObject<HTMLElement | null>,
  options?: { durationMs?: number; rootMargin?: string }
): MotionValue<number> {
  const progress = useMotionValue(0);
  const reduced = useReducedMotion();
  const durationMs = options?.durationMs ?? DEFAULT_DURATION_MS;
  const rootMargin = options?.rootMargin ?? DEFAULT_ROOT_MARGIN;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reduced) {
      progress.set(1);
      return;
    }
    if (typeof IntersectionObserver === "undefined") {
      // Degraded fallback (older test envs, very old browsers): show the
      // end-state immediately rather than leaving content invisible.
      progress.set(1);
      return;
    }

    let triggered = false;
    let controls: AnimationPlaybackControls | null = null;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && !triggered) {
            triggered = true;
            controls = animate(progress, 1, {
              duration: durationMs / 1000,
              ease: "easeOut",
            });
            observer.disconnect();
            break;
          }
        }
      },
      {
        root: mainScrollRef.current ?? null,
        rootMargin,
      }
    );

    observer.observe(el);

    return () => {
      observer.disconnect();
      controls?.stop();
    };
  }, [ref, progress, durationMs, rootMargin, reduced]);

  return progress;
}
