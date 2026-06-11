import { TOOLTIP_CONTENT_RICH } from "@/lib/tooltip";
import { cn } from "@/lib/utils";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import type { MatchSummary } from "@vyoh/shared";
import { type Variants, m } from "motion/react";

const WIN_COLOR = "#34d399";
const LOSS_COLOR = "#f87171";

const container: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.025 } },
};

const pip: Variants = {
  hidden: { opacity: 0, scale: 0.4 },
  show: {
    opacity: 1,
    scale: 1,
    transition: { type: "spring", stiffness: 500, damping: 24 },
  },
};

export function MatchPips({
  matches,
  renderTooltip,
  onMatchClick,
}: {
  matches: MatchSummary[];
  renderTooltip: (match: MatchSummary) => React.ReactNode;
  onMatchClick?: (match: MatchSummary) => void;
}) {
  return (
    <m.div
      initial="hidden"
      animate="show"
      variants={container}
      className="flex flex-wrap gap-1"
    >
      {matches.map((match) => (
        <TooltipPrimitive.Root key={match.matchId}>
          <TooltipPrimitive.Trigger asChild>
            <m.button
              variants={pip}
              type="button"
              onClick={onMatchClick ? () => onMatchClick(match) : undefined}
              className={cn(
                "relative size-5 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                onMatchClick
                  ? "cursor-pointer transition-transform hover:z-10 hover:scale-125"
                  : "cursor-default"
              )}
              style={{
                backgroundColor: match.win ? WIN_COLOR : LOSS_COLOR,
                opacity: match.win ? 1 : 0.5,
              }}
            />
          </TooltipPrimitive.Trigger>
          <TooltipPrimitive.Portal>
            <TooltipPrimitive.Content
              side="top"
              sideOffset={6}
              collisionPadding={8}
              className={TOOLTIP_CONTENT_RICH}
            >
              {renderTooltip(match)}
            </TooltipPrimitive.Content>
          </TooltipPrimitive.Portal>
        </TooltipPrimitive.Root>
      ))}
    </m.div>
  );
}
