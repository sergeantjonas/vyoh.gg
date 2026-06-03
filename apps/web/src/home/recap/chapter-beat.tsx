import {
  m,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "motion/react";
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

// Editorial recede on exit. Four axes layered so the gesture reads as
// "content stayed in place and dissolved", not as "content scrolled off":
//
// - counter-translate y: the inner content gets translated DOWN by the
//   same number of pixels the section's been scrolled UP, which keeps the
//   content visually pinned to its original viewport position while the
//   section slides past underneath. WITHOUT this, the section's natural
//   scroll-up motion dominates the visual; the blur/scale/opacity were
//   playing but invisible because the content was already off-screen by
//   the time they'd progressed enough to read.
// - blur (0 → 24px): heavy defocus — content goes optically out of focus.
// - scale (1 → 0.92): subtle shrink — content pulls back from the camera.
// - opacity (1 → 0): fade.
//
// Defocus/scale/opacity all saturate before the natural scroll-off
// completes (fade by 40%, blur by 55%, scale by 60% of total exit) so
// content is visibly gone well before the next beat snaps in. By that
// point the counter-translate has done its job and the now-invisible
// content can clip naturally against the section's `overflow-hidden` —
// nothing visible is being clipped because opacity is already 0.
const EXIT_BLUR_PX = 24;
const EXIT_SCALE_MIN = 0.92;
const EXIT_FADE_END = 0.5;
const EXIT_BLUR_END = 0.6;
const EXIT_SCALE_END = 0.6;

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
 * Inner content layer is an `m.div` whose four exit axes are bound to the
 * beat's scroll progress out of view. As the reader scrolls past, content
 * gets counter-translated to stay pinned in viewport position while
 * defocusing + shrinking + fading in place. The pin releases naturally
 * once content has gone to opacity 0. Without the counter-translate, the
 * natural scroll-up motion of the section dominates and the defocus
 * gestures play invisibly underneath; with it, the content reads as
 * "dissolving in place" — the actual editorial exit.
 *
 * Manual scroll listener driving a MotionValue rather than motion/react's
 * `useScroll`; `useScroll({ container: mainScrollRef })` throws when the
 * container ref isn't hydrated (SSR / tests without `<main>`). Same
 * pattern as `atmosphere-layer.tsx`.
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
  // Counter-translate (in px): set to -rect.top during exit so the content
  // stays visually pinned at its original viewport position while the
  // section slides past. MotionValue is the raw px count; we publish it
  // straight into `style.y`.
  const exitCounterY = useMotionValue(0);
  const exitOpacity = useTransform(exitProgress, [0, EXIT_FADE_END], [1, 0]);
  const exitScale = useTransform(exitProgress, [0, EXIT_SCALE_END], [1, EXIT_SCALE_MIN]);
  // useMotionTemplate composes a string MotionValue from a numeric one —
  // the explicit-string version (`useTransform(p, [0,1], ["blur(0px)",
  // "blur(24px)"])`) is brittle across motion versions because the CSS
  // function-call format isn't interpolated reliably. Template form
  // outputs `blur(${px}px)` per frame from the numeric blurPx MV.
  const exitBlurPx = useTransform(exitProgress, [0, EXIT_BLUR_END], [0, EXIT_BLUR_PX]);
  const exitFilter = useMotionTemplate`blur(${exitBlurPx}px)`;

  useEffect(() => {
    if (reducedMotion) return;
    const el = ref.current;
    if (!el) return;
    const container: HTMLElement | Window = mainScrollRef.current ?? window;
    const compute = () => {
      const rect = el.getBoundingClientRect();
      const h = rect.height || 1;
      const top = rect.top;
      // top is 0 when beat top is pinned at viewport top, -h when beat
      // bottom hits viewport top (fully scrolled past). Clamp progress
      // to [0,1] so the transforms are neutral while the beat is still
      // settling in and saturate once it's fully past.
      const p = Math.min(1, Math.max(0, -top / h));
      exitProgress.set(p);
      // Counter-translate: ONLY during exit (top < 0). Translating the
      // content +(-top) px keeps its viewport-y position constant while
      // the section's own translate scrolls it upward — net visual: the
      // content stays where it was. Setting to 0 when the beat is still
      // entering (top > 0) so the entrance reveal sees a neutral
      // transform stack.
      exitCounterY.set(top < 0 ? -top : 0);
    };
    compute();
    container.addEventListener("scroll", compute, { passive: true });
    window.addEventListener("resize", compute, { passive: true });
    return () => {
      container.removeEventListener("scroll", compute);
      window.removeEventListener("resize", compute);
    };
  }, [reducedMotion, exitProgress, exitCounterY]);

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
            y: exitCounterY,
            opacity: exitOpacity,
            scale: exitScale,
            filter: exitFilter,
            willChange: "transform, opacity, filter",
          }}
        >
          {body}
        </m.div>
      )}
    </section>
  );
}
