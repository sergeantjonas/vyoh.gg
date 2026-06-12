import { cn } from "@/lib/utils";
import { AnimatePresence, m, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

// Shared shell for in-chart hover tooltips (Recharts custom `content`, visx
// hover overlays). Carries the popover recipe + spring entrance that four
// chart tooltips converged on independently (trend-kda, match-gold-lead,
// match-lane-phase, profile-lp-history — consolidated 2026-06-12, audit V8).
//
// Usage: keep the shell mounted and pass `null` children while inactive —
// the AnimatePresence in here owns the exit animation, so unmounting the
// shell itself would cut the exit short. Guard data access in the ternary
// that produces children, e.g. `{active && pt ? <>…</> : null}`.
//
// Distinct from lib/tooltip.ts: those are Radix-portaled hover tooltips;
// chart tooltips are positioned by the chart library inside the chart box.
export function ChartTooltipShell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string | undefined;
}) {
  const reduced = useReducedMotion();
  return (
    <AnimatePresence>
      {children ? (
        <m.div
          key="chart-tooltip"
          initial={reduced ? {} : { opacity: 0, y: 4, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={reduced ? {} : { opacity: 0, scale: 0.96 }}
          transition={{ type: "spring", stiffness: 400, damping: 28 }}
          className={cn(
            "rounded-md border bg-popover/85 px-3 py-2 text-xs text-popover-foreground shadow-xl backdrop-blur-md",
            className
          )}
        >
          {children}
        </m.div>
      ) : null}
    </AnimatePresence>
  );
}
