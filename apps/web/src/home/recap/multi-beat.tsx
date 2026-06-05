import { m, useInView, useReducedMotion } from "motion/react";
import { type ReactNode, useEffect, useRef, useState } from "react";

import { mainScrollRef } from "@/lib/scroll-container";

import { ChapterBeatNudgeContext } from "./chapter-group";

/** Render-prop child: receives this beat's own nudge state. */
export type MultiBeatRenderProp = (nudged: boolean) => ReactNode;

type Props = {
  /** Beat index within its `<ChapterMultiBeat>` (0-based). Surfaces as `data-beat`. */
  index: number;
  /** Total beat count in the chapter — used for the `Beat N of M` aria label. */
  beatCount: number;
  /** Optional slug for selector targeting / debugging. */
  slug?: string;
  /** Optional ARIA label override; default is `Beat N of M`. */
  ariaLabel?: string;
  /** Layout className applied to the inner content wrapper. */
  className?: string;
  children: ReactNode | MultiBeatRenderProp;
};

/**
 * One beat in the multi-beat chapter architecture. Renders a viewport-tall
 * (minus chapter masthead) snap-aligned `<article>` with an inner motion
 * div that fades + translates in when the beat crosses its IntersectionObserver
 * threshold and reverses on exit.
 *
 * Key structural properties:
 * - `scroll-snap-align: start` + `scroll-snap-stop: always` on the outer
 *   article — every beat is a snap stop that fast wheel/trackpad cannot
 *   skip, killing the "stuck / skipped" symptoms.
 * - `scroll-margin-top: var(--masthead-h)` offsets the snap point by the
 *   chapter masthead's height, so when snapped, the beat's content sits
 *   below the sticky masthead rather than under it.
 * - Height is `100dvh - var(--masthead-h)` so each beat fully fills the
 *   visible (post-masthead) viewport. No tall outer with sticky inner;
 *   no scroll runway dead-air.
 *
 * Entry / exit motion is IntersectionObserver-triggered Motion (the
 * R-13 v2 pattern — see [r13-exit-dissolve.md](../../../docs/working-notes/cross-cutting/r13-exit-dissolve.md)).
 * No scroll-coupled transforms, so the R-13 snap-compositor optimization
 * (Chrome/Safari composite snap units + descendants as one unit,
 * ignoring per-descendant transforms during snap interpolation) doesn't
 * apply here.
 *
 * The choreography in this chunk is a minimal placeholder (fade + Y
 * translate). Per the [multi-beat-chapter-arc.md](../../../docs/working-notes/cross-cutting/multi-beat-chapter-arc.md)
 * standing rule, every beat must be individually art-directed against
 * the choreography toolkit before this architecture ships to users;
 * the substrate is what's being validated here, not the motion.
 *
 * Under `prefers-reduced-motion`: snap stays (it's navigation, not
 * animation), but the fixed height is dropped so content flows naturally,
 * and no motion is applied. Nudge flips true immediately so child
 * reveal cascades render without animation.
 */
export function MultiBeat({
  index,
  beatCount,
  slug,
  ariaLabel,
  className,
  children,
}: Props) {
  const ref = useRef<HTMLElement | null>(null);
  const reducedMotion = useReducedMotion();
  // `amount: 0.3` (not 0.5) keeps the beat in its "entered" state until
  // most of it has scrolled out of view, so the last beat doesn't fire
  // its exit animation while the user is still reading it / scrolling
  // toward the end of the chapter. With snap engaged this also gives the
  // entering beat headroom to finish its entrance before the previous
  // beat's exit completes — beats overlap in motion, not in opacity.
  const isInView = useInView(ref, {
    root: mainScrollRef as React.RefObject<Element>,
    amount: 0.3,
  });

  // hasBeenInView prevents the exit animation from firing on initial
  // mount — useInView is false on mount until the IO observer runs, but
  // the user has never "seen" the beat yet, so animating it out would be
  // a phantom transition. Mirror the R-13 v2 resolution pattern.
  const hasBeenInViewRef = useRef(false);
  const [nudged, setNudged] = useState(reducedMotion ?? false);

  useEffect(() => {
    if (reducedMotion) {
      setNudged(true);
      return;
    }
    if (isInView) {
      hasBeenInViewRef.current = true;
      setNudged(true);
    } else if (hasBeenInViewRef.current) {
      setNudged(false);
    }
  }, [isInView, reducedMotion]);

  const body = typeof children === "function" ? children(nudged) : children;
  const label = ariaLabel ?? `Beat ${index + 1} of ${beatCount}`;

  if (reducedMotion) {
    return (
      <ChapterBeatNudgeContext.Provider value={true}>
        <div
          ref={ref as React.RefObject<HTMLDivElement>}
          // biome-ignore lint/a11y/useSemanticElements: carousel slide per W3C WAI-ARIA APG, not a form group
          role="group"
          aria-roledescription="slide"
          aria-label={label}
          data-beat={index}
          data-beat-slug={slug}
          className={["relative w-full", className].filter(Boolean).join(" ")}
        >
          {body}
        </div>
      </ChapterBeatNudgeContext.Provider>
    );
  }

  return (
    <ChapterBeatNudgeContext.Provider value={nudged}>
      <div
        ref={ref as React.RefObject<HTMLDivElement>}
        // biome-ignore lint/a11y/useSemanticElements: carousel slide per W3C WAI-ARIA APG, not a form group
        role="group"
        aria-roledescription="slide"
        aria-label={label}
        data-beat={index}
        data-beat-slug={slug}
        className={[
          "relative w-full overflow-hidden",
          "h-[calc(100dvh-var(--masthead-h))]",
          "[scroll-snap-align:start] [scroll-snap-stop:always]",
          "[scroll-margin-top:var(--masthead-h)]",
        ].join(" ")}
      >
        <m.div
          className={["flex h-full w-full flex-col", className].filter(Boolean).join(" ")}
          initial={{ opacity: 0, y: 24 }}
          animate={nudged ? { opacity: 1, y: 0 } : { opacity: 0, y: -24 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        >
          {body}
        </m.div>
      </div>
    </ChapterBeatNudgeContext.Provider>
  );
}
