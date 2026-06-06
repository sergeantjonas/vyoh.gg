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
 * The chrome is positioned absolutely inside the stage (`overflow:
 * hidden` clips overflow). z-index 10 sits below the masthead's z-20
 * but above the track. Top-right corner — bottom-right is taken by the
 * global `ScrollToTop` button in `__root.tsx`, which would collide and
 * obscure the dot row. Top-right also reads as the opposite corner to
 * the left-aligned masthead reading column, which lands as a magazine
 * spread page-number annotation. `top-4 right-6` keeps it clear of the
 * page-level sticky nav (~52px at the top of `<main>`).
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
      // Top-right anchors it opposite the masthead reading column;
      // bottom-right is reserved for the global ScrollToTop button.
      className="pointer-events-none absolute top-4 right-6 z-10 flex flex-col items-end gap-2 select-none sm:top-6 sm:right-10"
    >
      <ul aria-hidden="true" className="flex items-center gap-1.5">
        {Array.from({ length: beatCount }, (_, i) => (
          <li
            // biome-ignore lint/suspicious/noArrayIndexKey: beat index is the stable identity here
            key={i}
            data-active={i === activeBeat ? "" : undefined}
            // Active dot fills with accent; inactive ones are outlined at
            // low opacity so they stay legible against bright splash
            // crops without dominating. Smooth color transition (no
            // motion required) makes the active flip read as a flicker
            // rather than a jump.
            className={[
              "h-1.5 w-1.5 rounded-full border border-foreground/40 transition-colors duration-200",
              i === activeBeat
                ? "border-[var(--accent,currentColor)] bg-[var(--accent,currentColor)]"
                : "bg-transparent",
            ].join(" ")}
          />
        ))}
      </ul>
      <p
        className="text-[10px] font-medium uppercase tracking-[0.3em] text-foreground/70"
        // Mirror the editorial body shadow used elsewhere in the chapter
        // so the chrome reads against any splash without a backdrop
        // chip. Hardcoded inline since this file doesn't import the
        // chapter shadows module.
        style={{
          textShadow:
            "0 0 0 rgba(0,0,0,0.95), 0 0 4px rgba(0,0,0,0.7), 0 1px 8px rgba(0,0,0,0.5)",
        }}
      >
        <span aria-hidden="true">Beat </span>
        <span className="tabular-nums">{pad(activeBeat + 1)}</span>
        <span className="text-foreground/40"> / </span>
        <span className="tabular-nums text-foreground/40">{pad(beatCount)}</span>
        <span className="sr-only">
          Beat {activeBeat + 1} of {beatCount}
        </span>
      </p>
    </div>
  );
}
