import { useCardDensity } from "@/components/card-density";
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
   * Switch tile chrome to the frosted recipe (bg-card/60 + backdrop-blur-sm).
   * The default is `true` because every route that renders CardShell sits over
   * either a champion splash (LoL Trends / champion-detail / profile chips),
   * a Steam profile backdrop (Steam profile chips), or a baked panel splash
   * (LoL champion-detail panel, LoL match-detail panel, Steam game-detail
   * panel). Opt out (`frosted={false}`) only for surfaces with no backdrop
   * behind them at all. See the "One level of glass" rule in
   * docs/repo-conventions.md.
   */
  frosted?: boolean;
}

// The two recipes differ only in how much room the card takes for the same
// content — the chrome, the entrance and the type roles are identical, so a
// band can switch density without any card reading differently.
const DENSITY = {
  comfortable: {
    shell: "gap-3 px-4 py-4",
    verdict: "text-base",
    prescription: "pt-2.5 text-xs",
  },
  compact: {
    shell: "gap-2 px-3.5 py-3",
    verdict: "text-sm",
    prescription: "pt-2 text-[0.6875rem]",
  },
} as const;

export function CardShell({
  title,
  indicator,
  verdict,
  evidence,
  prescription,
  className,
  empty = false,
  frosted = true,
}: CardShellProps) {
  const reduced = useReducedMotion();
  const density = DENSITY[useCardDensity()];
  return (
    <div
      className={cn(
        // No `h-full`: whether cards in a row share a height is the grid's
        // decision, not the card's. A stretch grid (the default) fills the row
        // without it, while `h-full` would override an `items-start` grid that
        // wants each card sized to its own content.
        "flex flex-col rounded-lg border",
        density.shell,
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
            "font-semibold leading-snug",
            density.verdict,
            empty ? "text-muted-foreground/70" : "text-foreground/90"
          )}
        >
          {verdict}
        </m.p>
      </AnimatePresence>
      {evidence !== undefined && <div className="mt-0.5">{evidence}</div>}
      {prescription !== undefined && (
        <p
          className={cn(
            "mt-auto border-t border-border/40 text-muted-foreground",
            density.prescription
          )}
        >
          {prescription}
        </p>
      )}
    </div>
  );
}
