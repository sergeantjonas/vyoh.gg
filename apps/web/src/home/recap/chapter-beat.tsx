import {
  m,
  useMotionTemplate,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useTransform,
} from "motion/react";
import { type ReactNode, useEffect, useRef } from "react";

import { mainScrollRef } from "@/lib/scroll-container";

import { useChapterNudge } from "./use-chapter-nudge";

// motion's useScroll types require RefObject<HTMLElement>, but mainScrollRef
// is RefObject<HTMLElement | null>. The widening is type-only — at runtime
// motion handles the null .current case by deferring subscription until
// the ref attaches.
const containerRef = mainScrollRef as unknown as React.RefObject<HTMLElement>;

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

// Editorial recede on exit. Two-axis dissolve with a hold-then-decay
// envelope so the gesture reads as "content stayed in place and dissolved",
// not as "content scrolled off" and not as "content shrank away":
//
// - counter-translate y: the inner content gets translated DOWN by the
//   same number of pixels the section's been scrolled UP, which keeps
//   content visually pinned at its original viewport position while the
//   section slides past underneath. WITHOUT this, the section's natural
//   scroll-up motion dominates the visual; the blur/opacity arc plays
//   invisibly underneath because content has already scrolled off-screen
//   by the time the arc has any signal strength.
// - blur (0 → 24px): optical defocus.
// - opacity (1 → 0): fade.
//
// Hold window (~first 18% of exit) keeps both axes at neutral — content
// stays sharp and at full opacity for the first beat of scroll-past, so
// it reads as "this beat lingered briefly before dissolving" rather than
// "it started fading the instant I scrolled". Then both axes ramp through
// to their saturated values before the natural scroll-off clipping
// boundary (~78% of exit, given pt-[22vh] inner padding against the
// section's `overflow-hidden` clip rect).
//
// A scale axis (1 → 0.92) was tried but contributed a "shrinking from
// center" perception of residual motion even though no position changed
// — dropped. Blur is the cleaner editorial dissolve because it doesn't
// imply any directional movement.
const EXIT_BLUR_PX = 24;
const EXIT_FADE_HOLD = 0.18;
const EXIT_FADE_END = 0.75;
const EXIT_BLUR_HOLD = 0.15;
const EXIT_BLUR_END = 0.72;

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
  // Pin-wrapper ref. The counter-translate goes on a plain `<div>`, NOT
  // on the inner motion component, so that motion's own writes to
  // `style.transform` can't interfere with the pin. The motion component
  // is a child of the pin wrapper and owns opacity/filter only. Writing
  // counter-translate directly to the wrapper's `style.transform` inside
  // the scroll handler keeps the pin synchronous with the scroll event —
  // no MotionValue scheduling lag.
  const pinRef = useRef<HTMLDivElement | null>(null);
  const reducedMotion = useReducedMotion();
  const nudged = useChapterNudge(ref);

  // motion's useScroll subscribes to the browser's scroll-progress signal
  // for `ref`'s position inside `container`. Unlike a JS getBoundingClientRect
  // poll (which reads stale layout values during composited scrolling — the
  // bug that made every prior approach fail), useScroll's MotionValue is
  // synced with the same scroll subscriber the compositor uses. Translates
  // applied off it land in the same frame as the scroll position change.
  //
  // `offset: ["start start", "end start"]` defines the progress window: 0
  // when the beat's start (top) meets the container's start (top of <main>),
  // 1 when the beat's end (bottom) meets the container's start. So progress
  // is 0 at viewport top and 1 fully scrolled past — the same convention
  // the prior rAF-driven code used, just sourced from a non-stale signal.
  const { scrollYProgress: exitProgress } = useScroll({
    target: ref,
    container: containerRef,
    offset: ["start start", "end start"],
  });

  // Hold-then-decay envelopes — content stays at 1/sharp for the first
  // ~18% of exit, then fades + defocuses through to the saturated value.
  // Three-point ranges with the hold breakpoint give a flat opening
  // followed by a single ease segment.
  const exitOpacity = useTransform(
    exitProgress,
    [0, EXIT_FADE_HOLD, EXIT_FADE_END],
    [1, 1, 0]
  );
  // useMotionTemplate composes a string MotionValue from a numeric one —
  // the explicit-string version (`useTransform(p, [0,1], ["blur(0px)",
  // "blur(24px)"])`) is brittle across motion versions because the CSS
  // function-call format isn't interpolated reliably. Template form
  // outputs `blur(${px}px)` per frame from the numeric blurPx MV.
  const exitBlurPx = useTransform(
    exitProgress,
    [0, EXIT_BLUR_HOLD, EXIT_BLUR_END],
    [0, 0, EXIT_BLUR_PX]
  );
  const exitFilter = useMotionTemplate`blur(${exitBlurPx}px)`;

  // Counter-translate written directly to `pin.style.transform` on every
  // exitProgress change. motion's useScroll fires this callback in sync
  // with the compositor's scroll signal — NOT batched and not stale —
  // so the translate lands in the same paint frame as the scroll move.
  useMotionValueEvent(exitProgress, "change", (p) => {
    if (reducedMotion) return;
    const el = ref.current;
    const pin = pinRef.current;
    if (!el || !pin) return;
    const h = el.getBoundingClientRect().height || 1;
    // Translate the pin wrapper DOWN by the same number of pixels the
    // section has scrolled UP (p * h). At p=0 the section is at viewport
    // top, no counter needed. At p=1 the section is fully scrolled past,
    // counter = h. The pin holds inner content at its original viewport
    // position throughout.
    const counter = Math.max(0, p) * h;
    pin.style.transform = `translateY(${counter}px)`;
    pin.dataset.exitProgress = p.toFixed(3);
    pin.dataset.exitCounter = String(Math.round(counter));
  });

  // Re-apply transform once on mount in case progress is non-zero by the
  // time the effect runs (e.g. SPA back-nav landing mid-section).
  useEffect(() => {
    if (reducedMotion) return;
    const el = ref.current;
    const pin = pinRef.current;
    if (!el || !pin) return;
    const h = el.getBoundingClientRect().height || 1;
    const p = exitProgress.get();
    const counter = Math.max(0, p) * h;
    pin.style.transform = `translateY(${counter}px)`;
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
        // Two-layer wrapper. The outer plain `<div>` is the counter-
        // translate target — written via direct DOM mutation in the
        // scroll handler, so motion can't compete with it. The inner
        // `m.div` owns opacity + filter via MotionValues. Layout
        // className stays on the inner div so the flex-pt-22vh shape
        // applies to the actual content area.
        <div
          ref={pinRef}
          data-beat-pin=""
          className="h-full w-full"
          style={{ willChange: "transform" }}
        >
          <m.div
            data-beat-content=""
            className={[layoutClass, "h-full w-full"].filter(Boolean).join(" ")}
            style={{
              opacity: exitOpacity,
              filter: exitFilter,
              willChange: "opacity, filter",
            }}
          >
            {body}
          </m.div>
        </div>
      )}
    </section>
  );
}
