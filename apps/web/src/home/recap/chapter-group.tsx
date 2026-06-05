import {
  m,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useTransform,
} from "motion/react";
import {
  Children,
  type ReactNode,
  type Ref,
  type RefObject,
  createContext,
  forwardRef,
  isValidElement,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

import { mainScrollRef } from "@/lib/scroll-container";

import { HAS_VIEW_TIMELINE } from "./has-view-timeline";
import { useChapterNudge } from "./use-chapter-nudge";

type Props = {
  /** Optional `data-chapter` slug for selectors / debugging. */
  slug?: string;
  /** Optional ARIA label for the section landmark. */
  ariaLabel?: string;
  className?: string;
  /**
   * Persistent chapter title card rendered absolutely at the top of the
   * sticky stage. Stays anchored across the chapter's full scroll length
   * (the sticky-stage architecture pins one viewport-tall stage for the
   * whole chapter section). Children of the slot can call
   * `useChapterGroupNudge()` to drive their own entrance animations off
   * the chapter's entered state.
   */
  identity?: ReactNode;
  children: ReactNode;
};

export const ChapterGroupNudgeContext = createContext(false);

export function useChapterGroupNudge(): boolean {
  return useContext(ChapterGroupNudgeContext);
}

/**
 * Per-beat nudge — `true` once this beat has scrolled into its active
 * range within the chapter's scroll timeline. Drives the `ChapterReveal`
 * cascade in the beat's children so each beat's editorial reveal plays
 * when it becomes dominant, not at chapter mount.
 */
export const ChapterBeatNudgeContext = createContext(false);

export function useChapterBeatNudge(): boolean {
  return useContext(ChapterBeatNudgeContext);
}

/**
 * Sticky-stage scrollytelling chapter (the canonical pattern used by Pudding,
 * NYT scrollytelling, Apple landing pages).
 *
 * - The chapter `<section>` is `(beatCount + 1) × 100vh` tall — this provides
 *   the scroll length for the view-timeline.
 * - Inside, a single `position: sticky; top: 0; height: 100vh` stage pins
 *   for the full chapter length. The masthead lives at the top of this
 *   stage (absolute, never moves). The beat content area sits below the
 *   masthead, occupying the rest of the stage.
 * - Each `<ChapterBeat>` child renders as an absolutely-positioned layer
 *   inside the beat content area — all beats stack on top of one another
 *   at the same x/y. Only one is visible at a time via opacity.
 * - Opacity per beat is driven by a chapter-scoped view-timeline (Chrome +
 *   Safari) or by Motion's `useScroll`/`useTransform` (Firefox fallback).
 *   As the user scrolls through the chapter, beats cross-fade in sequence.
 *
 * The key property of this architecture: **beat content never moves
 * vertically**. It only changes opacity. Because content is positioned
 * below the masthead in the absolute layer, it cannot enter the masthead's
 * vertical space during scroll. The bleed problem is structurally
 * impossible by design, not mitigated by timing tricks.
 *
 * Under `prefers-reduced-motion`, the sticky-stage collapses to a plain
 * vertical stack — each beat renders one after the other in normal flow,
 * with the masthead at the top. No animation, no overlap, no view-timeline.
 */
function ChapterGroupImpl(
  { slug, ariaLabel, className, identity, children }: Props,
  ref: Ref<HTMLElement>
) {
  const sectionRef = useRef<HTMLElement | null>(null);
  const reducedMotion = useReducedMotion();
  const entered = useChapterNudge(sectionRef);

  const beats = Children.toArray(children).filter(isValidElement);
  const beatCount = beats.length;

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
    offset: ["start end", "end start"],
  });

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
          data-chapter={slug}
          data-chapter-group=""
          data-reduced-motion=""
          aria-label={ariaLabel}
          className={["relative w-full", className].filter(Boolean).join(" ")}
        >
          {identity ? (
            <div data-chapter-identity-mark="" className="w-full">
              {identity}
            </div>
          ) : null}
          {beats.map((beat, i) => (
            <ChapterBeatNudgeContext.Provider
              // biome-ignore lint/suspicious/noArrayIndexKey: beat order is stable across renders
              key={i}
              value={entered}
            >
              <div className="w-full">{beat}</div>
            </ChapterBeatNudgeContext.Provider>
          ))}
        </section>
      </ChapterGroupNudgeContext.Provider>
    );
  }

  return (
    <ChapterGroupNudgeContext.Provider value={entered}>
      <section
        ref={assignRef}
        data-chapter={slug}
        data-chapter-group=""
        data-chapter-beat-count={beatCount}
        aria-label={ariaLabel}
        className={["relative w-full", className].filter(Boolean).join(" ")}
        style={{ height: `${beatCount * 100}dvh` }}
      >
        <div data-chapter-stage="" className="sticky top-0 h-dvh w-full overflow-hidden">
          {identity ? (
            // Masthead anchored absolutely at top of stage. Never moves.
            // `pointer-events-none` on overlay so it doesn't block clicks
            // on beat content; identity itself re-enables pointer-events.
            <div
              data-chapter-identity-mark=""
              className="pointer-events-none absolute inset-x-0 top-0 z-20"
            >
              <div className="pointer-events-auto">{identity}</div>
            </div>
          ) : null}
          {/* Beat content area — sits below masthead's vertical range.
              `top-[30vh]` reserves the top 30vh for the masthead box
              (measured: ~24vh mobile, ~35vh desktop including pt-12/16 +
              eyebrow + max-h-[14dvh]/[18dvh] logo + tagline). Beats are
              absolutely positioned within this area and stack on top of
              each other — only opacity differs. */}
          <div className="absolute inset-x-0 bottom-0 top-[30vh] z-10">
            {beats.map((beat, i) => (
              <BeatLayer
                // biome-ignore lint/suspicious/noArrayIndexKey: beat order is stable across renders
                key={i}
                index={i}
                beatCount={beatCount}
                scrollYProgress={scrollYProgress}
              >
                {beat}
              </BeatLayer>
            ))}
          </div>
        </div>
      </section>
    </ChapterGroupNudgeContext.Provider>
  );
}

