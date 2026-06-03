import { useReducedMotion } from "motion/react";
import { type ReactNode, type RefObject, createContext, useContext, useRef } from "react";

type ChapterPinContextValue = {
  /** Ref to the outer pin section. Used by `useBeatIndex` to track scroll progress. */
  ref: RefObject<HTMLElement | null>;
  /** Number of beats declared on the container. 1 means single-pin chapter. */
  beats: number;
};

const ChapterPinContext = createContext<ChapterPinContextValue | null>(null);

/**
 * Read the chapter pin context published by `<ChapterContainer>`. Throws
 * when called outside the container so structural misuse is loud rather
 * than silently broken.
 */
export function useChapterPin(): ChapterPinContextValue {
  const ctx = useContext(ChapterPinContext);
  if (!ctx) {
    throw new Error("useChapterPin must be used inside <ChapterContainer>");
  }
  return ctx;
}

type Props = {
  /**
   * Pin-window length expressed in viewport heights, for single-pin
   * chapters. 1× yields no real pin (the sticky child fills its container
   * exactly); ≥1.5× yields an Apple-style scrubbable window. Recap subject
   * chapters historically targeted ~1.5–2×. Ignored when `beats > 1`.
   */
  pinViewports?: number;
  /**
   * Beat count for a multi-beat chapter (R-13). When `beats > 1`, the
   * outer section's height becomes `beats × beatViewports × 100dvh`
   * (overriding `pinViewports`), and a descendant `<ChapterBeats>` reads
   * scroll progress through this section to drive an active-beat index
   * across its `<ChapterBeat index>` slots. Default 1 (single-pin).
   */
  beats?: number;
  /**
   * Per-beat scroll distance in viewport heights when `beats > 1`. 0.6 is
   * the felt-right starting point from the R-13 scoping note — keeps a
   * 4-beat chapter at ~2.4× viewport scroll, comparable to two of the
   * older single-pin chapters. Tunable per chapter; eyeball during build.
   */
  beatViewports?: number;
  /** Optional `data-chapter` slug for selectors / debugging. */
  slug?: string;
  /** Optional ARIA label for the section landmark. */
  ariaLabel?: string;
  className?: string;
  /** Optional className applied to the sticky inner pin layer. */
  pinClassName?: string;
  children: ReactNode;
};

const DEFAULT_PIN_VIEWPORTS = 2;
const DEFAULT_BEAT_VIEWPORTS = 0.6;

/**
 * Sticky-pin wrapper for a recap chapter. The outer `<section>` is sized
 * to either `pinViewports × 100dvh` (single-pin) or
 * `beats × beatViewports × 100dvh` (multi-beat). Its `position: sticky`
 * child holds the viewport while the chapter is in the pin window.
 *
 * Pure layout primitive — reveal animations are owned by each band
 * (`ChapterReveal` / `whileInView`) or by `<ChapterBeat>` (crossfade
 * keyed on active-beat index). Earlier the container also published a
 * chapter-scoped progress MotionValue, but a coordinated progress signal
 * forced reveals to play even when the band's element was still
 * off-screen. Per-band visibility-triggered reveals fix that; multi-beat
 * chapters compose by stacking absolutely-positioned beats and switching
 * the active one rather than running shared progress through every band.
 *
 * Under reduced motion the pin collapses — outer height drops to `auto`,
 * the inner layer stops being sticky, and content stacks vertically with
 * normal page flow. Multi-beat chapters likewise flatten in that path
 * (handled inside `<ChapterBeats>`).
 */
export function ChapterContainer({
  pinViewports = DEFAULT_PIN_VIEWPORTS,
  beats = 1,
  beatViewports = DEFAULT_BEAT_VIEWPORTS,
  slug,
  ariaLabel,
  className,
  pinClassName,
  children,
}: Props) {
  const ref = useRef<HTMLElement | null>(null);
  const reducedMotion = useReducedMotion();

  // Floating-point multiplication on the beat-viewports knob can land on
  // values like 1.7999999999999998 — round to 4 decimals so the emitted
  // calc() reads cleanly in DevTools and CSS-inspector tooling.
  const rawViewports = beats > 1 ? beats * beatViewports : pinViewports;
  const totalViewports = Math.round(rawViewports * 10000) / 10000;

  const outerStyle = reducedMotion
    ? undefined
    : { height: `calc(${totalViewports} * 100dvh)` };
  const outerClass = ["relative w-full", className].filter(Boolean).join(" ");
  const pinClass = reducedMotion
    ? ["flex w-full flex-col gap-6", pinClassName].filter(Boolean).join(" ")
    : ["sticky top-0 flex h-dvh w-full flex-col gap-6", pinClassName]
        .filter(Boolean)
        .join(" ");

  return (
    <ChapterPinContext.Provider value={{ ref, beats }}>
      <section
        ref={ref}
        data-chapter={slug}
        data-pin={reducedMotion ? "off" : "on"}
        data-beats={beats > 1 ? beats : undefined}
        aria-label={ariaLabel}
        className={outerClass}
        style={outerStyle}
      >
        {/* Per-beat snap sentinels. One invisible row per beat, positioned
            at the scroll offset where the active-beat discretiser
            transitions to that beat. Combined with <main>'s
            `scroll-snap-type: y mandatory`, each beat becomes a settle
            point — wheel scrolls land on the nearest beat instead of
            mid-beat, and PageDown traverses chapter → beat → beat →
            next chapter instead of skipping the entire pin window.
            `scroll-snap-stop: always` is the same enforcement the outer
            chapter wrapper uses, applied to each internal beat so the
            user can't blast past a beat in one momentum scroll. Skipped
            under reduced motion (the pin collapses, so there's nothing
            to snap to) and on single-pin chapters.

            The discretiser partitions PROGRESS through the pin (scrolled
            / scroll-distance) into `beats` equal slices. In scroll terms
            that's `scrollDistance / beats` per beat, where
            scrollDistance is `(beats × beatViewports - 1) × 100dvh` —
            the section height minus one viewport. Sentinels positioned
            naively at `i × beatViewports × 100dvh` overshoot: a 4-beat
            chapter at 0.6 beatViewports has scrollDistance 140dvh and
            steps of 35dvh, not the 60dvh the naive formula gives. */}
        {!reducedMotion && beats > 1
          ? (() => {
              const scrollDvh = (beats * beatViewports - 1) * 100;
              if (scrollDvh <= 0) return null;
              const stepDvh = scrollDvh / beats;
              return Array.from({ length: beats }, (_, i) => {
                const topDvh = Math.round(i * stepDvh * 100) / 100;
                return (
                  <div
                    // biome-ignore lint/suspicious/noArrayIndexKey: stable per-render position
                    key={i}
                    aria-hidden="true"
                    data-beat-snap={i}
                    data-snap-top-dvh={topDvh}
                    className="pointer-events-none absolute left-0 right-0 h-px [scroll-snap-align:start] [scroll-snap-stop:always]"
                    style={{ top: `${topDvh}dvh` }}
                  />
                );
              });
            })()
          : null}
        <div data-chapter-pin className={pinClass}>
          {children}
        </div>
      </section>
    </ChapterPinContext.Provider>
  );
}
