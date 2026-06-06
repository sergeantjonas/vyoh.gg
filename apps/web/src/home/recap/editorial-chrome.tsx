import {
  m,
  motionValue,
  useMotionValue,
  useMotionValueEvent,
  useTransform,
} from "motion/react";
import { Fragment, useContext, useEffect, useRef, useState } from "react";

import { mainScrollRef } from "@/lib/scroll-container";

import { type BeatRange, ChapterMultiBeatContext } from "./use-beat-progress";

// Hooks must fire unconditionally; `useMotionValueEvent` takes a
// MotionValue. When no chapter context is mounted, we feed it this
// module-singleton sentinel so the hook is still legal — but the
// listener early-returns before doing any work, and the chrome itself
// returns null. Module-singleton so all chrome instances share it.
const FALLBACK_PROGRESS = motionValue(0);

/**
 * Pure helper — pick the dominant beat for the given chapter progress.
 * Beat `i` becomes dominant once progress crosses the midpoint of its
 * enter transition `(enterStart + dwellStart) / 2`. Iterates from the
 * top down so the highest matching index wins, which matches the
 * scroll-direction semantics (forward scroll advances; backward returns).
 *
 * Exported so the listener and the lazy-init state both share one rule.
 */
function pickActiveBeat(progress: number, ranges: BeatRange[]): number {
  for (let i = ranges.length - 1; i >= 0; i -= 1) {
    const range = ranges[i];
    if (!range) continue;
    const enterMid = (range.enterStart + range.dwellStart) / 2;
    if (progress >= enterMid) return i;
  }
  return 0;
}

/**
 * Persistent editorial chrome rendered once per multi-beat chapter.
 * Mounted in the chapter's sticky stage by `<ChapterMultiBeat>` — not
 * per-beat. Vertical beat index (magazine table-of-contents register):
 *
 * - Each beat number stacks vertically inside a small backdrop chip.
 * - Active beat is enlarged + accent-tinted.
 * - A growing tail line below the active beat fills as the user
 *   scrolls through that beat's `[enterStart, exitEnd]` span,
 *   pointing toward the next beat number. The tail line is the only
 *   live element — non-active numbers stack quietly below.
 * - All numbers are clickable buttons that smooth-scroll to that
 *   beat's dwell midpoint (same navigation pattern the prior horizontal
 *   dot chrome used).
 *
 * Why a vertical index instead of the prior dots + horizontal progress
 * bar: dots-only conveyed position but no progress; the masthead
 * progress line conveyed progress but read as out-of-place chrome
 * floating under the masthead. The vertical index combines both into
 * one editorial element — the active beat's tail line is the live
 * progress signal, sitting in the same chrome that already conveyed
 * position.
 *
 * Chrome fades with `scrollYProgress` (0→0.03 fade in, 0.97→1 fade
 * out) so it doesn't persist into the next chapter as the sticky stage
 * exits upward.
 *
 * Position: bottom-left corner of the stage. Bottom-right is the
 * global `ScrollToTop`, bottom-center is the `NextChapterCaret`;
 * bottom-left mirrors ScrollToTop without competing with the
 * left-aligned masthead reading column.
 */
