import { cn } from "@/lib/utils";
import { m } from "motion/react";

export type TrendsRangeId = "7d" | "30d" | "100g";

const RANGES: { id: TrendsRangeId; label: string }[] = [
  { id: "7d", label: "7 days" },
  { id: "30d", label: "30 days" },
  { id: "100g", label: "100 games" },
];

export function TrendsRangeSelector({
  value,
  onChange,
}: {
  value: TrendsRangeId;
  onChange: (id: TrendsRangeId) => void;
}) {
  return (
    <div className="flex items-center gap-1 rounded-md border p-0.5">
      {RANGES.map(({ id, label }) => {
        const active = value === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            className={cn(
              "relative cursor-pointer rounded px-2.5 py-1 text-xs font-medium transition-colors",
              active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <span className="relative z-10">{label}</span>
            {active && (
              <m.div
                layoutId="trends-range-indicator"
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
