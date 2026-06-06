import { m, useReducedMotion, useScroll, useTransform } from "motion/react";
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
import { EditorialChrome } from "./editorial-chrome";
import {
  ChapterMultiBeatContext,
  type ChapterMultiBeatContextValue,
  computeBeatRanges,
} from "./use-beat-progress";
import { useChapterNudge } from "./use-chapter-nudge";

const SCROLL_RUNWAY_MULTIPLIER = 2.3;

// Dwell-and-transition scroll mapping. Each beat holds its position for
// `DWELL_UNITS` of scroll units, then transitions to the next beat over
// `TRANSITION_UNITS`. First and last beats (`EDGE_DWELL_UNITS`) get a
// longer dwell so the chapter eases into the first beat from the
// masthead-pin and lingers on the last beat before unpinning — both
// boundaries previously read as too sudden.
const DWELL_UNITS = 2;
const EDGE_DWELL_UNITS = 3;
const TRANSITION_UNITS = 4;

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
  // track proportionally to scroll input. Combined with
  // SCROLL_RUNWAY_MULTIPLIER setting a slow ratio, the user can position
  // by feel — no programmatic snap fighting their input. Dwell-and-
  // transition piecewise mapping was tried but concentrated all motion
  // into ~27% of total scroll, making transitions feel ~2× amplified
  // vs scroll input.
  // Piecewise mapping with DWELL+TRANSITION units. For N beats: each
  // beat dwells for DWELL_UNITS, with TRANSITION_UNITS between beats.
  // useTransform interpolates linearly between stops, so the doubled
  // value at each beat (same value at dwell start + end) holds the
  // track in place across that range.
  const { stops, values } = useMemo(() => {
    const s: number[] = [];
    const v: string[] = [];
    if (beatCount > 0) {
      const edgeCount = Math.min(beatCount, 2);
      const middleCount = Math.max(0, beatCount - 2);
      const totalUnits =
        edgeCount * EDGE_DWELL_UNITS +
        middleCount * DWELL_UNITS +
        Math.max(0, beatCount - 1) * TRANSITION_UNITS;
      let cumulative = 0;
      for (let i = 0; i < beatCount; i += 1) {
        const isEdge = i === 0 || i === beatCount - 1;
        const dwellUnits = isEdge ? EDGE_DWELL_UNITS : DWELL_UNITS;
        const beatPosition = `-${(i * 100) / beatCount}%`;
        s.push(cumulative / totalUnits);
        v.push(beatPosition);
        cumulative += dwellUnits;
        s.push(cumulative / totalUnits);
        v.push(beatPosition);
        if (i < beatCount - 1) cumulative += TRANSITION_UNITS;
      }
    } else {
      s.push(0, 1);
      v.push("0%", "0%");
    }
    return { stops: s, values: v };
  }, [beatCount]);
  const x = useTransform(scrollYProgress, stops, values);

  // Beat ranges derived from the same piecewise stops the track translate
  // uses. Exposed via `ChapterMultiBeatContext` so beats can derive their
  // own enter/dwell/exit progress via `useBeatProgress(index)` without
  // each beat re-deriving the partitioning from scratch.
  const beatRanges = useMemo(
    () => computeBeatRanges(stops, beatCount),
    [stops, beatCount]
  );
  const contextValue = useMemo<ChapterMultiBeatContextValue>(
    () => ({
      scrollYProgress,
      beatCount,
      beatRanges,
      reducedMotion: reducedMotion ?? false,
    }),
    [scrollYProgress, beatCount, beatRanges, reducedMotion]
  );

  // Programmatic snap on scroll-end was tried (commit history) and
  // removed: even using the native `scrollend` event for timing, the
  // snap animation fought continuous user scrolling on Mac trackpad.
  // The user's scroll input would compete with our `scrollTop` writes
  // mid-animation, producing a tug-of-war feel. The slow ratio set by
  // SCROLL_RUNWAY_MULTIPLIER (2.5×) keeps each scroll tick proportional
  // to user input so positioning by feel is workable without snap.
  //
  // If snap behavior becomes wanted later, it must gate on (a) no user
  // input during a longer idle window (≥300ms after scrollend), and
  // (b) cancel on the first wheel/touch event so the user immediately
  // regains control of scroll position.

  const assignRef = (node: HTMLElement | null) => {
    sectionRef.current = node;
    if (typeof ref === "function") ref(node);
    else if (ref) (ref as { current: HTMLElement | null }).current = node;
  };

  if (reducedMotion) {
    return (
      <ChapterGroupNudgeContext.Provider value={entered}>
        <ChapterMultiBeatContext.Provider value={contextValue}>
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
            {/*
              Editorial chrome is intentionally omitted under reduced
              motion — beats render as a static vertical stack, so a
              "Beat 02 / 04" page marker that tracks scroll position
              has no spatial referent. Same content + no motion is the
              standing reduced-motion contract for this chapter.
            */}
          </section>
        </ChapterMultiBeatContext.Provider>
      </ChapterGroupNudgeContext.Provider>
    );
  }

  return (
    <ChapterGroupNudgeContext.Provider value={entered}>
      <ChapterMultiBeatContext.Provider value={contextValue}>
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
                // No `overflow-hidden` on the header. It was load-bearing
                // when the masthead was a fixed-height box (chunk-2 commit
                // 5f0bc03b protecting against vh-relative title content
                // bleeding past a reserved box). The flex-col + shrink-0
                // architecture (d5bbbcc2) sizes the masthead to its
                // content, so the masthead structurally can't overflow
                // its own bounds anymore. Keeping the clip would
                // truncate the logo's drop-shadow halo (a 16px filter
                // halo lands right at the masthead bottom when tagline
                // sits inline with the logo — see RE4) and clip the
                // ChapterReveal blur entrance for the same reason. The
                // stage's own `overflow-hidden` still catches anything
                // genuinely spilling into the chapter's outer bounds.
                className="relative z-20 w-full shrink-0"
              >
                {/* Center the identity content within the full-bleed
                  masthead via a `max-w-4xl` reading column. Without this
                  wrapper the identity hugs the left edge of the viewport
                  on larger screens (titled content stranded with empty
                  space + backdrop on the right). `relative` anchors the
                  progress line below to the reading column. */}
                <div className="relative mx-auto h-full w-full max-w-4xl">
                  {identity}
                  {/*
                    Alive masthead — thin accent progress line at the
                    bottom edge of the masthead's reading column,
                    growing left → right with chapter scroll.
                    Magazine-spread "where you are in this article"
                    indicator. Picks up the chapter's `--accent` so each
                    Steam game/champion gets its own tinted bar.
                    Anchored INSIDE the max-w-4xl column rather than
                    full-bleed so the line stays visually connected to
                    the masthead text instead of floating over splash
                    imagery on the right side. `mix-blend-screen` lifts
                    the line above busy splash crops without a backdrop
                    chip.
                  */}
                  <m.div
                    data-chapter-masthead-progress=""
                    aria-hidden="true"
                    className="absolute right-0 bottom-0 left-0 h-px origin-left bg-[var(--accent,currentColor)] opacity-70 mix-blend-screen"
                    style={{
                      scaleX: useTransform(scrollYProgress, [0, 1], [0, 1]),
                    }}
                  />
                </div>
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
            {/*
            Editorial chrome (Beat N / M page marker + dot indices) is
            mounted once inside the stage. Lives in the absolute layer
            so it stays anchored to the stage corner regardless of
            beat content height; `pointer-events-none` on the chrome
            keeps clicks falling through to the beat beneath.
          */}
            <EditorialChrome />
          </div>
        </section>
      </ChapterMultiBeatContext.Provider>
    </ChapterGroupNudgeContext.Provider>
  );
}

export const ChapterMultiBeat = forwardRef(ChapterMultiBeatImpl);
