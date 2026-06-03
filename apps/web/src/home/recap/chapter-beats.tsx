import { motion, useReducedMotion } from "motion/react";
import { type ReactNode, createContext, useContext } from "react";

import { useChapterPin } from "./chapter-container";
import { useBeatIndex } from "./use-beat-index";

type ActiveBeatContextValue = {
  active: number;
  count: number;
};

const ActiveBeatContext = createContext<ActiveBeatContextValue | null>(null);

/**
 * Read the active-beat index published by the nearest `<ChapterBeats>`.
 * Returns null when called outside one — useful for components that may
 * render inside either a single-pin or multi-beat chapter (e.g. the
 * `NextChapterCaret` in chunk 4, which advances by beat when present and
 * by chapter otherwise).
 */
export function useActiveBeat(): ActiveBeatContextValue | null {
  return useContext(ActiveBeatContext);
}

/**
 * Beat-stacking wrapper. Lives inside `<ChapterContainer>`'s sticky pin
 * and fills its height. Reads the pin context's outer-section ref to
 * subscribe to scroll progress, discretises it into a beat index, and
 * publishes that index to descendant `<ChapterBeat>` slots via context.
 *
 * Beat count is read from the `ChapterContainer beats={N}` declaration —
 * keeping the source of truth in one spot (the container sizes its own
 * outer height by the same value).
 *
 * Under reduced motion, beats collapse to a vertical stack with normal
 * page flow — consistent with `ChapterContainer`'s reduced-motion path.
 * The active-beat index is still computed but unused for rendering.
 */
export function ChapterBeats({ children }: { children: ReactNode }) {
  const { ref, beats } = useChapterPin();
  const activeBeat = useBeatIndex(ref, beats);
  const reducedMotion = useReducedMotion();

  const containerClass = reducedMotion
    ? "flex w-full flex-col gap-16"
    : "relative w-full flex-1";

  return (
    <ActiveBeatContext.Provider value={{ active: activeBeat, count: beats }}>
      <div
        data-chapter-beats=""
        data-beats={beats}
        data-active-beat={activeBeat}
        className={containerClass}
      >
        {children}
      </div>
    </ActiveBeatContext.Provider>
  );
}

/**
 * One beat in a multi-beat chapter. Stacks absolutely inside
 * `<ChapterBeats>`; opacity + small downward translate crossfade as the
 * active-beat index reaches `index`. Inactive beats are aria-hidden and
 * pointer-events-disabled so screen readers and clicks don't reach them.
 *
 * Under reduced motion, all beats render in normal flow (no opacity,
 * no positioning, no aria-hidden). The chapter reads as a stack of
 * sections rather than a beat-progression.
 *
 * `initial={false}` keeps the first paint pinned to the active state
 * (no opening fade-in for inactive beats stacked behind beat 0). The
 * crossfade ease is the same `0.22,1,0.36,1` curve used elsewhere in
 * the recap — out-cubic feels closer to "settles into place" than the
 * default ease.
 */
export function ChapterBeat({
  index,
  children,
}: {
  index: number;
  children: ReactNode;
}) {
  const ctx = useContext(ActiveBeatContext);
  const reducedMotion = useReducedMotion();
  const isActive = ctx ? ctx.active === index : true;

  if (reducedMotion) {
    return (
      <div data-beat={index} className="flex w-full flex-col">
        {children}
      </div>
    );
  }

  return (
    <motion.div
      data-beat={index}
      data-active={isActive ? "true" : "false"}
      aria-hidden={isActive ? undefined : true}
      initial={false}
      animate={{ opacity: isActive ? 1 : 0, y: isActive ? 0 : 8 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      style={{ pointerEvents: isActive ? "auto" : "none" }}
      className="absolute inset-0 flex w-full flex-col"
    >
      {children}
    </motion.div>
  );
}
