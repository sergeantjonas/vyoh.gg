import { type Transition, m, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

type Props = {
  className?: string;
  children: ReactNode;
  /**
   * Controls whether the reveal animation plays. When `false`, the element
   * holds at the hidden initial state (opacity 0, offset by `rise`). When
   * `true`, animates to the visible end-state. Default `true` so the
   * primitive plays on mount when no parent gate is needed.
   *
   * Subject chapters typically thread a single `nudged` state through here
   * so band reveals wait until the user has actually been scrolled into
   * pin position, rather than triggering during the approach scroll.
   */
  active?: boolean;
  /**
   * Seconds to wait after `active` flips to `true` before this element's
   * reveal animation starts. Use to cascade reveals (opener at 0, detail at
   * 0.4, stats at 0.8, closer at 1.2; within a band, eyebrow at 0, title at
   * 0.15, metric at 0.3).
   */
  delay?: number;
  /** Reveal animation duration in seconds. */
  duration?: number;
  /** Initial vertical offset in px — element rises from `rise` to 0 px. */
  rise?: number;
};

/**
 * Per-element reveal primitive. Animates fade + rise on a controlled `active`
 * prop, with optional delay for cascading siblings. Subject chapters set
 * `active` once a chapter-level trigger fires (e.g. the scroll nudge in
 * `AhriChapter`), and stagger band / item reveals via the `delay` prop.
 *
 * Reduced motion: renders a plain div at the end-state. The chapter pin
 * collapses (per ADR-4), so content scrolls through naturally.
 */
export function ChapterReveal({
  className,
  children,
  active = true,
  delay = 0,
  duration = 0.6,
  rise = 12,
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
      animate={active ? { opacity: 1, y: 0 } : { opacity: 0, y: rise }}
      transition={transition}
    >
      {children}
    </m.div>
  );
}
