import { m } from "motion/react";
import type * as React from "react";
import { useEffect, useId, useState } from "react";

import { cn } from "@/lib/utils";

import { SHADOW_LABEL, STROKE_LABEL } from "./chapter-shadows";

interface UnlocksPerWeekBandProps extends Omit<React.ComponentProps<"div">, "children"> {
  /**
   * Per-week unlock counts oldest-first, ending at the current Brussels
   * calendar week. Sourced from `SteamGameRecap.unlocksPerWeek`. The band
   * renders nothing when the series has fewer than 2 entries — a one-point
   * line has no shape, and a zero-length series means there's no recent
   * unlock activity worth showing.
   */
  data: readonly number[];
  /**
   * When true, the line draws on (left-to-right pathLength animation).
   * Default false — outside any chapter context the band renders static
   * end-state. Wire to the beat's `nudged` flag in the chapter consumer
   * so the line draws as the beat activates.
   */
  active?: boolean;
}

const VIEWBOX_WIDTH = 100;
const VIEWBOX_HEIGHT = 24;

/**
 * Sparkline header band for beat 1 of a Steam multi-beat chapter — plots
 * `unlocksPerWeek` (oldest-first, right-anchored at the current Brussels
 * week) as a filled area with a 1px top stroke. Width is responsive
 * (`100%`) so the band stretches to the beat's reading column; height is
 * fixed at 32px so the visual weight stays in the "band/eyebrow" register
 * and doesn't compete with the recent-unlock rows below.
 *
 * Why a band primitive rather than reusing the inline `<Sparkline>`: the
 * inline sparkline is sized for a 48×12 sliver next to a label (used in
 * library rows, match rows, rank trajectory). A header band needs full
 * content-width, a filled area for shape recognition at small heights, and
 * left/right end caps so the reader can locate the endpoints quickly. Both
 * primitives stay focused — inline for in-row context, band for in-chapter
 * editorial use.
 *
 * Zero-state: returns `null` when `data.length < 2`. The chapter wire-up
 * may also choose to skip rendering at all in that case; this is the
 * defense-in-depth layer.
 *
 * Reduced motion: the band is purely static SVG — no animation to gate.
 * The chapter's own ChapterReveal wrap (in `steam-chapter.tsx`) governs
 * the band's entrance.
 */
