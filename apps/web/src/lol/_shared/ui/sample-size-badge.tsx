import { TOOLTIP_CONTENT_RICH } from "@/lib/tooltip";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { m, useReducedMotion } from "motion/react";

const R = 5;

const LABEL: Record<"empty" | "partial" | "full", string> = {
  empty: "Small sample — directional only",
  partial: "Moderate sample",
  full: "Confident estimate",
};

export function SampleSizeBadge({ count }: { count: number }) {
  const reduced = useReducedMotion();
  const level: "empty" | "partial" | "full" =
    count < 10 ? "empty" : count < 30 ? "partial" : "full";
  const pathLength = level === "empty" ? 0 : level === "partial" ? 0.5 : 1;

  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>
        <span className="flex shrink-0 cursor-default items-center gap-1.5 text-[10px] tabular-nums text-muted-foreground/60">
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
            <circle
              cx="7"
              cy="7"
              r={R}
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              opacity="0.25"
            />
            <m.circle
              cx="7"
              cy="7"
              r={R}
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              transform="rotate(-90 7 7)"
              initial={reduced ? false : { pathLength: 0 }}
              animate={{ pathLength }}
              transition={{ duration: reduced ? 0 : 0.5, ease: [0.32, 0.72, 0, 1] }}
            />
          </svg>
          <span>
            {count} {count === 1 ? "game" : "games"}
          </span>
        </span>
      </TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side="top"
          sideOffset={6}
          collisionPadding={8}
          className={TOOLTIP_CONTENT_RICH}
        >
          {LABEL[level]}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}
