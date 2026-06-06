import type * as React from "react";

import { cn } from "@/lib/utils";

import { SHADOW_BODY } from "./chapter-shadows";

interface UnlocksPerWeekBandProps extends Omit<React.ComponentProps<"div">, "children"> {
  /**
   * Per-week unlock counts oldest-first, ending at the current Brussels
   * calendar week. Sourced from `SteamGameRecap.unlocksPerWeek`. The band
   * renders nothing when the series has fewer than 2 entries — a one-point
   * line has no shape, and a zero-length series means there's no recent
   * unlock activity worth showing.
   */
  data: readonly number[];
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

  return (
    <div
      data-unlocks-per-week-band=""
      className={cn("flex w-full flex-col gap-1", className)}
      {...rest}
    >
      <div className="flex items-baseline justify-between">
        <span
          className="text-[10px] uppercase tracking-[0.2em] text-foreground/80"
          style={{ textShadow: SHADOW_BODY }}
        >
          Unlocks / wk
        </span>
        <span
          className="text-[10px] uppercase tracking-[0.2em] tabular-nums text-foreground/65"
          style={{ textShadow: SHADOW_BODY }}
        >
          {weeksLabel}
        </span>
      </div>
      <svg
        role="img"
        aria-label={ariaLabel}
        viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
        preserveAspectRatio="none"
        className="block h-8 w-full"
      >
        <title>{ariaLabel}</title>
        <path d={areaPath} fill="var(--theme-strong)" fillOpacity={0.18} />
        <path
          d={linePath}
          fill="none"
          stroke="var(--theme-strong)"
          strokeWidth={1}
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
}
