import { cn } from "@/lib/utils";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";

const TOOLTIP_CONTENT_CLASS =
  "pointer-events-none z-50 max-w-xs rounded-md border bg-popover/85 px-2 py-1 text-xs text-popover-foreground shadow-xl backdrop-blur-md data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0 data-[state=delayed-open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95";

// Steam exposes a "global unlock percentage" per achievement via
// GetGlobalAchievementPercentagesForApp — i.e. the share of all owners of the
// game who have the achievement. The bare "0.5%" reads as cryptic; this badge
// renders the value plus a tooltip that names what the number actually is.
interface RarityPercentProps {
  percent: number;
  /** Optional prefix text rendered inline before the percentage (e.g. "Very rare · "). */
  prefix?: string | undefined;
  className?: string;
}

export function RarityPercent({ percent, prefix, className }: RarityPercentProps) {
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>
        <span
          className={cn(
            "cursor-help tabular-nums underline decoration-dotted decoration-muted-foreground/40 underline-offset-2",
            className
          )}
        >
          {prefix}
          {percent.toFixed(1)}%
        </span>
      </TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side="top"
          sideOffset={4}
          className={TOOLTIP_CONTENT_CLASS}
        >
          {percent.toFixed(1)}% of Steam players who own this game have unlocked this
          achievement.
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}
