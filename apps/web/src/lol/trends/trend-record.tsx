import { cn } from "@/lib/utils";
import { useChampionName } from "@/lol/champions/use-champions";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import type { MatchSummary } from "@vyoh/shared";
import { type Variants, m } from "motion/react";

const TOOLTIP_CONTENT_CLASS =
  "pointer-events-none z-50 rounded-md border bg-popover/85 px-2 py-1 text-xs text-popover-foreground shadow-xl backdrop-blur-md data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0 data-[state=delayed-open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95";

const container: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.025 } },
};

const dot: Variants = {
  hidden: { opacity: 0, scale: 0.4 },
  show: {
    opacity: 1,
    scale: 1,
    transition: { type: "spring", stiffness: 500, damping: 24 },
  },
};

export function TrendRecord({ matches }: { matches: MatchSummary[] }) {
  const ordered = [...matches].sort((a, b) => a.playedAt.localeCompare(b.playedAt));
  const championName = useChampionName();
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-medium text-muted-foreground">Recent record</h3>
      <m.div
        initial="hidden"
        animate="show"
        variants={container}
        className="flex flex-wrap gap-1.5"
      >
        {ordered.map((match) => (
          <TooltipPrimitive.Root key={match.matchId}>
            <TooltipPrimitive.Trigger asChild>
              <m.div
                variants={dot}
                className={cn(
                  "size-3 rounded-full",
                  match.win ? "bg-emerald-500" : "bg-red-500"
                )}
              />
            </TooltipPrimitive.Trigger>
            <TooltipPrimitive.Portal>
              <TooltipPrimitive.Content
                side="top"
                sideOffset={4}
                className={TOOLTIP_CONTENT_CLASS}
              >
                {championName(match.champion)} — {match.win ? "Win" : "Loss"}
              </TooltipPrimitive.Content>
            </TooltipPrimitive.Portal>
          </TooltipPrimitive.Root>
        ))}
      </m.div>
    </div>
  );
}
