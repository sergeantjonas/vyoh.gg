import { TOOLTIP_CONTENT_COMPACT } from "@/lib/tooltip";
import { cn } from "@/lib/utils";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";

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
          className={cn(TOOLTIP_CONTENT_COMPACT, "max-w-xs")}
        >
          {percent.toFixed(1)}% of Steam players who own this game have unlocked this
          achievement.
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}
