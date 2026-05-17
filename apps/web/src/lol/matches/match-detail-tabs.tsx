import { cn } from "@/lib/utils";
import { Link } from "@tanstack/react-router";
import { m } from "motion/react";

export const MATCH_DETAIL_TABS = [
  { id: "recap", label: "Recap" },
  { id: "your-game", label: "Your game" },
  { id: "timeline", label: "Timeline" },
] as const;

export type MatchDetailTabId = (typeof MATCH_DETAIL_TABS)[number]["id"];

const TAB_TO_ROUTE = {
  recap: "/lol/$accountSlug/matches/$matchId/recap",
  "your-game": "/lol/$accountSlug/matches/$matchId/your-game",
  timeline: "/lol/$accountSlug/matches/$matchId/timeline",
} as const;

export function MatchDetailTabs({
  accountSlug,
  matchId,
  active,
  compact = false,
  indicatorId = "match-detail-tab-indicator",
  className,
}: {
  accountSlug: string;
  matchId: string;
  active: MatchDetailTabId;
  compact?: boolean;
  indicatorId?: string;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label="Match sections"
      className={cn("flex gap-1 border-b border-border/60", className)}
    >
      {MATCH_DETAIL_TABS.map((tab) => {
        const isActive = active === tab.id;
        return (
          <Link
            key={tab.id}
            to={TAB_TO_ROUTE[tab.id]}
            params={{ accountSlug, matchId }}
            replace
            role="tab"
            aria-selected={isActive}
            className={cn(
              "relative cursor-pointer px-3 text-sm font-medium transition-colors",
              compact ? "py-1" : "py-2",
              isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
            {isActive && (
              <m.div
                layoutId={indicatorId}
                className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-linear-to-r from-sky-400 via-violet-400 to-emerald-400"
                transition={{ type: "spring", stiffness: 500, damping: 35 }}
              />
            )}
          </Link>
        );
      })}
    </div>
  );
}
