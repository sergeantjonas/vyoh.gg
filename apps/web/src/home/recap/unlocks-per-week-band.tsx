import { m } from "motion/react";
import type * as React from "react";

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
  active = false,
  className,
  ...rest
}: UnlocksPerWeekBandProps) {
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

  // Vertical gradient under the curve — accent at the peak, fading to
  // transparent at the baseline. Reads as data weight at the top where the
  // line is, not as a uniform tint. Same trick used in the LoL match-row
  // gold-lead band (no chrome wrapper, fill carries the presence).
  //
  // Color cascade: `--accent` is published per-chapter by the atmosphere
  // layer (per asset dominantHex — RE2 reads red, Hollow Knight blue/teal,
  // etc.). `--theme-strong` is the chronotype palette fallback, used only
  // when no claim is active (e.g. the band rendered outside a chapter).
  const gradientId = "unlocks-per-week-band-gradient";

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
      <svg
        role="img"
        aria-label={ariaLabel}
        viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
        preserveAspectRatio="none"
        className="block h-12 w-full"
        // Drop-shadow on the SVG (not backdrop-filter) gives the stroke
        // separation from busy splashes without a compositor layer that
        // the beat-transition opacity tween fights. SVG filter renders
        // once with the path, no per-frame composite cost.
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
        {/* The line draws on as the beat activates — left-to-right
            pathLength animation reads as "data appearing", magazine
            infographic register. The container's surrounding
            ChapterReveal handles the opacity rise; this stroke
            animation runs once on first activation with a delay tuned
            so the line lands AFTER the band's container has settled.
            Outside any chapter context (`active` defaults false), the
            line renders at full length via initial=animate=1 — no
            permanent half-drawn state when the band is used standalone. */}
        <m.path
          d={linePath}
          fill="none"
          stroke="var(--accent, var(--theme-strong))"
          strokeWidth={1.75}
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
          initial={{ pathLength: active ? 0 : 1 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.85, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
    </div>
  );
}
