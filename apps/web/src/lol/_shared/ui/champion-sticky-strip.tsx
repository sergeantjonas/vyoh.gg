import { mainScrollRef } from "@/lib/scroll-container";
import { championTheme } from "@/lol/_shared/assets/champion-theme";
import { AnimatePresence, m } from "motion/react";
import { type CSSProperties, type ReactNode, useEffect, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Compact strip pinned just below the account header. Appears when the user
 * has scrolled past a champion-themed hero. Rendered via portal so its
 * `position: fixed` and `backdrop-blur` escape any ancestor stacking-context
 * (e.g. the page-slide transition wrapper). Width matches the header's
 * clipped width — does not overlay the scrollbar.
 */
export function ChampionStickyStrip({
  visible,
  top,
  championAlias,
  children,
}: {
  visible: boolean;
  top: string | number;
  championAlias: string;
  children: ReactNode;
}) {
  const [stripRight, setStripRight] = useState(0);

  useEffect(() => {
    const el = mainScrollRef.current;
    if (el) setStripRight(el.offsetWidth - el.clientWidth);
  }, []);

  return createPortal(
    <AnimatePresence>
      {visible && (
        <m.div
          key="champ-sticky-strip"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ type: "spring", stiffness: 400, damping: 35 }}
          style={
            {
              "--theme-color": championTheme(championAlias).dominantHex,
              top,
              left: 0,
              right: stripRight,
            } as CSSProperties
          }
          className="fixed z-40 bg-background/50 backdrop-blur-md"
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-foreground/15 to-transparent"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-foreground/15 to-transparent"
          />
          <div className="relative mx-auto max-w-4xl px-6 py-2">{children}</div>
        </m.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
