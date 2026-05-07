import { cn } from "@/lib/utils";
import { m } from "motion/react";

const PRESETS = [20, 50, 100] as const;

// Builds count options against what's actually cached. Showing "100" when the
// DB only has 18 matches is misleading — the user clicks it expecting more
// and gets the same view. Instead: show the presets that fit, plus an "All
// N" cap when the total isn't already a preset.
export function deriveCountOptions(total: number): number[] {
  if (total <= 0) return [];
  const fitting = PRESETS.filter((p) => p <= total);
  if (fitting.length === 0) return [total];
  if (fitting[fitting.length - 1] === total) return fitting;
  return [...fitting, total];
}

export function MatchCountSelector({
  value,
  total,
  onChange,
  layoutId,
}: {
  value: number;
  total: number;
  onChange: (value: number) => void;
  layoutId: string;
}) {
  const options = deriveCountOptions(total);
  if (options.length === 0) return null;

  return (
    <div className="flex items-center gap-1 rounded-md border p-0.5">
      {options.map((opt) => {
        const active = value === opt;
        const isAllCap = opt === total && !PRESETS.includes(opt as 20 | 50 | 100);
        const label = isAllCap ? `All ${opt}` : String(opt);
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
            <span className="relative z-10">{label}</span>
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
