import { cn } from "@/lib/utils";
import { AnimatePresence, m, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

// Layout primitive shared by ConclusionCard (LoL trends, statistical) and
// FactCard (Steam catalog, non-statistical). Both have the same shape — title
// row with a top-right indicator slot, an animated verdict body, optional
// evidence and prescription — but their indicators carry different semantics
// (sample-size confidence vs. plain count), so the indicator is a slot rather
// than baked in.
export interface CardShellProps {
  title: string;
  indicator?: ReactNode;
  verdict: string;
  evidence?: ReactNode;
  prescription?: string;
  className?: string;
  /** When true, renders the verdict in muted style — use for insufficient-data empty states. */
  empty?: boolean;
}

export function CardShell({
  title,
  indicator,
  verdict,
  evidence,
  prescription,
  className,
  empty = false,
}: CardShellProps) {
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
        {indicator}
      </div>
      <AnimatePresence mode="popLayout" initial={false}>
        <m.p
          key={verdict}
          layout="position"
          initial={reduced ? false : { opacity: 0, y: 4 }}
          animate={reduced ? undefined : { opacity: 1, y: 0 }}
          exit={reduced ? undefined : { opacity: 0, y: -4 }}
          transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
          className={cn(
            "text-base font-semibold leading-snug",
            empty ? "text-muted-foreground/70" : "text-foreground/90"
          )}
        >
          {verdict}
        </m.p>
      </AnimatePresence>
      {evidence !== undefined && <div className="mt-0.5">{evidence}</div>}
      {prescription !== undefined && (
        <p className="mt-auto border-t border-border/40 pt-2.5 text-xs text-muted-foreground">
          {prescription}
        </p>
      )}
    </m.div>
  );
}
