import { motionValue, useMotionValueEvent } from "motion/react";
import { useContext, useState } from "react";

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
 * per-beat. Two pieces of magazine-spread chrome:
 *
 * - "BEAT 02 / 04" page marker, small uppercase tracking, in the
 *   bottom-right of the stage. The number updates as the user scrolls
 *   through beats; the active beat is whichever beat's enter midpoint
 *   has been passed most recently.
 * - A row of dot indices above the marker, one per beat, with the
 *   active one filled and the others outlined. Gives the reader a
 *   spatial sense of where they are in the chapter without needing to
 *   read a fraction.
 *
 * Active beat detection: scrollYProgress is mapped against each beat's
 * enter midpoint `(enterStart + dwellStart) / 2`. The first beat
 * activates immediately on chapter pin (its enter midpoint is at most
 * `dwellStart/2`). Subsequent beats activate half-way through their
 * transition from the previous beat — the moment the new beat takes
 * over visually is when the chrome flips.
 *
 * Renders nothing outside `<ChapterMultiBeatContext>`, so the same
 * component is safe to import without an extra mount-side guard.
 *
 * The chrome is positioned absolutely inside the stage. z-index 10
 * sits below the masthead's z-20 but above the track. Bottom-left
 * corner — bottom-right is taken by the global `ScrollToTop` button
 * in `__root.tsx`, and bottom-center is the `NextChapterCaret` click
 * target. Bottom-left mirrors ScrollToTop on the opposite edge and
 * doesn't compete with the masthead reading column for visual weight.
 */
export function EditorialChrome() {
  const context = useContext(ChapterMultiBeatContext);
  // Lazy init: pick active beat from the current scrollYProgress on
  // mount. Without this, the chrome lags one update behind on SPA
  // navigation or any mid-scroll mount until the next change event
  // fires. `useState`'s lazy initializer runs once, perfect for this.
  const [activeBeat, setActiveBeat] = useState(() =>
    context ? pickActiveBeat(context.scrollYProgress.get(), context.beatRanges) : 0
  );

  useMotionValueEvent(
    // Always subscribe to a MotionValue so hooks fire unconditionally —
    // we just no-op the update when context is missing. The fallback is
    // never realistically read because `context === null` early-returns
    // before mount; this keeps the rule-of-hooks check tidy.
    context?.scrollYProgress ?? FALLBACK_PROGRESS,
    "change",
    (progress) => {
      if (!context) return;
      const next = pickActiveBeat(progress, context.beatRanges);
      setActiveBeat((prev) => (prev === next ? prev : next));
    }
  );

  if (!context) return null;
  const { beatCount } = context;
  if (beatCount === 0) return null;

  // Pad single-digit beat numbers for editorial consistency. Two-digit
  // chapters are vanishingly rare in this design (4-beat ceiling per the
  // arc note's standing rule), so the formatter doesn't need to handle
  // three digits.
  const pad = (n: number) => (n < 10 ? `0${n}` : String(n));

  return (
    <div
      data-editorial-chrome=""
      // pointer-events-none so the chrome never intercepts clicks on
      // beat content beneath it. The marker is purely decorative.
      // Bottom-left mirrors the global ScrollToTop (bottom-right) on
      // the opposite corner; bottom-center is the NextChapterCaret.
      className="pointer-events-none absolute bottom-4 left-6 z-10 select-none sm:bottom-6 sm:left-10"
    >
      {/*
        Small backdrop chip. The earlier text-shadow-only approach
        rendered as a black smudge on bright splash crops (Pragmata)
        because the white text fill at low opacity was invisible while
        the shadow halos remained visible. A subtle chip with
        backdrop-blur gives every splash a consistent dark base for the
        chrome to render against, so the text+dots stay legible on
        bright, dark, busy, and clean backgrounds alike. Sized small
        enough that it reads as magazine-spread page chrome rather
        than UI module.
      */}
      <div className="flex flex-col items-center gap-1.5 rounded-md bg-black/30 px-2.5 py-1.5 backdrop-blur-md">
        <ul aria-hidden="true" className="flex items-center gap-1.5">
          {Array.from({ length: beatCount }, (_, i) => (
            <li
              // biome-ignore lint/suspicious/noArrayIndexKey: beat index is the stable identity here
              key={i}
              data-active={i === activeBeat ? "" : undefined}
              // Active dot fills with accent; inactive ones are outlined
              // against the chip's dark backdrop so they stay legible
              // without needing extra contrast tricks. Smooth color
              // transition makes the active flip read as a flicker
              // rather than a jump.
              className={[
                "h-1.5 w-1.5 rounded-full border border-white/55 transition-colors duration-200",
                i === activeBeat
                  ? "border-[var(--accent,currentColor)] bg-[var(--accent,currentColor)]"
                  : "bg-transparent",
              ].join(" ")}
            />
          ))}
        </ul>
        <p className="text-[10px] font-medium uppercase tracking-[0.25em] text-white/85">
          {/*
            Magazine-style page indicator — number only, no label.
            "Beat" was internal developer vocabulary (unit of content
            within a chapter); not the right register for the reader.
            sr-only carries the readable phrase for assistive tech.
          */}
          <span className="tabular-nums">{pad(activeBeat + 1)}</span>
          <span className="px-1 text-white/45">/</span>
          <span className="tabular-nums text-white/55">{pad(beatCount)}</span>
          <span className="sr-only">
            Beat {activeBeat + 1} of {beatCount}
          </span>
        </p>
      </div>
    </div>
  );
}
