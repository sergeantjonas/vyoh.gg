import { useReducedMotion } from "motion/react";
import { type ReactNode, useRef } from "react";

import { useChapterNudge } from "./use-chapter-nudge";

/** Render-prop child: receives this beat's own nudge state. */
export type BeatRenderProp = (nudged: boolean) => ReactNode;

type Props = {
  /** Beat index within its `<ChapterGroup>` (0-based). Surfaces as `data-beat`. */
  index: number;
  /** Optional slug for selector targeting / debugging. */
  slug?: string;
  /** Optional ARIA label for the section. */
  ariaLabel?: string;
  /** Layout className applied alongside the beat's structural classes. */
  className?: string;
  /**
   * Either static JSX or a function child receiving the beat's nudge state.
   * The render-prop form is the common case for editorial beats — it lets
   * the chapter author thread `nudged` straight into `<ChapterReveal>` gates
   * without lifting state or wrapping each beat in its own component.
   */
  children: ReactNode | BeatRenderProp;
};

/**
 * One beat in a stacked-beat chapter (R-13 final architecture). A viewport-
 * tall `<section>` with `scroll-snap-align:start; scroll-snap-stop:always`,
 * so each beat is a settled snap unit — wheel-scrolling and PageDown both
 * advance by exactly one beat, with no asymmetry between the first and
 * last beats (the pin-based model had a release tail at the bottom).
 *
 * Each beat owns its own `useChapterNudge` keyed on its own visibility, so
 * reveal cascades fire when *this beat* becomes visible rather than when
 * the whole chapter is engaged. The nudge flows to children via render-
 * prop child — common case is `{(nudged) => <ChapterReveal active={nudged}
 * .../>...}`.
 *
 * Under reduced motion: snap behavior is preserved (it's navigation, not
 * animation), but the fixed `h-dvh` is dropped so content flows naturally
 * and the user can scroll without forced viewport-sized pages.
 */
export function ChapterBeat({ index, slug, ariaLabel, className, children }: Props) {
  const ref = useRef<HTMLElement | null>(null);
  const reducedMotion = useReducedMotion();
  const nudged = useChapterNudge(ref);

  const baseClass = reducedMotion
    ? "relative w-full"
    : "relative h-dvh w-full overflow-hidden [scroll-snap-align:start] [scroll-snap-stop:always]";
  const finalClass = [baseClass, className].filter(Boolean).join(" ");

  const body = typeof children === "function" ? children(nudged) : children;

  return (
    <section
      ref={ref}
      data-beat={index}
      data-beat-slug={slug}
      aria-label={ariaLabel}
      className={finalClass}
    >
      {body}
    </section>
  );
}
