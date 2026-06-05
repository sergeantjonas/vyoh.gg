import { m, useReducedMotion, useScroll, useTransform } from "motion/react";
import {
  type CSSProperties,
  Children,
  type ReactNode,
  type Ref,
  type RefObject,
  forwardRef,
  isValidElement,
  useEffect,
  useRef,
  useState,
} from "react";

import { mainScrollRef } from "@/lib/scroll-container";

import { ChapterGroupNudgeContext } from "./chapter-group";
import { useChapterNudge } from "./use-chapter-nudge";

type Props = {
  /** Optional `data-chapter` slug for selectors / debugging. */
  slug?: string;
  /** Optional ARIA label for the section landmark. */
  ariaLabel?: string;
  className?: string;
  /**
   * Persistent chapter masthead rendered at the top of the pinned
   * stage. Stays visible for the chapter's entire scroll length; beat
   * content slides horizontally underneath it. The slot's children can
   * call `useChapterGroupNudge()` to drive their own entrance/exit
   * animations off the chapter's overall presence state.
   */
  identity?: ReactNode;
  /**
   * Masthead height as a CSS length expression. Drives the masthead
   * box's `height` and the `--masthead-h` CSS variable that the beat
   * track reads to size itself. Default `20vh`.
   */
  mastheadHeight?: string;
  children: ReactNode;
};

/**
 * Horizontal-track multi-beat chapter (the Apple AirPods Pro / Stripe
 * Sessions pattern). Replaces the snap-and-sticky multi-beat that fought
 * the browser cross-engine; this design has no scroll-snap involvement
 * at all. Full background in
 * [multi-beat-chapter-arc.md](../../../docs/working-notes/cross-cutting/multi-beat-chapter-arc.md).
 *
 * Architecture:
 * - Outer `<section>` is `beatCount * 100dvh` tall — that height is the
 *   scroll runway Motion's `useScroll` measures progress against.
 * - Inside, a `position: sticky; top: 0; height: 100dvh` stage pins for
 *   the chapter's full vertical scroll length. The masthead lives at
 *   the top of this stage and never moves.
 * - Below the masthead, a horizontal track (`flex flex-row`) lays out
 *   all beats side-by-side, each `w-screen`. The track's `x` transform
 *   is driven by `useTransform(scrollYProgress, [0, 1], ["0vw", `-${(N-1)*100}vw`])`,
 *   so each 100dvh of vertical scroll advances the track by 100vw.
 * - Motion's `useScroll` runs on the native `ScrollTimeline` API on
 *   Chrome 115+ / Safari 26+ (compositor thread, no per-frame JS) and
 *   falls back to rAF on Firefox. Single source surface, all engines.
 *
 * No scroll-snap means no cross-engine fragility. The "between content
 * piece" feel comes from Motion's smooth scroll-driven translate and
 * per-beat reveal cascades fired by each `<MultiBeat>`'s `useInView`
 * (the R-13 v2 IntersectionObserver + animate pattern).
 *
 * Under `prefers-reduced-motion`: collapses to a vertical stack —
 * masthead in flow, beats below, no transforms, no pinning. Same
 * content, no motion. Snap is not needed; the page is just a stack.
 */
