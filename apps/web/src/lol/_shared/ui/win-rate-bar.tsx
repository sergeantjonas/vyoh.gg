import { cn } from "@/lib/utils";
import { m, useReducedMotion } from "motion/react";

// Thin animated bar visualising a winRate in [0, 1]. Emerald above 50%,
// red below. Used by both the champion-list card and the champion-detail
// hero so the two surfaces visually agree on the same dimension.
export function WinRateBar({
  winRate,
  className,
}: {
  winRate: number;
  className?: string;
}) {
  const reduced = useReducedMotion();
  return (
    <div
      className={cn(
        "relative h-0.5 w-full overflow-hidden rounded-full bg-muted/30",
        className
      )}
    >
      <m.div
        className={cn(
          "absolute inset-y-0 left-0 h-full w-full rounded-full",
          winRate >= 0.5
            ? "bg-gradient-to-r from-emerald-500/70 to-emerald-400/90"
            : "bg-gradient-to-r from-red-500/70 to-red-400/90"
        )}
        style={{ transformOrigin: "left" }}
        initial={{ scaleX: reduced ? winRate : 0 }}
        animate={{ scaleX: winRate }}
        transition={{ type: "spring", stiffness: 220, damping: 28, delay: 0.1 }}
      />
    </div>
  );
}