/**
 * Compute per-beat fade range as a fraction of the chapter section's cover
 * timeline. Section height is N×100vh; cover range is (N+1)×100vh.
 *
 * Beats fade across the ENTIRE cover range (0-100%), not just the pinned
 * region — beat content starts fading in while the chapter section is
 * still sliding into the viewport, and finishes fading out while it's
 * sliding out, so the user always sees something responding to scroll.
 *
 * Each beat takes one Nth of the cover plus a tight overlap on each side
 * (`halfSpan * beatWidth` with halfSpan=0.55 → 5% overlap, only 2.5% per
 * side). The overlap is intentionally small: a wider overlap puts two
 * beats on screen at high opacities simultaneously, which feels like
 * stacked / overlapping content especially during scroll-back. The
 * directional translate in the keyframes (beats enter from below, exit
 * upward) handles the visual handoff during the brief overlap window.
 */
function computeBeatRange(
  index: number,
  beatCount: number
): { start: number; mid: number; end: number } {
  const beatWidth = 1 / beatCount;
  const center = (index + 0.5) * beatWidth;
  const halfSpan = beatWidth * 0.55;
  return {
    start: Math.max(0, center - halfSpan),
    mid: center,
    end: Math.min(1, center + halfSpan),
  };
}

type BeatLayerProps = {
  index: number;
  beatCount: number;
  scrollYProgress: ReturnType<typeof useScroll>["scrollYProgress"];
  children: ReactNode;
};

function BeatLayer({ index, beatCount, scrollYProgress, children }: BeatLayerProps) {
  const range = computeBeatRange(index, beatCount);
  const fadeInEnd = range.start + (range.mid - range.start) * 0.4;
  const fadeOutStart = range.end - (range.end - range.mid) * 0.4;

  // JS opacity + translateY drivers — used on Firefox where view-timeline
  // isn't supported. The CSS-timeline path on Blink/WebKit drives the
  // same opacity + translateY via motion.css keyframes. translateY adds
  // directional motion so adjacent beats look like they're moving past
  // each other (incoming from below, outgoing upward) rather than
  // dissolving in place — this makes the short cross-fade overlap window
  // read as a transition rather than as stacked content.
  const opacity = useTransform(
    scrollYProgress,
    [range.start, fadeInEnd, fadeOutStart, range.end],
    [0, 1, 1, 0]
  );
  const y = useTransform(
    scrollYProgress,
    [range.start, fadeInEnd, fadeOutStart, range.end],
    [24, 0, 0, -24]
  );

  // Per-beat nudge — flips true once scroll progress crosses this beat's
  // fade-in midpoint. One-shot; never resets so re-scrolling doesn't
  // replay the cascade. Drives the `ChapterReveal` animations inside the
  // beat content so each beat's editorial reveal plays when it becomes
  // dominant, not at chapter mount.
  //
  // Initialize from current motion value, not just from "change" events —
  // on page reload at mid-scroll (or any non-zero starting scroll), the
  // scroll-progress motion value initializes at the target value and no
  // "change" event fires, so a change-only listener leaves `nudged`
  // stuck at false. The useEffect runs once on mount with the current
  // value, then useMotionValueEvent picks up subsequent crossings.
  const [nudged, setNudged] = useState(() => scrollYProgress.get() >= fadeInEnd);
  useEffect(() => {
    if (!nudged && scrollYProgress.get() >= fadeInEnd) setNudged(true);
  }, [nudged, fadeInEnd, scrollYProgress]);
  useMotionValueEvent(scrollYProgress, "change", (value) => {
    if (!nudged && value >= fadeInEnd) setNudged(true);
  });

  if (HAS_VIEW_TIMELINE) {
    // CSS view-timeline path. The animation lives in motion.css keyed
    // off `[data-css-timeline]`; we publish the per-beat fade
    // percentages as CSS variables so the keyframes can pick them up
    // via animation-range.
    return (
      <ChapterBeatNudgeContext.Provider value={nudged}>
        <div
          data-beat-layer=""
          data-beat-layer-idx={index}
          data-css-timeline=""
          className="absolute inset-0"
          style={
            {
              "--beat-fade-start": `${range.start * 100}%`,
              "--beat-fade-in-end": `${fadeInEnd * 100}%`,
              "--beat-fade-out-start": `${fadeOutStart * 100}%`,
              "--beat-fade-end": `${range.end * 100}%`,
            } as React.CSSProperties
          }
        >
          {children}
        </div>
      </ChapterBeatNudgeContext.Provider>
    );
  }

  // Firefox / no-view-timeline path: drive opacity from Motion's scroll
  // progress directly.
  return (
    <ChapterBeatNudgeContext.Provider value={nudged}>
      <m.div
        data-beat-layer=""
        data-beat-layer-idx={index}
        className="absolute inset-0"
        style={{ opacity, y }}
      >
        {children}
      </m.div>
    </ChapterBeatNudgeContext.Provider>
  );
}

export const ChapterGroup = forwardRef(ChapterGroupImpl);
