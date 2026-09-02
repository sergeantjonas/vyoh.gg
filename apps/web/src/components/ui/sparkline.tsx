import { TOOLTIP_CONTENT_COMPACT } from "@/lib/tooltip";
import { cn } from "@/lib/utils";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import type * as React from "react";

interface SparklineProps extends Omit<React.ComponentProps<"svg">, "stroke"> {
  data: readonly number[];
  width?: number;
  height?: number;
  stroke?: string;
  strokeWidth?: number;
  /**
   * Colour of a wider line painted *under* the stroke, for a curve that sits
   * on artwork rather than on a tile. An accent-tinted mark on a splash hides
   * by hue collision, not by brightness, so a blur alone won't save it — the
   * same reason accent glyphs pair `paint-order: stroke` with a text-stroke.
   * Off by default: on a tile it would only muddy the line.
   */
  outline?: string;
  tooltip?: React.ReactNode;
}

/** Wide enough that the outline reads as an edge on both sides of a 1–2px
 *  stroke without thickening the line's apparent weight. */
const OUTLINE_EXTRA_WIDTH = 3;

const SPARKLINE_TOOLTIP_CONTENT_CLASS = cn(
  TOOLTIP_CONTENT_COMPACT,
  "w-max max-w-64 px-3 py-2"
);

function Sparkline({
  data,
  width = 48,
  height = 12,
  stroke = "var(--theme-strong)",
  strokeWidth = 1,
  outline,
  tooltip,
  className,
  ...rest
}: SparklineProps) {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const step = width / (data.length - 1);
  const points = data
    .map(
      (v, i) =>
        `${(i * step).toFixed(1)},${(height - ((v - min) / span) * height).toFixed(1)}`
    )
    .join(" ");
  const label = rest["aria-label"];
  const svg = (
    <svg
      data-slot="sparkline"
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className={cn("inline-block align-middle", className)}
      aria-hidden={label ? undefined : true}
      role={label ? "img" : undefined}
      {...rest}
    >
      {label ? <title>{label}</title> : null}
      {outline ? (
        <polyline
          points={points}
          fill="none"
          stroke={outline}
          strokeWidth={strokeWidth + OUTLINE_EXTRA_WIDTH}
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      ) : null}
      <polyline
        points={points}
        fill="none"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
  if (!tooltip) return svg;
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>
        <button
          type="button"
          className="inline-flex cursor-help appearance-none rounded-sm border-0 bg-transparent p-0 outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          {svg}
        </button>
      </TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side="top"
          sideOffset={6}
          className={SPARKLINE_TOOLTIP_CONTENT_CLASS}
        >
          {tooltip}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}

export { Sparkline };
export type { SparklineProps };
