import { cn } from "@/lib/utils";
import { m, useReducedMotion } from "motion/react";
import type { ComponentType } from "react";

export function StatBar({
  Icon,
  label,
  value,
  max,
  fillClassName,
  labelClassName,
  skipAnimation,
}: {
  Icon: ComponentType<{ className?: string }>;
  label: string;
  value: number;
  max: number;
  fillClassName: string;
  labelClassName: string;
  skipAnimation?: boolean | undefined;
}) {
  const reduced = useReducedMotion();
  const skip = reduced || skipAnimation;
  const target = max > 0 ? value / max : 0;
  return (
    <div className="flex items-center gap-1.5">
      <span
        className={cn(
          "flex w-10 items-center gap-1 font-mono text-[10px] uppercase tracking-wider",
          labelClassName
        )}
      >
        <Icon className="size-3" aria-hidden="true" />
        <span>{label}</span>
      </span>
      <div className="relative h-1 w-20 overflow-hidden rounded-full bg-muted/40">
        <m.div
          className={cn("absolute inset-y-0 left-0 w-full rounded-full", fillClassName)}
          style={{ transformOrigin: "left" }}
          initial={{ scaleX: skip ? target : 0 }}
          animate={{ scaleX: target }}
          transition={
            skip
              ? { duration: 0 }
              : { type: "spring", stiffness: 220, damping: 28, delay: 0.18 }
          }
        />
      </div>
      <span className="w-10 text-right font-mono text-[10px] tabular-nums text-muted-foreground">
        {(value / 1000).toFixed(1)}k
      </span>
    </div>
  );
}
