import { cn } from "@/lib/utils";
import { m } from "motion/react";

export const MATCH_DETAIL_TABS = [
  { id: "recap", label: "Recap" },
  { id: "your-game", label: "Your game" },
  { id: "timeline", label: "Timeline" },
] as const;

export type MatchDetailTabId = (typeof MATCH_DETAIL_TABS)[number]["id"];

export function MatchDetailTabs({
  value,
  onChange,
  compact = false,
  indicatorId = "match-detail-tab-indicator",
  className,
}: {
  value: MatchDetailTabId;
  onChange: (id: MatchDetailTabId) => void;
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
        const active = value === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.id)}
            className={cn(
              "relative cursor-pointer px-3 text-sm font-medium transition-colors",
              compact ? "py-1" : "py-2",
              active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
            {active && (
              <m.div
                layoutId={indicatorId}
                className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-linear-to-r from-sky-400 via-violet-400 to-emerald-400"
                transition={{ type: "spring", stiffness: 500, damping: 35 }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