function ChapterMultiBeatImpl(
  { slug, ariaLabel, className, identity, mastheadHeight = "20vh", children }: Props,
  ref: Ref<HTMLElement>
) {
  const sectionRef = useRef<HTMLElement | null>(null);
  const reducedMotion = useReducedMotion();
  const entered = useChapterNudge(sectionRef);

  const beatCount = Children.toArray(children).filter(isValidElement).length;

  // Motion's useScroll requires the container ref to be hydrated before
  // it can attach scroll listeners — passing a null-ref container throws
  // in dev. Gate the `container` option on a state flag that flips once
  // mainScrollRef is attached. Without this, useScroll falls back to
  // window scroll for the first render, which is fine in happy-dom
  // (tests) where mainScrollRef never hydrates anyway.
  const [containerReady, setContainerReady] = useState(() => !!mainScrollRef.current);
  useEffect(() => {
    if (!containerReady && mainScrollRef.current) setContainerReady(true);
  }, [containerReady]);

  const { scrollYProgress } = useScroll({
    ...(containerReady
      ? { container: mainScrollRef as unknown as RefObject<HTMLElement> }
      : {}),
    target: sectionRef,
    offset: ["start start", "end end"],
  });

  // Translate the horizontal track in percentages of the track itself —
  // resolution-independent. Each beat is `w-full` of the stage, so the
  // track's content width is `N × stage_width`. To bring beat i to the
  // visible area we translate by `-(i / N) × 100%` of track width. End
  // state at progress 1 is `-((N-1)/N) × 100%`, putting beat N-1 in
  // view. (vw-based translation drifted out of sync above the recap
  // wrapper's max-w-4xl breakpoint because the track is stage-width but
  // vw is viewport-width — owner caught this with "content invisible at
  // larger window sizes".)
  const trackEndPct = beatCount > 0 ? ((beatCount - 1) * 100) / beatCount : 0;
  const x = useTransform(scrollYProgress, [0, 1], ["0%", `-${trackEndPct}%`]);

  const assignRef = (node: HTMLElement | null) => {
    sectionRef.current = node;
    if (typeof ref === "function") ref(node);
    else if (ref) (ref as { current: HTMLElement | null }).current = node;
  };

  const sectionStyle = { "--masthead-h": mastheadHeight } as CSSProperties;

  if (reducedMotion) {
    return (
      <ChapterGroupNudgeContext.Provider value={entered}>
        <section
          ref={assignRef}
          aria-roledescription="carousel"
          aria-label={ariaLabel}
          data-chapter={slug}
          data-chapter-multi-beat=""
          data-chapter-beat-count={beatCount}
          data-reduced-motion=""
          style={sectionStyle}
          className={["relative w-full", className].filter(Boolean).join(" ")}
        >
          {identity ? (
            <div data-chapter-masthead="" className="w-full">
              {identity}
            </div>
          ) : null}
          {children}
        </section>
      </ChapterGroupNudgeContext.Provider>
    );
  }

  return (
    <ChapterGroupNudgeContext.Provider value={entered}>
      <section
        ref={assignRef}
        aria-roledescription="carousel"
        aria-label={ariaLabel}
        data-chapter={slug}
        data-chapter-multi-beat=""
        data-chapter-beat-count={beatCount}
        // Section height = beatCount × main viewport. Sized in
        // `var(--main-h)` (published by __root.tsx as `<main>`'s actual
        // clientHeight in px) rather than `dvh` because the nav strip
        // above main makes main shorter than the window. With dvh, the
        // sticky stage was taller than main's viewport and released
        // before Motion's useScroll progress reached 1 — chapter slid
        // up mid-beat 2 (i.e. mid horizontal-translate) instead of
        // staying pinned through the last beat. Falls back to dvh when
        // --main-h isn't set (e.g. during initial render / tests).
        style={{
          ...sectionStyle,
          height: `calc(${beatCount} * var(--main-h, 100dvh))`,
        }}
        className={["relative w-full", className].filter(Boolean).join(" ")}
      >
        <div
          data-chapter-stage=""
          className="sticky top-0 w-full overflow-hidden"
          style={{ height: "var(--main-h, 100dvh)" }}
        >
          {identity ? (
            <header
              data-chapter-masthead=""
              // `overflow-hidden` is load-bearing: the title-card content
              // is sized with `vh`-relative units (logo width, type
              // scale) that don't always fit inside `mastheadHeight`'s
              // 42vh box at larger viewports. Without clipping, the
              // overflow stacks z-order above the beat track and hides
              // beat content entirely.
              className="relative z-20 w-full overflow-hidden"
              style={{ height: mastheadHeight }}
            >
              {identity}
            </header>
          ) : null}
          <m.div
            data-chapter-track=""
            // Explicit height = main viewport - masthead. Same --main-h
            // fallback to 100dvh so this works during initial render
            // before the variable is published.
            className="flex flex-row will-change-transform"
            style={{
              x,
              height: "calc(var(--main-h, 100dvh) - var(--masthead-h))",
            }}
          >
            {children}
          </m.div>
        </div>
      </section>
    </ChapterGroupNudgeContext.Provider>
  );
}

export const ChapterMultiBeat = forwardRef(ChapterMultiBeatImpl);
