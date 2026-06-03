import { m, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import { type ReactNode, useEffect, useRef } from "react";

import { mainScrollRef } from "@/lib/scroll-container";

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
  /** Layout className applied to the inner content wrapper. */
  className?: string;
  /**
   * Either static JSX or a function child receiving the beat's nudge state.
   * The render-prop form is the common case for editorial beats — it lets
   * the chapter author thread `nudged` straight into `<ChapterReveal>` gates
   * without lifting state or wrapping each beat in its own component.
   */
  children: ReactNode | BeatRenderProp;
};

// Blur radius the inner content reaches at full exit (progress = 1). The
// exit is a focus shift, not a position shift — content stays put in the
// flow and goes optically out of focus as the reader scrolls past. An
// upward translate was tried first but read as "the scroll just got
// faster"; defocus + fade reads as a genuine editorial exit gesture
// distinct from the natural scroll-up of the section itself.
const EXIT_BLUR_PX = 10;

// Opacity hits 0 well before the natural scroll-off completes — content is
// visually gone by ~55% through the exit, so the next beat snaps into a
// clean slate instead of crowding the outgoing beat. Blur saturates a touch
// later so the defocus arc reads through the full fade rather than ending
// abruptly when opacity zeroes out.
const EXIT_FADE_END = 0.55;
const EXIT_BLUR_END = 0.7;

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
 * The beat's inner content layer is wrapped in an `m.div` whose `y` and
 * `opacity` are bound to the beat's scroll progress out of view. As the
 * reader scrolls past, content accelerates upward and fades to 0 — turning
 * the transition from "old beat scrolls up, new beat scrolls up underneath
 * it" into "old beat slides up and away, new beat enters the empty space".
 * Uses a manual scroll listener driving a MotionValue rather than
 * motion/react's `useScroll`, since `useScroll({ container: mainScrollRef })`
 * throws when the container ref isn't hydrated (SSR / tests without `<main>`).
 * Same pattern as `atmosphere-layer.tsx`.
 *
 * Under reduced motion: snap behavior is preserved (it's navigation, not
 * animation), but the fixed `h-dvh` is dropped and the exit transform is
 * skipped — content flows naturally and the user can scroll without forced
 * viewport-sized pages.
 */
export function ChapterBeat({ index, slug, ariaLabel, className, children }: Props) {
  const ref = useRef<HTMLElement | null>(null);
  const reducedMotion = useReducedMotion();
  const nudged = useChapterNudge(ref);

  const exitProgress = useMotionValue(0);
  const exitOpacity = useTransform(exitProgress, [0, EXIT_FADE_END], [1, 0]);
  const exitBlur = useTransform(
    exitProgress,
    [0, EXIT_BLUR_END],
    ["blur(0px)", `blur(${EXIT_BLUR_PX}px)`]
  );

  useEffect(() => {
    if (reducedMotion) return;
    const el = ref.current;
    if (!el) return;
    const container: HTMLElement | Window = mainScrollRef.current ?? window;
    const compute = () => {
      const rect = el.getBoundingClientRect();
      const h = rect.height || 1;
      // top is 0 when beat top is pinned at viewport top, -h when beat
      // bottom hits viewport top (fully scrolled past). Clamp to [0,1]
      // so the transform is neutral while the beat is still settling in
      // and saturates once it's fully past.
      const p = Math.min(1, Math.max(0, -rect.top / h));
      exitProgress.set(p);
    };
    compute();
    container.addEventListener("scroll", compute, { passive: true });
    window.addEventListener("resize", compute, { passive: true });
    return () => {
      container.removeEventListener("scroll", compute);
      window.removeEventListener("resize", compute);
    };
  }, [reducedMotion, exitProgress]);

  const sectionClass = reducedMotion
    ? "relative w-full"
    : "relative h-dvh w-full overflow-hidden [scroll-snap-align:start] [scroll-snap-stop:always]";
  const layoutClass = className;

  const body = typeof children === "function" ? children(nudged) : children;

  return (
    <section
      ref={ref}
      data-beat={index}
      data-beat-slug={slug}
      aria-label={ariaLabel}
      className={sectionClass}
    >
      {reducedMotion ? (
        <div className={layoutClass}>{body}</div>
      ) : (
        <m.div
          data-beat-content=""
          className={[layoutClass, "h-full w-full"].filter(Boolean).join(" ")}
          style={{
            opacity: exitOpacity,
            filter: exitBlur,
            willChange: "opacity, filter",
          }}
        >
          {body}
        </m.div>
      )}
    </section>
  );
}
