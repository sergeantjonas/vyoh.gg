import { mainScrollRef } from "@/lib/scroll-container";
import { type MotionValue, useMotionValue } from "motion/react";
import { type RefObject, useEffect } from "react";

/**
 * Compute pin-window progress for a chapter's outer container.
 *
 * The Apple-style chapter shape is a tall outer container (≥ 1× viewport,
 * typically 1.5–2×) whose child uses `position: sticky; top: 0; height: 100dvh`.
 * Scrolling the outer container's top from the viewport top to the viewport
 * bottom takes the chapter through its full pin window — progress is the
 * fraction of that travel that has elapsed.
 *
 * progress = (-rectTop + containerTop) / (rectHeight - containerHeight)
 *
 * - 0 while the chapter is approaching the pin (rect top still below the
 *   scroll container's top edge).
 * - Ramps 0 → 1 across the pin window.
 * - 1 once the chapter has fully unpinned (rect bottom has crossed the
 *   container bottom edge).
 *
 * Clamped to [0, 1]. Returns 0 when the chapter is shorter than the container
 * (degenerate "no pin window" case — the formula's denominator would be
 * non-positive). Callers should ensure `rectHeight > containerHeight` to get
 * a meaningful progress signal.
 */
export function chapterProgressFromRects({
  rectTop,
  rectHeight,
  containerTop,
  containerHeight,
}: {
  rectTop: number;
  rectHeight: number;
  containerTop: number;
  containerHeight: number;
}): number {
  const travel = rectHeight - containerHeight;
  if (travel <= 0) return 0;
  const elapsed = containerTop - rectTop;
  const raw = elapsed / travel;
  if (raw <= 0) return 0;
  if (raw >= 1) return 1;
  return raw;
}

/**
 * Returns a `MotionValue<number>` (0..1) tracking scroll progress through the
 * referenced chapter's pin window. Updates each scroll tick via the same
 * manual-listener pattern as `AtmosphereLayer` so the value bypasses React's
 * render cycle.
 *
 * `mainScrollRef` is the actual scroll container on `/` (see
 * lib/scroll-container.ts). When the ref is unhydrated (early SSR, tests
 * without `<main>`), the hook falls back to `window` so it still mounts
 * cleanly and the progress reads as 0.
 */
export function useChapterProgress(
  ref: RefObject<HTMLElement | null>
): MotionValue<number> {
  const progress = useMotionValue(0);

  useEffect(() => {
    const apply = () => {
      const el = ref.current;
      if (!el) {
        progress.set(0);
        return;
      }
      const container = mainScrollRef.current;
      const containerRect = container?.getBoundingClientRect();
      const containerTop = containerRect?.top ?? 0;
      const containerHeight = container?.clientHeight ?? window.innerHeight;
      const rect = el.getBoundingClientRect();
      progress.set(
        chapterProgressFromRects({
          rectTop: rect.top,
          rectHeight: rect.height,
          containerTop,
          containerHeight,
        })
      );
    };
    apply();
    const container = mainScrollRef.current ?? window;
    container.addEventListener("scroll", apply, { passive: true });
    window.addEventListener("resize", apply, { passive: true });
    return () => {
      container.removeEventListener("scroll", apply);
      window.removeEventListener("resize", apply);
    };
  }, [ref, progress]);

  return progress;
}
