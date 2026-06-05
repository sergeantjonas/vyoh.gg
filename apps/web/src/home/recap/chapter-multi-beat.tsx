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

  // Translate the horizontal track from 0 to -(N-1)*100vw across the
  // chapter's scroll length. At progress 0, beat 0 is at viewport x=0;
  // at progress 1, beat N-1 is at viewport x=0. Each 100dvh of vertical
  // scroll == 100vw of horizontal advance.
  const trackEndVw = Math.max(0, (beatCount - 1) * 100);
  const x = useTransform(scrollYProgress, [0, 1], ["0vw", `-${trackEndVw}vw`]);

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
        style={{ ...sectionStyle, height: `${beatCount * 100}dvh` }}
        className={["relative w-full", className].filter(Boolean).join(" ")}
      >
        <div
          data-chapter-stage=""
          className="sticky top-0 flex h-dvh w-full flex-col overflow-hidden"
        >
          {identity ? (
            <header
              data-chapter-masthead=""
              // No background, no overflow clip: the consumer's identity
              // content is the whole visual treatment. The masthead box
              // just reserves vertical space above the beat track via
              // its own height; the track lives below it in flex flow.
              className="z-20 w-full shrink-0"
              style={{ height: mastheadHeight }}
            >
              {identity}
            </header>
          ) : null}
          <m.div
            data-chapter-track=""
            className="flex flex-1 flex-row will-change-transform"
            style={{ x }}
          >
            {children}
          </m.div>
        </div>
      </section>
    </ChapterGroupNudgeContext.Provider>
  );
}

export const ChapterMultiBeat = forwardRef(ChapterMultiBeatImpl);
