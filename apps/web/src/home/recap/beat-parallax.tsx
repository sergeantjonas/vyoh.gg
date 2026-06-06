import { type MotionStyle, m, useTransform } from "motion/react";
import type { CSSProperties, ReactNode } from "react";

import { useBeatProgress } from "./use-beat-progress";

type Props = {
  /** Beat index this layer belongs to. Drives scroll-coupled motion via `useBeatProgress`. */
  beatIndex: number;
  /**
   * Depth tier in the parallax stack. Higher = closer to the viewer =
   * moves further on scroll. Matches the choreography toolkit's "≥3
   * layers per beat" rule (background / midground / foreground).
   *
   * - `1` background: subtle scale during dwell, minimal y-drift across the
   *   beat's lifetime. Use for splash anchors and ambient texture.
   * - `2` midground: medium y-drift on enter/exit, no scale. Use for
   *   accent shapes, geometric forms, secondary content.
   * - `3` foreground: full y-drift on enter/exit. Use for headline copy,
   *   focal cards, hero subjects.
   */
  depth: 1 | 2 | 3;
  /**
   * Total y-drift in pixels for a foreground (depth=3) layer across one
   * transition. Depth 2 moves half this, depth 1 a quarter. Defaults to
   * 80px which reads as confident editorial drift at 1440px viewports
   * without disturbing the reading column.
   */
  yRange?: number;
  /**
   * Scale delta at peak dwell for depth=1 layers. Depth 2 and 3 ignore
   * this — only the background layer carries ambient zoom. 0.04 is a
   * subtle 4% peak scale that reads as breathing without distorting art.
   */
  scaleDelta?: number;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
};

/**
 * Scroll-coupled parallax layer for use inside a `<MultiBeat>`. Reads
 * the beat's enter/dwell/exit progress from `useBeatProgress` and emits
 * an `<m.div>` with derived `y` and `scale` transforms.
 *
 * Motion vocabulary by depth:
 *
 * - Depth 1 (background): y drifts gently across the beat's full
 *   lifetime (`combinedProgress`); scale ramps up during dwell only.
 *   Reads as a slow camera dolly settling into the focal moment.
 * - Depth 2 (midground): y rises into place on enter, holds, drifts
 *   away on exit. Half the y magnitude of depth 3.
 * - Depth 3 (foreground): y rises into place on enter, holds, drifts
 *   away on exit. Full y magnitude.
 *
 * Stack ≥3 of these per beat (1 background + 1+ midground + 1+
 * foreground) to satisfy the "layered parallax stack" toolkit primitive.
 *
 * Under `prefers-reduced-motion` (or outside a `<ChapterMultiBeat>`),
 * `useBeatProgress` returns static end-state values, so this layer
 * renders motionless without any branch here. The `m.div` is preserved
 * (not swapped to a plain `div`) so consumer styles still compose.
 */
export function BeatParallaxLayer({
  beatIndex,
  depth,
  yRange = 80,
  scaleDelta = 0.04,
  className,
  style,
  children,
}: Props) {
  const { enterProgress, exitProgress, dwellProgress, combinedProgress } =
    useBeatProgress(beatIndex);

  // Depth multiplier on y: foreground full magnitude, midground half,
  // background quarter. Ratios chosen so a 3-layer stack reads with
  // visible depth without any one layer disturbing the focal content.
  const depthMultiplier = depth === 1 ? 0.25 : depth === 2 ? 0.5 : 1;

  // Background layers use `combinedProgress` for a slow continuous
  // drift across the beat's lifetime — reads as a camera dolly through
  // the focal moment. Midground and foreground use enter/exit so they
  // settle into a stable rest position during dwell.
  const yForeground = useTransform(
    [enterProgress, exitProgress],
    ([enter, exit]) =>
      yRange * depthMultiplier * (1 - (enter as number)) -
      yRange * depthMultiplier * (exit as number)
  );
  const yBackground = useTransform(
    combinedProgress,
    [0, 1],
    [yRange * depthMultiplier * 0.5, -yRange * depthMultiplier * 0.5]
  );
  const y = depth === 1 ? yBackground : yForeground;

  // Only depth 1 receives ambient scale. Depth 2/3 stay at scale 1 so
  // their content isn't subtly distorted during dwell — important for
  // text and 3D card surfaces that read worst when nominally-static
  // elements have a slow zoom.
  const scale = useTransform(
    dwellProgress,
    [0, 1],
    [1, depth === 1 ? 1 + scaleDelta : 1]
  );

  const motionStyle: MotionStyle = { ...(style as MotionStyle), y, scale };

  return (
    <m.div data-beat-parallax-depth={depth} className={className} style={motionStyle}>
      {children}
    </m.div>
  );
}
