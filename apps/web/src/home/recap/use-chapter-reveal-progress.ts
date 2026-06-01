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
// Effective root = top 10% of viewport (~10vh). The chapter's bands are
// centered inside its 100vh sticky child via `items-center justify-center`,
// so during pre-pin scroll the band center sits at `chapter.top + 50vh` —
// they only enter the visible viewport once `chapter.top < ~50vh` and reach
// near-center at `chapter.top < ~10vh`. With a looser margin (-50%) the IO
// fired while the bands were still below the fold, so the first half of
// the 1.6s reveal animation played off-screen. -90% defers the trigger
// until the bands are in view (chapter is right at pin entry), so the
// animation plays in the stable pin window with bands at viewport center.
const DEFAULT_ROOT_MARGIN = "0px 0px -90% 0px";

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
