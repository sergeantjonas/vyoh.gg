import { animate, m, useReducedMotion, useScroll, useTransform } from "motion/react";
import {
  Children,
  type ReactNode,
  type Ref,
  type RefObject,
  forwardRef,
  isValidElement,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { mainScrollRef } from "@/lib/scroll-container";

import { ChapterGroupNudgeContext } from "./chapter-group";
import { useChapterNudge } from "./use-chapter-nudge";

const SCROLL_RUNWAY_MULTIPLIER = 2.5;

type Props = {
  /** Optional `data-chapter` slug for selectors / debugging. */
  slug?: string;
  /** Optional ARIA label for the section landmark. */
  ariaLabel?: string;
  className?: string;
  /**
   * Persistent chapter masthead rendered at the top of the pinned
   * stage. Stays visible for the chapter's entire scroll length; beat
   * content slides horizontally underneath it. Sized to its content
   * (no fixed height); the track fills the remaining stage height.
   * The slot's children can call `useChapterGroupNudge()` to drive
   * their own entrance/exit animations off the chapter's overall
   * presence state.
   */
  identity?: ReactNode;
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
  { slug, ariaLabel, className, identity, children }: Props,
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

  // Linear scroll-to-horizontal mapping. Each scroll tick advances the
  // track at the same rate as scroll — no dwell zones, no amplified
  // transitions. The chapter feels evenly paced, not "sticky then zip".
  // Reading time on each beat is provided by the snap effect below,
  // which pulls the user onto the nearest beat after scroll input stops.
  //
  // Dwell-and-transition piecewise mapping was tried but concentrated
  // all motion into ~27% of total scroll, making transitions feel ~2x
  // amplified vs scroll input. Linear + snap reads as smoother.
  const beatPositions = useMemo(() => {
    // Progress positions where each beat is centered in the viewport.
    // For N beats: [0, 1/(N-1), 2/(N-1), ..., 1].
    if (beatCount <= 1) return [0];
    return Array.from({ length: beatCount }, (_, i) => i / (beatCount - 1));
  }, [beatCount]);
  const trackEndPct = beatCount > 0 ? ((beatCount - 1) * 100) / beatCount : 0;
  const x = useTransform(scrollYProgress, [0, 1], ["0%", `-${trackEndPct}%`]);

  // Programmatic snap-to-dwell on scroll-end. Without this, a Mac
  // trackpad flick with momentum carries the user past beats — they
  // end up resting in a transition zone with two beats half-visible.
  // 150ms after scroll input stops, find which scroll zone the user
  // landed in: if it's a dwell zone (`values[i] === values[i+1]`),
  // do nothing (they're already on a beat); if it's a transition zone,
  // animate scrollTop to the nearer dwell-zone end so they land on a
  // readable beat. The snap animation suppresses its own scroll
  // listener via `isAnimatingRef` so we don't re-trigger snapping
  // mid-animation.
  const isAnimatingRef = useRef(false);
  useEffect(() => {
    if (reducedMotion) return;
    if (beatCount <= 1) return;
    const main = mainScrollRef.current;
    const section = sectionRef.current;
    if (!main || !section) return;

    let activeAnimation: ReturnType<typeof animate> | null = null;

    const snapToNearestBeat = () => {
      if (isAnimatingRef.current) return;
      const sectionTop = section.offsetTop;
      const sectionHeight = section.offsetHeight;
      const stageHeight = main.clientHeight;
      const runway = sectionHeight - stageHeight;
      if (runway <= 0) return;
      const currentScroll = main.scrollTop;
      // Outside the chapter's scroll runway — don't snap.
      if (currentScroll < sectionTop || currentScroll > sectionTop + runway) return;
      // Find the nearest beat position (in progress units, then convert to scroll).
      const progress = (currentScroll - sectionTop) / runway;
      let nearestProgress = beatPositions[0] ?? 0;
      let minDist = Math.abs(progress - nearestProgress);
      for (const p of beatPositions) {
        const d = Math.abs(progress - p);
        if (d < minDist) {
          minDist = d;
          nearestProgress = p;
        }
      }
      const target = sectionTop + nearestProgress * runway;
      if (Math.abs(currentScroll - target) < 2) return;
      isAnimatingRef.current = true;
      activeAnimation = animate(currentScroll, target, {
        duration: 0.4,
        ease: [0.16, 1, 0.3, 1],
        onUpdate: (v) => {
          main.scrollTop = v;
        },
        onComplete: () => {
          isAnimatingRef.current = false;
          activeAnimation = null;
        },
      });
    };

    // Use the native `scrollend` event (Chrome 114+/Safari 17.4+/Firefox
    // 109+) which fires after the browser's own momentum has settled.
    // Previously used a 150ms debounce on `scroll` events, which could
    // fail during long momentum scrolls (each tail-end momentum tick
    // reset the debounce, so snap never fired).
    const onScrollEnd = () => {
      if (isAnimatingRef.current) return;
      snapToNearestBeat();
    };

    main.addEventListener("scrollend", onScrollEnd, { passive: true });
    return () => {
      main.removeEventListener("scrollend", onScrollEnd);
      activeAnimation?.stop();
    };
  }, [beatCount, reducedMotion, beatPositions]);

  const assignRef = (node: HTMLElement | null) => {
    sectionRef.current = node;
    if (typeof ref === "function") ref(node);
    else if (ref) (ref as { current: HTMLElement | null }).current = node;
  };

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
        // Section height = beatCount × SCROLL_RUNWAY_MULTIPLIER × main
        // viewport. Sized in `var(--main-h)` (published by __root.tsx as
        // `<main>`'s actual clientHeight in px) rather than `dvh`
        // because the nav strip above main makes main shorter than the
        // window. With dvh, the sticky stage was taller than main's
        // viewport and released before Motion's useScroll progress
        // reached 1.
        //
        // SCROLL_RUNWAY_MULTIPLIER (= 1.6) gives the chapter more total
        // vertical scroll so each dwell + transition is substantial
        // enough that a trackpad flick with momentum can't blow through
        // a whole beat. With multiplier=1 (the natural beatCount×main-h
        // section), one momentum swipe (~150vh) was enough to skip
        // beats; at 1.6 each beat advance takes ~150vh so even a strong
        // flick lands roughly on the next beat rather than past it.
        //
        // Full-bleed escape from the recap's `max-w-4xl` wrapper.
        // `width: 100vw` extends to viewport edges; `margin-left:
        // calc(50% - 50vw)` pulls the left edge out to balance.
        // `[overflow-x: clip]` on `<main>` (set in __root.tsx) prevents
        // a horizontal page scrollbar.
        style={{
          height: `calc(${beatCount * SCROLL_RUNWAY_MULTIPLIER} * var(--main-h, 100dvh))`,
          width: "100vw",
          marginLeft: "calc(50% - 50vw)",
        }}
        className={["relative", className].filter(Boolean).join(" ")}
      >
        <div
          data-chapter-stage=""
          // Flex column so the masthead sizes to its content and the
          // track fills whatever's left. Avoids the empty-gap problem
          // where a fixed `mastheadHeight` reserved more space than the
          // title card actually rendered into — the leftover showed up
          // as dead space between masthead and beat content.
          className="sticky top-0 flex w-full flex-col overflow-hidden"
          style={{ height: "var(--main-h, 100dvh)" }}
        >
          {identity ? (
            <header
              data-chapter-masthead=""
              className="relative z-20 w-full shrink-0 overflow-hidden"
            >
              {/* Center the identity content within the full-bleed
                  masthead via a `max-w-4xl` reading column. Without this
                  wrapper the identity hugs the left edge of the viewport
                  on larger screens (titled content stranded with empty
                  space + backdrop on the right). */}
              <div className="mx-auto h-full w-full max-w-4xl">{identity}</div>
            </header>
          ) : null}
          <m.div
            data-chapter-track=""
            // `flex-1 min-h-0`: takes all remaining stage height after
            // the masthead. `min-h-0` is required for the flex item to
            // actually shrink — Firefox's default `min-height: auto`
            // on flex items would otherwise let track height push
            // upward into the masthead. Explicit width = beatCount ×
            // 100% so the percentage translate maps to one beat per
            // chapter scroll segment.
            className="flex min-h-0 flex-1 flex-row will-change-transform"
            style={{ x, width: `${beatCount * 100}%` }}
          >
            {children}
          </m.div>
        </div>
      </section>
    </ChapterGroupNudgeContext.Provider>
  );
}

export const ChapterMultiBeat = forwardRef(ChapterMultiBeatImpl);
