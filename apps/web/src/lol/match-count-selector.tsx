import { cn } from "@/lib/utils";
import { m } from "motion/react";

export const MATCH_COUNT_OPTIONS = [20, 50, 100] as const;
export type MatchCountOption = (typeof MATCH_COUNT_OPTIONS)[number];

export function MatchCountSelector({
  value,
  onChange,
  layoutId,
}: {
  value: MatchCountOption;
  onChange: (value: MatchCountOption) => void;
  layoutId: string;
}) {
  return (
    <div className="flex items-center gap-1 rounded-md border p-0.5">
      {MATCH_COUNT_OPTIONS.map((opt) => {
        const active = value === opt;
        return (
          <button
            type="button"
            key={opt}
            onClick={() => onChange(opt)}
            className={cn(
              "relative cursor-pointer rounded px-2.5 py-1 text-xs font-medium transition-colors",
              active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <span className="relative z-10">{opt}</span>
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
