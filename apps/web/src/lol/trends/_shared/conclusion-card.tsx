import { cn } from "@/lib/utils";
import { m, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";
import { SampleSizeBadge } from "./sample-size-badge";

export interface ConclusionCardProps {
  title: string;
  sampleSize: number;
  verdict: string;
  verdictMarkdown?: string;
  evidence?: ReactNode;
  prescription?: string;
  prescriptionMarkdown?: string;
  className?: string;
}

export function ConclusionCard({
  title,
  sampleSize,
  verdict,
  evidence,
  prescription,
  className,
}: ConclusionCardProps) {
  const reduced = useReducedMotion();
  return (
    <m.div
      layout
      className={cn(
        "flex h-full flex-col gap-3 rounded-lg border bg-card/50 px-4 py-4",
        className
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-xs uppercase tracking-wide text-muted-foreground">{title}</h3>
        <SampleSizeBadge count={sampleSize} />
      </div>
      <p
        className={cn(
          "text-base font-semibold leading-snug text-foreground/90",
          reduced ? "" : "transition-colors"
        )}
      >
        {verdict}
      </p>
      {evidence !== undefined && <div className="mt-0.5">{evidence}</div>}
      {prescription !== undefined && (
        <p className="mt-auto border-t border-border/40 pt-2.5 text-xs text-muted-foreground">
          {prescription}
        </p>
      )}
    </m.div>
  );
}
