import { TOOLTIP_CONTENT_RICH } from "@/lib/tooltip";
import { cn } from "@/lib/utils";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import type { ReactNode } from "react";

// Label · bar · trailing figure. The bar is the claim rather than decoration:
// 2-of-2 and 3-of-16 are the same "three-ish" until you see the width. The
// tooltip carries the numbers the row has no room for, which is why the row is
// a button — a hover-only affordance would keep them from keyboard users.
//
// Two registers because the same row runs in two places at very different
// widths: the full-width hero bands, and the chips, where a 44-rem label column
// would leave the bar nothing.
const SIZES = {
  hero: {
    row: "gap-3 text-sm",
    label: "w-32 sm:w-44",
    trailing: "w-28 text-xs",
  },
  chip: {
    row: "gap-2 text-xs",
    label: "w-24",
    trailing: "w-10 text-xs",
  },
} as const;

export interface StatRowProps {
  label: string;
  /** Bar fill, 0–1. Rendered with a 1% floor so a real-but-tiny share still reads. */
  fill: number;
  trailing: ReactNode;
  /** Shown on hover and on keyboard focus. */
  tooltip: ReactNode;
  size?: keyof typeof SIZES;
}

export function StatRow({ label, fill, trailing, tooltip, size = "hero" }: StatRowProps) {
  const spec = SIZES[size];
  return (
    <li>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>
          <button
            type="button"
            className={cn(
              "flex w-full cursor-help items-center rounded-sm text-left",
              spec.row
            )}
          >
            <span className={cn("shrink-0 truncate text-foreground/80", spec.label)}>
              {label}
            </span>
            <span
              aria-hidden="true"
              className="h-1 min-w-8 flex-1 overflow-hidden rounded-full bg-foreground/10"
            >
              <span
                className="block h-full rounded-full bg-foreground/40"
                style={{ width: `${Math.max(fill * 100, 1)}%` }}
              />
            </span>
            <span
              className={cn(
                "shrink-0 text-right text-muted-foreground/80 tabular-nums",
                spec.trailing
              )}
            >
              {trailing}
            </span>
          </button>
        </TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            side="top"
            sideOffset={6}
            className={cn(TOOLTIP_CONTENT_RICH, "max-w-64")}
          >
            {tooltip}
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </li>
  );
}
