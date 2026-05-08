import { cn } from "@/lib/utils";
import { m } from "motion/react";

export const CHAMPION_SORT_OPTIONS = [
  { value: "games", label: "Games" },
  { value: "winRate", label: "Win rate" },
  { value: "avgKda", label: "KDA" },
  { value: "playtime", label: "Playtime" },
] as const;

export type ChampionSortOption = (typeof CHAMPION_SORT_OPTIONS)[number]["value"];

export function ChampionSortSelector({
  value,
  onChange,
  layoutId,
}: {
  value: ChampionSortOption;
  onChange: (value: ChampionSortOption) => void;
  layoutId: string;
}) {
  return (
    <div className="flex items-center gap-1 rounded-md border p-0.5">
      {CHAMPION_SORT_OPTIONS.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            type="button"
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={cn(
              "relative cursor-pointer rounded px-2.5 py-1 text-xs font-medium transition-colors",
              active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <span className="relative z-10">{opt.label}</span>
            {active && (
              <m.div
                layoutId={layoutId}
                className="absolute inset-0 rounded bg-gradient-to-br from-foreground/10 to-foreground/5 ring-1 ring-foreground/10"
                transition={{ type: "spring", stiffness: 500, damping: 35 }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
