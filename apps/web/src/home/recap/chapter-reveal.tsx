import { m, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import type { ReactNode } from "react";
import { useChapterProgressContext } from "./chapter-context";

type Props = {
  /**
   * Pin-window progress (0..1) at which the reveal starts. Element is hidden
   * (opacity 0, offset by `rise`) at and below `from`.
   */
  from: number;
  /**
   * Pin-window progress (0..1) at which the reveal completes. Element is at
   * its resting state (opacity 1, y 0) at and above `to`.
   */
  to: number;
  /**
   * Initial vertical offset in px — the reveal rises from `+rise` to 0 as
   * progress advances from `from` to `to`. Default 12 — gentle editorial
   * lift without parallax-y heaviness.
   */
  rise?: number;
  className?: string;
  children: ReactNode;
};

/**
 * Wraps content with a scroll-coupled fade + rise driven by the parent
 * chapter's pin-window progress. Reads `ChapterProgressContext`; falls back
 * to a frozen-at-1 progress (reveal end-state immediately) when used outside
 * a `ChapterContainer` — keeps one-off mounts and snapshot tests honest.
 *
 * Under `prefers-reduced-motion`, renders a plain div at the end-state — no
 * scroll-coupled animation. The chapter-pin itself collapses (per the
 * recap-arc ADR-4 reduced-motion contract), so the user scrolls past the
 * content with everything already visible.
 */
export function ChapterReveal({ from, to, rise = 12, className, children }: Props) {
  const ctx = useChapterProgressContext();
  // Stable fallback when no ChapterContainer is above us. `useMotionValue(1)`
  // makes the reveal end-state visible immediately; calling it here keeps the
  // hook order stable regardless of whether the context is present.
  const fallback = useMotionValue(1);
  const progress = ctx ?? fallback;
  const reduced = useReducedMotion();

  const opacity = useTransform(progress, [from, to], [0, 1], { clamp: true });
  const y = useTransform(progress, [from, to], [rise, 0], { clamp: true });

  if (reduced) {
    return <div className={className}>{children}</div>;
  }

  return (
    <m.div style={{ opacity, y }} className={className}>
      {children}
    </m.div>
  );
}
