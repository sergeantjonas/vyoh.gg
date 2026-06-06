import { type MotionValue, useMotionValue, useTransform } from "motion/react";
import { createContext, useContext } from "react";

/**
 * Per-beat scroll ranges, expressed as chapter-progress fractions [0..1].
 *
 * The chapter's overall scroll progress (0 at chapter top entering the
 * viewport, 1 at chapter unpinning) is partitioned into a sequence of
 * dwell zones (where the beat sits at its rest position) separated by
 * transition zones (where the horizontal track translates between two
 * dwells). For each beat:
 *
 * - `enterStart` → `dwellStart` is its enter transition.
 * - `dwellStart` → `dwellEnd` is its dwell zone.
 * - `dwellEnd` → `exitEnd` is its exit transition.
 *
 * Beat 0's `enterStart` is 0 (chapter pin = beat 0 already at rest); the
 * last beat's `exitEnd` is 1 (chapter unpins after the last dwell).
 */
export type BeatRange = {
  enterStart: number;
  dwellStart: number;
  dwellEnd: number;
  exitEnd: number;
};

export type ChapterMultiBeatContextValue = {
  /** Chapter's overall scroll progress, driven by Motion `useScroll`. */
  scrollYProgress: MotionValue<number>;
  beatCount: number;
  beatRanges: BeatRange[];
  /**
   * When true, derived beat-progress values short-circuit to static
   * "fully in dwell" constants. Beats render their dwell state without
   * scroll coupling.
   */
  reducedMotion: boolean;
};

export const ChapterMultiBeatContext = createContext<ChapterMultiBeatContextValue | null>(
  null
);

/**
 * Derive per-beat enter/dwell/exit ranges from the chapter's piecewise
 * stops array. `stops` is a flat `[dwellStart_0, dwellEnd_0, dwellStart_1,
 * dwellEnd_1, ...]` sequence of length `2 * beatCount` — the same sequence
 * the chapter's piecewise `useTransform` uses to drive horizontal-track
 * translation. The transition between beats `i` and `i + 1` lives between
 * `stops[2i + 1]` and `stops[2(i + 1)]`.
 *
 * Returns `[]` for `beatCount === 0`. Out-of-bounds stop accesses fall
 * back to safe defaults so a malformed stops array can't crash the hook.
 */
export function computeBeatRanges(stops: number[], beatCount: number): BeatRange[] {
  if (beatCount <= 0) return [];
  const ranges: BeatRange[] = [];
  for (let i = 0; i < beatCount; i += 1) {
    const dwellStart = stops[2 * i] ?? 0;
    const dwellEnd = stops[2 * i + 1] ?? 1;
    const enterStart = i === 0 ? 0 : (stops[2 * (i - 1) + 1] ?? 0);
    const exitEnd = i === beatCount - 1 ? 1 : (stops[2 * (i + 1)] ?? 1);
    ranges.push({ enterStart, dwellStart, dwellEnd, exitEnd });
  }
  return ranges;
}

export type BeatProgress = {
  /** Chapter's raw scroll-driven progress, exposed for custom transforms. */
  chapterProgress: MotionValue<number>;
  /**
   * 0 → 1 across this beat's enter transition. Clamped at 1 once dwell
   * starts (and beyond). Useful for entrance choreography that should
   * play once and stay settled — mask sweeps, slide-ins, kinetic type.
   */
  enterProgress: MotionValue<number>;
  /**
   * 0 → 1 across this beat's dwell zone. 0 before dwell, 1 after. Useful
   * for ambient effects that should activate only while the beat is the
   * focal one — subject-as-camera-dolly, breathing accent intensity.
   */
  dwellProgress: MotionValue<number>;
  /**
   * 0 → 1 across this beat's exit transition. 0 during dwell, 1 once
   * exited (and beyond). Useful for exit stings — accent sweeps, hard
   * cuts to the next beat.
   */
  exitProgress: MotionValue<number>;
  /**
   * 0 → 1 across the beat's full presence arc (enter + dwell + exit).
   * Useful for ambient loops that should run through the beat's
   * lifetime — slow parallax drifts, subtle background motion.
   */
  combinedProgress: MotionValue<number>;
  /** This beat's range, exposed for custom math. */
  range: BeatRange;
};

