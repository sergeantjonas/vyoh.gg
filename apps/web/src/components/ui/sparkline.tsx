import type * as React from "react";

import { cn } from "@/lib/utils";

interface SparklineProps extends Omit<React.ComponentProps<"svg">, "stroke"> {
  data: readonly number[];
  width?: number;
  height?: number;
  stroke?: string;
  strokeWidth?: number;
}

function Sparkline({
  data,
  width = 48,
  height = 12,
  stroke = "var(--theme-strong)",
  strokeWidth = 1,
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
  return (
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
}

export { Sparkline };
export type { SparklineProps };
