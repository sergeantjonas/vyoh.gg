import { m, useTransform } from "motion/react";

import { useBeatProgress } from "./use-beat-progress";

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
  className?: string;
};

/**
 * Editorial accent slash — a short skewed bar that sweeps in from one
 * viewport edge as a beat enters, holds during dwell, and drifts off
 * toward the opposite edge on exit. Picks up the chapter's `--accent`
 * by default. Use as a magazine-spread separator above headlines or
 * between content blocks.
 *
 * This is the "mask reveal" primitive from the choreography toolkit
 * applied in decorative form — the slash itself is the moving mask,
 * even though it doesn't currently clip-path other content. (A future
 * variant could expose a `clip-path` mode that reveals children as the
 * slash sweeps; for now the decorative form lands the editorial weight
 * without the cross-engine cost of animated clip-paths.)
 *
 * Layout: in-flow block by default. Consumer can absolutely position via
 * className. `aria-hidden` because the slash is purely decorative; the
 * editorial chrome handles the assistive text register.
 *
 * Motion vocabulary: a long enter sweep (0% → 100% of enterProgress),
 * still through dwell, then a quieter exit drift (0% → 40% of
 * exitProgress * end vector) so the slash doesn't dominate the
 * outgoing beat. Opacity fades up on enter and slightly down on exit
 * for a softer disappearance.
 *
 * Reduced motion / outside-context: `useBeatProgress` returns static
 * end-state values, so the slash renders at its in-place rest position
 * without animation.
 */
export function BeatAccentSlash({
  beatIndex,
  width = "14rem",
  thicknessPx = 2,
  skewDeg = -14,
  from = "left",
  className,
}: Props) {
  const { enterProgress, exitProgress } = useBeatProgress(beatIndex);

  // Enter from off-screen (`-110%` / `+110%`) → 0; exit drifts at
  // reduced magnitude in the opposite direction so the slash doesn't
  // get pulled fully off-screen mid-exit (would look like a glitch).
  const startPercent = from === "left" ? -110 : 110;
  const exitDriftPercent = from === "left" ? 28 : -28;
  const xPercent = useTransform(
    [enterProgress, exitProgress],
    ([enter, exit]) =>
      `${startPercent * (1 - (enter as number)) + exitDriftPercent * (exit as number)}%`
  );

  const opacity = useTransform([enterProgress, exitProgress], ([enter, exit]) =>
    Math.max(0, Math.min(1, enter as number) - (exit as number) * 0.55)
  );

  return (
    // Outer wrapper carries Motion's x/opacity; inner div carries the
    // static CSS skew so the two transforms don't fight. Without the
    // split, Motion's `style.x` (a CSS `transform: translateX(...)`)
    // would overwrite the inner skew or vice-versa.
    <m.div
      data-beat-accent-slash=""
      aria-hidden="true"
      className={["pointer-events-none origin-left", className].filter(Boolean).join(" ")}
      style={{ x: xPercent, opacity, width }}
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