/**
 * Per-beat scroll-coupled progress values, derived from the parent
 * `<ChapterMultiBeat>`'s chapter-wide `scrollYProgress`. Use these to
 * drive parallax, mask reveals, subject dollies, and any motion that
 * should track the user's scroll position through this beat.
 *
 * For binary entrance triggers (`<ChapterReveal>` cascades), prefer
 * `useChapterBeatNudge()` — it fires once when the beat is the dominant
 * one and is the right primitive for cascade timing.
 *
 * Outside a `<ChapterMultiBeat>` (e.g. a beat rendered standalone in
 * tests) and under `prefers-reduced-motion`, every value is a constant
 * MotionValue at the "fully in dwell" state:
 *
 *   enterProgress=1, dwellProgress=0.5, exitProgress=0, combinedProgress=0.5
 *
 * So consumers can `useTransform(progress, ...)` unconditionally without
 * checking for context — they just get static end-state values.
 */
/**
 * Edge beats have `enterStart === dwellStart` (first beat) or
 * `dwellEnd === exitEnd` (last beat) because the chapter pin/unpin
 * lands them directly at their rest position with no transition zone.
 * Without a scroll runway, the enter/exit sweep happens instantaneously
 * at pin moment and is visually invisible — there's no scroll motion
 * to spread the animation across.
 *
 * We synthesize a transition range by carving the first / last
 * EDGE_TRANSITION_FRACTION of the beat's dwell into the
 * enter / exit progress. So a 14% dwell zone borrows ~18% of itself
 * (~2.5% of chapter scroll) for the entrance sweep, leaving the rest
 * for dwell. The borrowed fraction is felt as "the beat is settling
 * in" rather than as a separate transition zone.
 */
const EDGE_TRANSITION_FRACTION = 0.18;

export function useBeatProgress(beatIndex: number): BeatProgress {
  const context = useContext(ChapterMultiBeatContext);
  // Static fallback source for outside-context / reduced-motion. Always
  // created so hooks fire unconditionally; ignored when context provides
  // a real scrollYProgress.
  const fallbackSource = useMotionValue(0.5);
  const source = context?.scrollYProgress ?? fallbackSource;
  const reducedMotion = context?.reducedMotion ?? true;
  const range = context?.beatRanges[beatIndex] ?? {
    enterStart: 0,
    dwellStart: 0,
    dwellEnd: 1,
    exitEnd: 1,
  };

  // Resolve effective enter / exit stops. Edge beats with zero-length
  // transition zones (first beat: enterStart===dwellStart, last beat:
  // dwellEnd===exitEnd) borrow a fraction of their dwell so the
  // transition animation has somewhere to play.
  const dwellSpan = range.dwellEnd - range.dwellStart;
  const isFirstBeatEdge = range.enterStart === range.dwellStart;
  const isLastBeatEdge = range.dwellEnd === range.exitEnd;
  const enterEnd = isFirstBeatEdge
    ? range.dwellStart + dwellSpan * EDGE_TRANSITION_FRACTION
    : range.dwellStart;
  const exitStart = isLastBeatEdge
    ? range.dwellEnd - dwellSpan * EDGE_TRANSITION_FRACTION
    : range.dwellEnd;

  // In reduced-motion / outside-context mode, collapse each progress to
  // its dwell end-state by mapping the entire [0,1] source range to a
  // single constant. This keeps hooks unconditional while producing
  // motionless output.
  const enterStops: [number, number] = reducedMotion
    ? [0, 1]
    : [range.enterStart, enterEnd];
  const enterValues: [number, number] = reducedMotion ? [1, 1] : [0, 1];
  const enterProgress = useTransform(source, enterStops, enterValues, {
    clamp: true,
  });

  const dwellStops: [number, number] = reducedMotion
    ? [0, 1]
    : [range.dwellStart, range.dwellEnd];
  const dwellValues: [number, number] = reducedMotion ? [0.5, 0.5] : [0, 1];
  const dwellProgress = useTransform(source, dwellStops, dwellValues, {
    clamp: true,
  });

  const exitStops: [number, number] = reducedMotion ? [0, 1] : [exitStart, range.exitEnd];
  const exitValues: [number, number] = reducedMotion ? [0, 0] : [0, 1];
  const exitProgress = useTransform(source, exitStops, exitValues, {
    clamp: true,
  });

  const combinedStops: [number, number] = reducedMotion
    ? [0, 1]
    : [range.enterStart, range.exitEnd];
  const combinedValues: [number, number] = reducedMotion ? [0.5, 0.5] : [0, 1];
  const combinedProgress = useTransform(source, combinedStops, combinedValues, {
    clamp: true,
  });

  return {
    chapterProgress: source,
    enterProgress,
    dwellProgress,
    exitProgress,
    combinedProgress,
    range,
  };
}
