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
   * holds at the hidden initial state. When `true`, animates to the visible
   * end-state. Default `true` so the primitive plays on mount when no parent
   * gate is needed.
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
   * Initial horizontal offset in px — element slides from `slideX` to 0 px.
   * Signed: negative slides in from the left, positive from the right.
   * Reserve for beats where a directional entrance carries editorial
   * weight (a focal card landing from off-screen, list rows cascading from
   * a side); don't apply globally, otherwise everything looks like it's
   * being shuffled in from off-page.
   */
  slideX?: number;
  /**
   * Initial uniform scale — element scales from `scale` to 1. Typical
   * values 0.85–0.96 for a subtle pop; below 0.8 reads as bouncy. Pairs
   * well with `rise` for tiles/chips that should feel like they're
   * settling into place; less appropriate for body prose, which prefers
   * fade + rise.
   */
  scale?: number;
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
 * prop, with optional delay for cascading siblings, optional `slideX` for
 * directional entrances, optional `scale` for settle-in pop, and optional
 * `blur` for hero-tier curtain reveals. Subject chapters set `active` once
 * a chapter-level trigger fires (e.g. the scroll nudge in `AhriChapter` or
 * the per-beat nudge in stacked-beat chapters), and stagger band / item
 * reveals via the `delay` prop.
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
  slideX,
  scale,
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
  if (slideX !== undefined) {
    initial.x = slideX;
    visible.x = 0;
  }
  if (scale !== undefined) {
    initial.scale = scale;
    visible.scale = 1;
  }
  if (blur !== undefined) {
    initial.filter = `blur(${blur}px)`;
    visible.filter = "blur(0px)";
  }

  // Hint the compositor when any transform-heavy property is in play —
  // the directional/scale/blur combos all benefit from a promoted layer.
  // Motion clears `will-change` after the animation completes per the
  // recap arc's perf budget.
  const needsWillChange =
    slideX !== undefined || scale !== undefined || blur !== undefined;

  return (
    <m.div
      className={className}
      initial={initial}
      animate={active ? visible : initial}
      transition={transition}
      {...(needsWillChange
        ? {
            style: {
              willChange:
                blur !== undefined ? "transform, opacity, filter" : "transform, opacity",
            },
          }
        : {})}
    >
      {children}
    </m.div>
  );
}
