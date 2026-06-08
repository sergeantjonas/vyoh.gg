import { CardTitle } from "@/components/ui/card-title";
import { cn } from "@/lib/utils";
import { AnimatePresence, m, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

// Motion's `layout` projection on the outer shell left transient transform /
// projection state after a route remount, breaking pointer hit-testing on
// interactive children (the Recent Unlocks chip's Link rows). The visible
// polish — verdict text swaps — is driven by the inner AnimatePresence, so
// the outer container can be a plain div without losing perceived quality.

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
  prescription?: string | undefined;
  className?: string;
  /** When true, renders the verdict in muted style — use for insufficient-data empty states. */
  empty?: boolean;
  /**
   * Switch tile chrome to the frosted recipe (bg-card/60 + backdrop-blur-sm)
   * for in-panel use, where the card faces a splash backdrop directly. The
   * default (`false`) keeps the bare bg-card/50 recipe for page-grounded
   * contexts (Steam profile chips, LoL Trends tab page, etc.). See the
   * "One level of glass" rule in docs/repo-conventions.md.
   */
  frosted?: boolean;
}

export function CardShell({
  title,
  indicator,
  verdict,
  evidence,
  prescription,
  className,
  empty = false,
  frosted = false,
}: CardShellProps) {
  const reduced = useReducedMotion();
  return (
    <div
      className={cn(
        "flex h-full flex-col gap-3 rounded-lg border px-4 py-4",
        // `view-entry` is a scroll-driven opacity-0→1 entrance keyed on
        // `animation-timeline: view(block)`. It's a nice polish in
        // page-grounded contexts (LoL Trends tab, Steam profile chips) where
        // each card fades in as the user scrolls it into view. In the panel
        // context (frosted=true) the panel's own scroll container redefines
        // entry/cover phases and the bottom-of-panel tiles land stuck at
        // partial opacity — looks like a vignette / progressive-transparency
        // gradient. See motion.css `.view-entry` and the 2026-06-08 vignette
        // diagnosis.
        !frosted && "view-entry",
        frosted ? "bg-card/60 backdrop-blur-sm" : "bg-card/50",
        className
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <CardTitle>{title}</CardTitle>
        {indicator}
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <m.p
          key={verdict}
          initial={reduced ? false : { opacity: 0, y: 4 }}
          {...(!reduced
            ? { animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -4 } }
            : {})}
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
    </div>
  );
}
