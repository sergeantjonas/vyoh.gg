import { type Transition, m, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

type Props = {
  className?: string;
  children: ReactNode;
  /**
   * Seconds to wait after the element enters the viewport before the reveal
   * animation starts. Use to stagger reveals inside a single band (eyebrow
   * 0 → title 0.15 → metric 0.3) without spanning the trigger across
   * multiple band positions.
   */
  delay?: number;
  /** Reveal animation duration in seconds. */
  duration?: number;
  /** Initial vertical offset in px — element rises from `rise` to 0 px. */
  rise?: number;
  /**
   * Fraction of the element's area that must be in view before the reveal
   * triggers. Default 0.3 — fires when ~30% of the element is visible.
   * Lower values fire earlier (more "on entry"); higher values delay until
   * the element is more substantially in view.
   */
  amount?: number;
  /**
   * Fired once when the element first crosses the visibility threshold.
   * Use for side effects coordinated with the reveal trigger (e.g. opening
   * the splash claim alongside the opener band's reveal).
   */
  onViewportEnter?: () => void;
};

/**
 * Per-band reveal primitive. Animates fade + rise once the element first
 * crosses the viewport visibility threshold. Each `ChapterReveal` fires its
 * own IntersectionObserver via motion's `whileInView`, so reveals only run
 * when the wrapped element is actually visible — no coordinated progress
 * MV, no off-screen reveals.
 *
 * Reduced motion: renders a plain div at the end-state. The chapter pin
 * collapses (per ADR-4), so content scrolls through naturally with all
 * elements visible from the start.
 */
export function ChapterReveal({
  className,
  children,
  delay = 0,
  duration = 0.6,
  rise = 12,
  amount = 0.3,
  onViewportEnter,
}: Props) {
  const reduced = useReducedMotion();

  if (reduced) {
    return <div className={className}>{children}</div>;
  }

  const transition: Transition = { duration, ease: "easeOut", delay };

  return (
    <m.div
      className={className}
      initial={{ opacity: 0, y: rise }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount }}
      transition={transition}
      {...(onViewportEnter ? { onViewportEnter } : {})}
    >
      {children}
    </m.div>
  );
}
