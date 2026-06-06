import { m } from "motion/react";

import { useChapterBeatNudge } from "./chapter-group";

type Props = {
  /** Beat this slash belongs to. Drives sweep timing via `useBeatProgress`. */
  beatIndex: number;
  /**
   * Slash length. Tailwind `w-*` or a raw CSS value. Defaults to a
   * confident editorial length that reads well next to body copy at
   * `text-base`/`text-lg`. Override via className for per-beat fit.
   */
  width?: string;
  /** Slash thickness in pixels. Fine editorial weight by default. */
  thicknessPx?: number;
  /** Skew angle for the editorial italic feel. */
  skewDeg?: number;
  /**
   * Direction the slash sweeps in from. The opposite edge becomes its
   * exit direction — left-entering slashes drift right on exit.
   */
  from?: "left" | "right";
  /**
   * Seconds to wait after the beat is nudged before drawing the slash.
   * Use to sequence the slash AFTER the beat's text content has settled
   * into place — the slash reads as an editorial flourish landing on
   * already-readable copy, not as a competing element animating over
   * blurred / settling text. Typical value: (surrounding prose's
   * ChapterReveal delay + duration + a small settle). Exit retraction
   * is always immediate (no delay) so the slash doesn't linger when
   * the beat scrolls out.
   */
  delay?: number;
  className?: string;
};

/**
 * Editorial accent slash — a short skewed bar that *draws itself in
 * place* when its beat becomes the dominant one. Picks up the chapter's
 * `--accent` by default. Use as a magazine-spread separator above
 * headlines or between content blocks.
 *
 * Motion vocabulary: `scaleX(0)` → `scaleX(1)` anchored at the
 * consumer-specified edge via `transform-origin`. The effect reads as
 * ink being drawn along the slash's length — `from="left"` draws
 * left → right, `from="right"` draws right → left. Triggered by the
 * binary `useChapterBeatNudge()` signal (same trigger
 * `<ChapterReveal>` uses for prose entrance), so the animation runs on
 * time rather than coupled to scroll position.
 *
 * Why time-driven rather than scroll-coupled: the slash needs to appear
 * in place when the beat becomes focal, regardless of whether the user
 * has scrolled inside the beat yet. For an edge beat (first / last) the
 * scroll-coupled approach has zero runway at the moment of pin and the
 * slash would either be invisible (no scroll yet) or require the user to
 * scroll past the beat boundary just to see the entrance. Time-driven
 * animation runs once on nudge and stays settled. A horizontal-carousel
 * chapter also has the user's scroll already mapped to track translation;
 * a scroll-coupled slash sweep would cross the path of outgoing beats
 * moving leftward, which reads as visual chaos.
 *
 * Layout: in-flow block by default. Consumer can absolutely position via
 * className. `aria-hidden` because the slash is purely decorative; the
 * editorial chrome handles the assistive text register.
 *
 * Outer wrapper carries Motion's scaleX + opacity tween via the
 * `animate` variant target with `transform-origin` set in CSS. Inner div
 * carries the static CSS skew so the compositor doesn't fight a
 * multi-transform string on one element.
 *
 * Reduced motion / outside-context: `useChapterBeatNudge()` defaults to
 * `false` outside a beat context, and Motion respects `prefers-reduced-
 * motion` by collapsing transitions to instant — so the slash renders
 * at its initial/animate end state without an animated transition.
 */
export function BeatAccentSlash({
  beatIndex: _beatIndex,
  width = "14rem",
  thicknessPx = 2,
  skewDeg = -14,
  from = "left",
  delay = 0,
  className,
}: Props) {
  const nudged = useChapterBeatNudge();

  // Anchor edge: scaleX grows from `from`. We use a single
  // transform-origin for the lifecycle — the exit fade hides any visual
  // asymmetry that anchoring entry and exit on the same side would
  // otherwise produce.
  const transformOrigin = from === "left" ? "left center" : "right center";

  // Variants give asymmetric timing: entrance is delayed so the slash
  // lands after the beat's text content has settled; exit is immediate
  // so the slash doesn't linger when the beat scrolls out.
  const variants = {
    hidden: {
      scaleX: 0,
      opacity: 0,
      transition: { duration: 0.3, ease: "easeIn" as const },
    },
    visible: {
      scaleX: 1,
      opacity: 1,
      transition: {
        scaleX: {
          duration: 0.7,
          delay,
          ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
        },
        opacity: { duration: 0.4, delay, ease: "easeOut" as const },
      },
    },
  };

  return (
    <m.div
      data-beat-accent-slash=""
      aria-hidden="true"
      className={["pointer-events-none", className].filter(Boolean).join(" ")}
      style={{ width, transformOrigin }}
      initial="hidden"
      animate={nudged ? "visible" : "hidden"}
      variants={variants}
    >
      <div
        style={{
          width: "100%",
          height: `${thicknessPx}px`,
          background: "var(--accent, currentColor)",
          transform: `skewX(${skewDeg}deg)`,
          // A subtle accent drop-shadow gives the slash editorial weight
          // against bright splash backgrounds. The tint matches the slash
          // color, so it reads as a tracked outline rather than a halo.
          boxShadow: "0 1px 0 rgba(0,0,0,0.5)",
        }}
      />
    </m.div>
  );
}
