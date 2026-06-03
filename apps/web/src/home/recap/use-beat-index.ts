import { useMotionValueEvent, useReducedMotion, useScroll } from "motion/react";
import { type RefObject, useState } from "react";

/**
 * Pure discretizer: maps a 0..1 scroll progress value into a beat index
 * 0..beatCount-1 using floor over the equal-width band per beat. Exported
 * for unit-testing without a real scroll container; the hook below uses it
 * internally.
 *
 * Hysteresis is deliberately absent in the initial landing — at realistic
 * scroll velocities floor discretisation doesn't flicker visibly, and the
 * per-beat crossfade smooths the visual transition. If scrubbing right at
 * a threshold surfaces flicker on real hardware, revisit and add a small
 * dead-zone here (the rest of the file doesn't have to change).
 */
export function discretizeBeat(progress: number, beatCount: number): number {
  if (beatCount <= 1) return 0;
  const clamped = Math.max(0, Math.min(0.9999, progress));
  return Math.min(beatCount - 1, Math.floor(clamped * beatCount));
}

/**
 * Subscribable hook: tracks scroll progress through the pin section
 * referenced by `ref` and returns the active beat index. Re-renders only
 * when the discrete index changes, not on every scroll frame.
 *
 * Under reduced motion this returns 0 — `<ChapterBeats>` flattens to a
 * vertical stack in that path, so the active index isn't load-bearing.
 *
 * R-10's trailer autoplay keys off this hook (via `useActiveBeat`) once
 * beat 4 becomes the active beat; pin-enter is too early because the title
 * is still being read.
 */
export function useBeatIndex(
  ref: RefObject<HTMLElement | null>,
  beatCount: number
): number {
  const reducedMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end end"],
  });
  const [active, setActive] = useState(0);

  useMotionValueEvent(scrollYProgress, "change", (progress) => {
    const next = discretizeBeat(progress, beatCount);
    setActive((prev) => (prev === next ? prev : next));
  });

  return reducedMotion ? 0 : active;
}