export function EditorialChrome() {
  const context = useContext(ChapterMultiBeatContext);
  const chromeRef = useRef<HTMLDivElement | null>(null);

  // Lazy init: pick active beat from the current scrollYProgress on
  // mount. Without this, the chrome lags one update behind on SPA
  // navigation or any mid-scroll mount until the next change event
  // fires.
  const [activeBeat, setActiveBeat] = useState(() =>
    context ? pickActiveBeat(context.scrollYProgress.get(), context.beatRanges) : 0
  );

  // Hard visibility gate. The opacity-via-scrollYProgress fade and an
  // "is section anywhere in viewport" check both failed: during the
  // chapter's exit transition (sticky Phase 3, after the stage has
  // bottomed-out), the section is still partially in viewport while
  // its bottom edge drags the stage — and the chrome inside it —
  // upward through the viewport. Owner confirmed this happens on
  // Chrome AND Safari (Firefox unaffected; Firefox uses Motion's rAF
  // fallback for useScroll which apparently doesn't reproduce this).
  //
  // Correct gate: chrome is visible ONLY while the section is in its
  // STICKY-PIN range — section.top has reached or passed main.top
  // AND section.bottom hasn't crossed above main.bottom yet. Outside
  // that range (before pin: section is below viewport, OR after pin:
  // section's bottom has scrolled above main.bottom = stage has
  // bottomed-out + is scrolling upward), chrome hides.
  //
  // TOP-side tolerance (TOP_PIN_TOLERANCE_PX): when the
  // next-chapter caret lands the user at the chapter's outer-top, the
  // page nav above main shrinks ~8px as scroll settles, leaving the
  // section.top sitting a few pixels below main.top. With strict
  // equality (`section.top <= main.top`), the gate returns false at
  // landing and the chrome only appears after the user scrolls
  // further (passed through the small landing gap). A small tolerance
  // (~32px — wider than observable nav shrink, well below the half-
  // viewport boundary that would false-positive into the next
  // chapter) absorbs the landing offset, scroll-padding/snap-margin,
  // and sub-pixel rounding without re-introducing the exit-side bug.
  // BOTTOM side stays strict because that was the original bug.
  //
  // rAF polling reads positions every paint frame regardless of
  // scroll-event delivery cadence; inline `display: none` wins over
  // any CSS class ordering or engine sticky quirk.
  const [chapterInViewport, setChapterInViewport] = useState(true);
  useEffect(() => {
    const TOP_PIN_TOLERANCE_PX = 32;
    let raf = 0;
    const tick = () => {
      const chrome = chromeRef.current;
      const main = mainScrollRef.current;
      if (chrome && main) {
        const section = chrome.closest<HTMLElement>("[data-chapter-multi-beat]");
        if (section) {
          const sectionRect = section.getBoundingClientRect();
          const mainRect = main.getBoundingClientRect();
          const inPinRange =
            sectionRect.top <= mainRect.top + TOP_PIN_TOLERANCE_PX &&
            sectionRect.bottom >= mainRect.bottom;
          setChapterInViewport((prev) => (prev === inPinRange ? prev : inPinRange));
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Local progress within the active beat's span [enterStart, exitEnd].
  // Drives the connecting tail-line below the active number. Hand-set
  // via the change listener rather than a useTransform stop set — the
  // active beat (and therefore the relevant range) changes mid-scroll,
  // which a static useTransform stops array can't reflect.
  const activeBeatProgress = useMotionValue(0);

  useMotionValueEvent(
    // Always subscribe to a MotionValue so hooks fire unconditionally —
    // we just no-op the update when context is missing.
    context?.scrollYProgress ?? FALLBACK_PROGRESS,
    "change",
    (progress) => {
      if (!context) return;
      const next = pickActiveBeat(progress, context.beatRanges);
      setActiveBeat((prev) => (prev === next ? prev : next));
      const range = context.beatRanges[next];
      if (range) {
        const span = range.exitEnd - range.enterStart;
        const local = span > 0 ? (progress - range.enterStart) / span : 0;
        activeBeatProgress.set(Math.max(0, Math.min(1, local)));
      }
    }
  );

  // Chrome fades with the chapter's scroll progress so it doesn't
  // persist into the next chapter as the sticky stage exits upward.
  const opacity = useTransform(
    context?.scrollYProgress ?? FALLBACK_PROGRESS,
    [0, 0.03, 0.97, 1],
    [0, 1, 1, 0]
  );

  // Compute the main scrollTop that puts beat `i`'s dwell midpoint at
  // the chapter's pin position, then smooth-scroll there. Mirrors the
  // section/progress math Motion's `useScroll({ offset: ["start
  // start", "end end"] })` uses inside `<ChapterMultiBeat>`.
  const navigateToBeat = (beatIndex: number) => {
    if (!context) return;
    const range = context.beatRanges[beatIndex];
    if (!range) return;
    const chrome = chromeRef.current;
    if (!chrome) return;
    const chapterSection = chrome.closest<HTMLElement>("[data-chapter-multi-beat]");
    const main = mainScrollRef.current;
    if (!chapterSection || !main) return;
    const sectionRect = chapterSection.getBoundingClientRect();
    const sectionTopInMain = sectionRect.top + main.scrollTop;
    const dwellMid = (range.dwellStart + range.dwellEnd) / 2;
    const targetScroll =
      sectionTopInMain + dwellMid * (sectionRect.height - main.clientHeight);
    main.scrollTo({ top: targetScroll, behavior: "smooth" });
  };

  if (!context) return null;
  const { beatCount } = context;
  if (beatCount === 0) return null;

  const pad = (n: number) => (n < 10 ? `0${n}` : String(n));

  return (
    <m.div
      ref={chromeRef}
      data-editorial-chrome=""
      // Outer wrapper is `pointer-events-none` so static chrome doesn't
      // intercept clicks falling toward the beat content. The number
      // buttons inside re-enable pointer events on themselves. The
      // IntersectionObserver-driven `hidden` class is the WebKit-safe
      // hard hide once the chapter exits viewport; opacity handles the
      // soft fade at the boundaries for engines that report progress
      // cleanly.
      className="pointer-events-none absolute bottom-4 left-6 z-10 select-none sm:bottom-6 sm:left-10"
      // Inline `display: none` when chapter is out of viewport wins
      // over any CSS class ordering and engine-specific sticky quirks.
      style={{
        opacity,
        display: chapterInViewport ? undefined : "none",
      }}
    >
      <div
        // biome-ignore lint/a11y/useSemanticElements: <fieldset> is for form-control groups; this is a navigation button group
        role="group"
        aria-label="Beat navigation"
        className="flex flex-col items-center rounded-md bg-black/30 px-3 py-2 backdrop-blur-md"
      >
        {Array.from({ length: beatCount }, (_, i) => {
          const isActive = i === activeBeat;
          return (
            <Fragment
              // biome-ignore lint/suspicious/noArrayIndexKey: beat index is the stable identity
              key={i}
            >
              <button
                type="button"
                onClick={() => navigateToBeat(i)}
                aria-label={`Go to beat ${i + 1} of ${beatCount}`}
                aria-current={isActive ? "true" : undefined}
                data-active={isActive ? "" : undefined}
                // Active beat: enlarged, accent-tinted, bold. Inactive:
                // small, dim, monospace. Transitions tween between
                // states when active beat changes.
                className={[
                  "pointer-events-auto cursor-pointer tabular-nums font-medium transition-all duration-300 ease-out focus-visible:outline-2 focus-visible:outline-white/80 focus-visible:outline-offset-2",
                  isActive
                    ? "text-2xl font-bold leading-none text-[var(--accent,white)]"
                    : "text-[11px] leading-none text-white/55 hover:text-white/85",
                ].join(" ")}
              >
                {pad(i + 1)}
              </button>
              {/* Tail line below the active beat, scaleY tied to local
                  progress within that beat's [enterStart, exitEnd] span.
                  Only the active beat renders a tail — inactive beats
                  stack quietly without connectors. When the active beat
                  changes, the tail moves to the new active beat (its
                  scaleY starts at ~0 because local progress is small at
                  the new beat's enter point). Last beat has no next, so
                  no tail. */}
              {isActive && i < beatCount - 1 ? (
                <m.div
                  aria-hidden="true"
                  className="my-2 w-px origin-top bg-[var(--accent,white)]"
                  style={{
                    height: "1.5rem",
                    scaleY: activeBeatProgress,
                  }}
                />
              ) : null}
            </Fragment>
          );
        })}
      </div>
      <p className="sr-only">
        Beat {activeBeat + 1} of {beatCount}
      </p>
    </m.div>
  );
}
