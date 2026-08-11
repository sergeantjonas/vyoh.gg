import { TOOLTIP_CONTENT_COMPACT } from "@/lib/tooltip";
import { cn } from "@/lib/utils";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";

// Steam publishes the share at one decimal, so a reported 0 means "below
// 0.05%" — not "nobody has it". Beside an achievement the owner has unlocked,
// "0.0%" asserts the opposite of what happened, and a freshly launched game
// reports a whole batch of them at once. Every value that would round to 0.0
// renders as the upper bound it actually is.
const SUB_RESOLUTION_LABEL = "<0.1%";
const SUB_RESOLUTION_MAX = 0.05;

export function formatRarityPercent(percent: number): string {
  return percent < SUB_RESOLUTION_MAX ? SUB_RESOLUTION_LABEL : `${percent.toFixed(1)}%`;
}

// Editorial variant for the recap chapter: sub-10% keeps its decimal (1.8%
// carries weight that "2%" erases), integer above that (12% reads cleaner
// than 12.4%).
export function formatRarityPercentEditorial(percent: number): string {
  if (percent < SUB_RESOLUTION_MAX) return SUB_RESOLUTION_LABEL;
  return percent < 10 ? `${percent.toFixed(1)}%` : `${Math.round(percent)}%`;
}

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
  const label = formatRarityPercent(percent);
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
          {label}
        </span>
      </TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side="top"
          sideOffset={4}
          className={cn(TOOLTIP_CONTENT_COMPACT, "max-w-xs")}
        >
          {percent < SUB_RESOLUTION_MAX
            ? "Fewer than 0.1% of Steam players who own this game have unlocked this achievement."
            : `${label} of Steam players who own this game have unlocked this achievement.`}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}