export function UnlocksPerWeekBand({
  data,
  active = true,
  className,
  ...rest
}: UnlocksPerWeekBandProps) {
  // Latch — once active flips true, stay drawn even if the parent toggles
  // it false later (beat scrolled past). This prevents the line from
  // un-drawing on backwards scroll, which reads as jittery. `useState`
  // initial captures the initial active value so a standalone consumer
  // (no chapter wrap) renders fully drawn immediately.
  const [hasDrawn, setHasDrawn] = useState(active);
  useEffect(() => {
    if (active) setHasDrawn(true);
  }, [active]);

  // Stable per-instance ID for the gradient <defs> so multiple bands on
  // one page don't share a gradient ID.
  const reactId = useId();
  const gradientId = `unlocks-per-week-band-gradient-${reactId}`;

  if (data.length < 2) return null;

  const max = Math.max(...data);
  const safeMax = max > 0 ? max : 1;
  const step = VIEWBOX_WIDTH / (data.length - 1);
  // Build a closed area path: line across the tops, then back along the
  // baseline to close. Using `M`/`L` rather than `polyline` so we can fill
  // the under-curve region without a separate baseline line.
  const linePath = data
    .map((v, i) => {
      const x = (i * step).toFixed(2);
      const y = (VIEWBOX_HEIGHT - (v / safeMax) * VIEWBOX_HEIGHT).toFixed(2);
      return `${i === 0 ? "M" : "L"}${x},${y}`;
    })
    .join(" ");
  const areaPath = `${linePath} L${VIEWBOX_WIDTH.toFixed(2)},${VIEWBOX_HEIGHT.toFixed(2)} L0,${VIEWBOX_HEIGHT.toFixed(2)} Z`;

  const total = data.reduce((sum, v) => sum + v, 0);
  const latest = data[data.length - 1] ?? 0;
  const weeksLabel = data.length === 1 ? "1 week" : `${data.length} weeks`;
  const ariaLabel = `${total} unlock${total === 1 ? "" : "s"} across the last ${weeksLabel}, ${latest} this week`;

  // Color cascade: `--accent` is published per-chapter by the atmosphere
  // layer (per asset dominantHex — RE2 reads red, Hollow Knight blue/teal,
  // etc.). `--theme-strong` is the chronotype palette fallback, used only
  // when no claim is active (e.g. the band rendered outside a chapter).
  return (
    <div
      data-unlocks-per-week-band=""
      // No chrome wrapper — the band reads as editorial data (sparkline
      // curve + filled area) sitting directly on the splash, in the same
      // register as the standout milestone block above and the recent-
      // unlocks list below. The earlier frosted chip pulled the band
      // forward visually but introduced two problems: it isolated the
      // band as "UI widget" between two chip-free editorial blocks, and
      // backdrop-filter pops in/out as the beat transitions (compositor
      // layer churn on opacity tween). Text-shadow + thicker stroke +
      // gradient fill carry the contrast instead.
      className={cn("flex w-full flex-col gap-1.5", className)}
      {...rest}
    >
      <div className="flex items-baseline justify-between">
        <span
          className="text-[10px] uppercase tracking-[0.2em] text-foreground/90"
          style={{
            textShadow: SHADOW_LABEL,
            paintOrder: "stroke",
            WebkitTextStroke: STROKE_LABEL,
          }}
        >
          Unlocks / wk
        </span>
        <span
          className="text-[10px] uppercase tracking-[0.2em] tabular-nums text-foreground/75"
          style={{
            textShadow: SHADOW_LABEL,
            paintOrder: "stroke",
            WebkitTextStroke: STROKE_LABEL,
          }}
        >
          {weeksLabel}
        </span>
      </div>
      {/* Left-to-right wipe reveal — `<m.div>` animates a clip-path inset
          that retracts from 100% on the right to 0% as the beat
          activates. The reveal applies to BOTH the line and the gradient
          fill uniformly, giving the band a "data wiping in" register
          rather than a pure line-draw. The earlier path-length
          implementation (Motion's `pathLength` on m.path) produced
          dasharray ghosts on viewBox 100×24 stretched wide — clip-path
          sidesteps the dash math entirely. Once `hasDrawn` flips true
          on first activation, the wipe never retracts again
          (backwards-scroll wouldn't un-draw the line). The transition
          delay matches the surrounding ChapterReveal's container fade
          so the wipe begins after the band's opacity has risen. */}
      <m.div
        className="w-full"
        initial={{ clipPath: hasDrawn ? "inset(0 0% 0 0)" : "inset(0 100% 0 0)" }}
        animate={{ clipPath: hasDrawn ? "inset(0 0% 0 0)" : "inset(0 100% 0 0)" }}
        transition={{ duration: 0.9, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
      >
        <svg
          role="img"
          aria-label={ariaLabel}
          viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
          preserveAspectRatio="none"
          className="block h-12 w-full"
          // Drop-shadow on the SVG (not backdrop-filter) gives the stroke
          // separation from busy splashes without a compositor layer that
          // the beat-transition opacity tween fights.
          style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.55))" }}
        >
          <title>{ariaLabel}</title>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="0%"
                stopColor="var(--accent, var(--theme-strong))"
                stopOpacity={0.55}
              />
              <stop
                offset="100%"
                stopColor="var(--accent, var(--theme-strong))"
                stopOpacity={0.05}
              />
            </linearGradient>
          </defs>
          <path d={areaPath} fill={`url(#${gradientId})`} />
          {/* Dark halo stroke painted UNDERNEATH the accent stroke — same
              role as `paint-order: stroke` for SVG paths. Solves hue
              collision on splashes whose dominantHex matches the accent
              (Requiem's red logo blending the red sparkline into red
              background). Slightly wider and dark; the colored stroke on
              top inherits its full visual weight. */}
          <path
            d={linePath}
            fill="none"
            stroke="rgba(0,0,0,0.55)"
            strokeWidth={3.5}
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          <path
            d={linePath}
            fill="none"
            stroke="var(--accent, var(--theme-strong))"
            strokeWidth={1.75}
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      </m.div>
    </div>
  );
}
