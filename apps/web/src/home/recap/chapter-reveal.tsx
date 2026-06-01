import { type Transition, m, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

// Same ease the landing hero uses for its editorial entrance reveal — keeps
// the chapter's "hero" tier (masthead + lede) on the same motion language
// as the page that immediately precedes it.
const HERO_EASE = [0.16, 1, 0.3, 1] as const;

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
  /**
   * Optional blur radius in px for the entrance. When set, the element
   * animates from `filter: blur({blur}px)` to `filter: blur(0)` alongside
   * the standard fade+rise. Matches the landing hero's editorial reveal
   * pattern (`sectionChildVariants` in `components/ui/section-variants.ts`).
   * Reserve for "hero-tier" reveals — chapter masthead, lede paragraph —
   * not every band, otherwise it loses its weight.
   */
  blur?: number;
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
  blur,
}: Props) {
  const reduced = useReducedMotion();

  if (reduced) {
    return <div className={className}>{children}</div>;
  }

  // Hero-tier reveals (with blur) get the editorial cubic-bezier the
  // landing hero uses; the lighter fade+rise sticks with easeOut.
  const transition: Transition = {
    duration,
    ease: blur !== undefined ? HERO_EASE : "easeOut",
    delay,
  };

  const initial: Record<string, string | number> = { opacity: 0, y: rise };
  const visible: Record<string, string | number> = { opacity: 1, y: 0 };
  if (blur !== undefined) {
    initial.filter = `blur(${blur}px)`;
    visible.filter = "blur(0px)";
  }

  return (
    <m.div
      className={className}
      initial={initial}
      animate={active ? visible : initial}
      transition={transition}
      // Hint the compositor for the blur+transform combo. Motion clears
      // `will-change` after the animation completes per the recap arc's
      // perf budget.
      {...(blur !== undefined
        ? { style: { willChange: "transform, opacity, filter" } }
        : {})}
    >
      {children}
    </m.div>
  );
}
