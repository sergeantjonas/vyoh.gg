import { championTheme } from "@/lol/_shared/assets/champion-theme";
import { AnimatePresence, type MotionStyle, m } from "motion/react";
import type { ReactNode } from "react";

/**
 * Compact champion-themed strip that appears below the panel header once the
 * user has scrolled past the hero. Rendered inline as a sibling of the panel
 * header inside the panel's sticky chrome wrapper (see SlidePanel
 * `stickyBelowHeader`) — it shares the panel's stacking context, sits at full
 * panel width, and slides in/out cleanly without competing with the panel's
 * scroll container or stealing fixed-position real estate from the page.
 *
 * Earlier versions rendered as a `position: fixed` portal to document.body
 * with `top: var(--account-header-h)` so it landed below the page-level nav
 * — that pre-dated the detail-panel arc, where the panel owns its own
 * scroll container and its own sticky chrome.
 */
export function ChampionStickyStrip({
  visible,
  championAlias,
  children,
}: {
  visible: boolean;
  championAlias: string;
  children: ReactNode;
}) {
  return (
    <AnimatePresence>
      {visible && (
        <m.div
          key="champ-sticky-strip"
          data-champion-strip=""
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ type: "spring", stiffness: 400, damping: 35 }}
          style={
            {
              "--theme-color": championTheme(championAlias).dominantHex,
            } as MotionStyle
          }
          className="relative border-b border-border/60 bg-card/80 backdrop-blur-md"
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-foreground/15 to-transparent"
          />
          <div className="relative px-4 py-2">{children}</div>
        </m.div>
      )}
    </AnimatePresence>
  );
}
