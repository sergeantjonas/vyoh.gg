import { useMatchWindow } from "@/lol/matches/match-window-context";
import { computeStreak } from "@/lol/trends/trend-stats";
import { TrendStreak } from "@/lol/trends/trend-streak";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { useNavigate } from "@tanstack/react-router";
import type { MatchSummary } from "@vyoh/shared";
import { m } from "motion/react";

const FORM_LENGTH = 20;

const WIN_COLOR = "#34d399";
const LOSS_COLOR = "#f87171";

function PipTooltip({ match }: { match: MatchSummary }) {
  const kda =
    match.deaths === 0
      ? `${match.kills + match.assists}`
      : ((match.kills + match.assists) / match.deaths).toFixed(2);
  return (
    <div className="flex flex-col gap-0.5">
      <div className="text-sm font-semibold leading-tight">{match.champion}</div>
      <div className="text-xs text-muted-foreground">{match.queueType}</div>
      <div className="mt-0.5 font-mono text-xs">
        {match.kills}/{match.deaths}/{match.assists}{" "}
        <span className="text-muted-foreground">({kda} KDA)</span>
      </div>
    </div>
  );
}

export function ProfileRecentForm({ accountSlug }: { accountSlug: string }) {
  const { matches } = useMatchWindow();
  const navigate = useNavigate();
  const recent = matches?.slice(0, FORM_LENGTH) ?? [];

  if (recent.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">
          Recent Form
        </div>
        <TrendStreak streak={computeStreak(recent)} />
      </div>
      <m.div
        className="flex flex-wrap gap-1"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
      >
        {recent.map((match) => (
          <TooltipPrimitive.Root key={match.matchId} delayDuration={150}>
            <TooltipPrimitive.Trigger asChild>
              <button
                type="button"
                onClick={() =>
                  navigate({
                    to: "/lol/$accountSlug/matches/$matchId",
                    params: { accountSlug, matchId: match.matchId },
                  })
                }
                className="relative size-5 cursor-pointer rounded-sm transition-transform hover:z-10 hover:scale-125 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
                className="pointer-events-none z-50 w-max max-w-48 rounded-md border bg-popover/85 p-3 text-popover-foreground shadow-xl backdrop-blur-md data-[state=delayed-open]:data-[side=bottom]:animate-in data-[state=delayed-open]:data-[side=top]:animate-in data-[state=delayed-open]:fade-in-0 data-[state=delayed-open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95"
              >
                <PipTooltip match={match} />
              </TooltipPrimitive.Content>
            </TooltipPrimitive.Portal>
          </TooltipPrimitive.Root>
        ))}
      </m.div>
    </div>
  );
}
