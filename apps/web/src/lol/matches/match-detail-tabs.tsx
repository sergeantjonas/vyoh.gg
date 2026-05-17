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
}: {
  value: MatchDetailTabId;
  onChange: (id: MatchDetailTabId) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Match sections"
      className="flex gap-1 border-b border-border/60"
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
              "relative px-3 py-2 text-sm font-medium transition-colors",
              active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
            {active && (
              <m.div
                layoutId="match-detail-tab-indicator"
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
