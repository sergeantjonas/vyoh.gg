import { m, useReducedMotion, useScroll, useTransform } from "motion/react";
import { type ReactNode, type RefObject, useEffect, useRef, useState } from "react";

import { mainScrollRef } from "@/lib/scroll-container";

import { HAS_VIEW_TIMELINE } from "./has-view-timeline";
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
  /** Layout className applied to the inner sticky element. */
  className?: string;
  children: ReactNode | BeatRenderProp;
};

const WRAPPER_DVH = 130;
const FADE_END_PROGRESS = (WRAPPER_DVH - 100) / WRAPPER_DVH;

const WRAPPER_CLASS =
  "relative h-[130dvh] w-full [scroll-snap-align:start] [scroll-snap-stop:always]";
const INNER_BASE_CLASS = "sticky top-0 h-dvh w-full";

/**
 * One beat in a stacked-beat chapter (R-13 architecture).
 *
 * Snap-aligned 130dvh outer wrapper, `position: sticky; top: 0; height:
 * 100dvh` inner. Browser pins inner natively while outer scrolls past.
 *
 * The exit-dissolve runs on two different code paths depending on engine
 * capability:
 *
 * - Chrome 115+ / Safari 26+ (ViewTimeline available): CSS
 *   `animation-timeline: view()` on the inner div, with the wrapper
 *   exposing a named view-timeline. The browser drives progress on the
 *   compositor — no JS in the scroll-tracking path, no scroll-event
 *   timing concerns, no re-render races during scroll-snap landing.
 *   Keyframes + range live in `apps/web/src/styles/motion.css`.
 * - Firefox (ViewTimeline still flag-gated as of 2026): fall back to
 *   Motion `useScroll` + `useTransform` writing to inline styles. Works
 *   reliably on Firefox; broke on Chrome/Safari because Motion's
 *   `accelerate` path created a WAAPI animation that overrode inline
 *   styles, and `clamp:false` workarounds left us at the mercy of
 *   scroll-snap's flaky scroll-event firing on those engines.
 */
export function ChapterBeat({ index, slug, ariaLabel, className, children }: Props) {
  const wrapperRef = useRef<HTMLElement | null>(null);
  const reducedMotion = useReducedMotion();
  const nudged = useChapterNudge(wrapperRef);

  const body = typeof children === "function" ? children(nudged) : children;

  if (reducedMotion) {
    return (
      <section
        ref={wrapperRef}
        data-beat={index}
        data-beat-slug={slug}
        aria-label={ariaLabel}
        className={["relative w-full", className].filter(Boolean).join(" ")}
      >
        {body}
      </section>
    );
  }

  if (HAS_VIEW_TIMELINE) {
    return (
      <CssTimelineBeat
        wrapperRef={wrapperRef}
        index={index}
        slug={slug}
        ariaLabel={ariaLabel}
        className={className}
      >
        {body}
      </CssTimelineBeat>
    );
  }

  return (
    <MotionBeat
      wrapperRef={wrapperRef}
      index={index}
      slug={slug}
      ariaLabel={ariaLabel}
      className={className}
    >
      {body}
    </MotionBeat>
  );
}

type BeatBranchProps = {
  wrapperRef: React.RefObject<HTMLElement | null>;
  index: number;
  slug: string | undefined;
  ariaLabel: string | undefined;
  className: string | undefined;
  children: ReactNode;
};

function CssTimelineBeat({
  wrapperRef,
  index,
  slug,
  ariaLabel,
  className,
  children,
}: BeatBranchProps) {
  const innerClass = [INNER_BASE_CLASS, className].filter(Boolean).join(" ");
  return (
    <section
      ref={wrapperRef}
      data-beat={index}
      data-beat-slug={slug}
      data-beat-wrapper=""
      aria-label={ariaLabel}
      className={WRAPPER_CLASS}
    >
      {/* `data-css-timeline` is the runtime opt-in that motion.css keys
          off — keeps the CSS animation from firing on Firefox where
          `@supports` would lie and produce a stuck "to" state. */}
      <div data-beat-inner="" data-css-timeline="" className={innerClass}>
        {children}
      </div>
    </section>
  );
}

function MotionBeat({
  wrapperRef,
  index,
  slug,
  ariaLabel,
  className,
  children,
}: BeatBranchProps) {
  const [containerReady, setContainerReady] = useState(() => !!mainScrollRef.current);
  useEffect(() => {
    if (!containerReady && mainScrollRef.current) setContainerReady(true);
  }, [containerReady]);

  const { scrollYProgress } = useScroll({
    ...(containerReady
      ? { container: mainScrollRef as unknown as RefObject<HTMLElement> }
      : {}),
    target: wrapperRef,
    offset: ["start start", "end start"],
  });

  // `clamp: false` keeps Motion's `accelerate` config off the derived
  // motion values (`use-transform.mjs` gates accelerate propagation on
  // `options?.clamp !== false`). On Firefox accelerate never engages
  // because `supportsViewTimeline()` is false, so this is a no-op there
  // — left in for safety in case Firefox enables the feature later.
  const opacity = useTransform(scrollYProgress, [0, FADE_END_PROGRESS, 1], [1, 0, 0], {
    clamp: false,
  });
  const blur = useTransform(
    scrollYProgress,
    [0, FADE_END_PROGRESS, 1],
    ["blur(0px)", "blur(8px)", "blur(8px)"],
    { clamp: false }
  );
  const scale = useTransform(
    scrollYProgress,
    [0, FADE_END_PROGRESS, 1],
    [1, 0.985, 0.985],
    {
      clamp: false,
    }
  );

  const innerClass = [INNER_BASE_CLASS, className].filter(Boolean).join(" ");

  return (
    <section
      ref={wrapperRef}
      data-beat={index}
      data-beat-slug={slug}
      aria-label={ariaLabel}
      className={WRAPPER_CLASS}
    >
      <m.div className={innerClass} style={{ opacity, filter: blur, scale }}>
        {children}
      </m.div>
    </section>
  );
}
