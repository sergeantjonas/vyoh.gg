import { useReducedMotion } from "motion/react";
import { type RefObject, useEffect, useState } from "react";

import { mainScrollRef } from "@/lib/scroll-container";

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
 * Implementation: manual scroll listener on `<main>` (the actual scroll
 * container) rather than `useScroll({ container: mainScrollRef })`, for
 * the same reason atmosphere-layer.tsx goes manual — motion's `useScroll`
 * throws when the container ref isn't hydrated yet (early SSR / tests
 * without a `<main>` mount). Manual gives a clean fallback to `window`
 * and lets the hook mount cleanly in those cases.
 *
 * Progress is measured against the section's pin window: 0 when the
 * section top hits the viewport top (pin just engaged), 1 when the
 * section bottom hits the viewport bottom (pin about to release).
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
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (beatCount <= 1) {
      setActive(0);
      return;
    }
    const el = ref.current;
    if (!el) return;
    const container: HTMLElement | Window = mainScrollRef.current ?? window;

    const compute = () => {
      const rect = el.getBoundingClientRect();
      const viewportH = window.innerHeight;
      const distance = rect.height - viewportH;
      if (distance <= 0) {
        // Section fits in one viewport — pin scrub doesn't apply; hold at 0.
        setActive((prev) => (prev === 0 ? prev : 0));
        return;
      }
      // `rect.top` starts at 0 when the pin engages, decreases to
      // -distance as the section scrolls through. Normalize to 0..1.
      const scrolled = -rect.top;
      const progress = Math.max(0, Math.min(1, scrolled / distance));
      const next = discretizeBeat(progress, beatCount);
      setActive((prev) => (prev === next ? prev : next));
    };

    compute();
    const onScroll = () => compute();
    const onResize = () => compute();
    container.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize, { passive: true });
    return () => {
      container.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
    };
  }, [ref, beatCount]);

  return reducedMotion ? 0 : active;
}
