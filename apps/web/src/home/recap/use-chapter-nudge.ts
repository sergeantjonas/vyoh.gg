import { type RefObject, useEffect, useState } from "react";

import { mainScrollRef } from "@/lib/scroll-container";

/**
 * Threshold (0–1) at which the chapter is considered "committed-to" by the
 * user — only then does the nudge fire. Earlier (0.08) was too eager: at
 * normal scroll velocity the user was past the trigger zone by the time
 * the smooth-scroll started, so the yank read as hostile to scroll input
 * instead of a polite landing. 0.35 fires when the chapter is meaningfully
 * onscreen but before its content's read; the smooth-scroll then completes
 * cleanly in the direction the user was already going (rather than
 * backward against their momentum).
 *
 * Side benefit for adjacent chapters: with pinViewports=1 the previous
 * chapter unpins the moment its bottom hits viewport bottom, so a tight
 * threshold on the next chapter would fire while the previous is still
 * visible. 0.35 ensures the previous chapter is decisively out of view
 * before the next one yanks.
 */
const DEFAULT_TRIGGER_RATIO = 0.35;

/**
 * Milliseconds to wait after the smooth-scroll fires before flipping
 * `nudged` true. Lines up with the browser's smooth-scroll settle window
 * so the reveal cascade starts from a stable viewport instead of mid-yank.
 */
const SETTLE_MS = 500;

type Options = {
  triggerRatio?: number;
};

/**
 * Polite one-shot nudge into a chapter pin. Watches the referenced element
 * via IntersectionObserver and, when it crosses `triggerRatio` of visible
 * area, smooth-scrolls the chapter top into alignment with the viewport
 * top and then flips `nudged` after the settle window so the chapter's
 * reveal cascade starts from a stable view.
 *
 * One-shot: scrolling back up doesn't re-fire. Smooth-scroll respects the
 * user's active wheel/touch input mid-nudge (their scroll wins).
 *
 * Returns the `nudged` boolean; chapter bands gate their `ChapterReveal`
 * `active` prop on it.
 *
 * Crystallized out of duplicated implementations in `ahri-chapter.tsx`
 * and `steam-chapter.tsx` (R-3 feedback round). Single tuning point now —
 * change the threshold here and every subject chapter inherits it.
 */
export function useChapterNudge(
  ref: RefObject<HTMLElement | null>,
  options: Options = {}
): boolean {
  const triggerRatio = options.triggerRatio ?? DEFAULT_TRIGGER_RATIO;
  const [nudged, setNudged] = useState(false);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") {
      setNudged(true);
      return;
    }
    const el = ref.current;
    if (!el) return;
    const main = mainScrollRef.current;
    let triggered = false;
    let settleTimer: ReturnType<typeof setTimeout> | null = null;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (
            entry.isIntersecting &&
            entry.intersectionRatio >= triggerRatio &&
            !triggered
          ) {
            triggered = true;
            if (main) {
              const target =
                main.scrollTop +
                el.getBoundingClientRect().top -
                main.getBoundingClientRect().top;
              main.scrollTo({ top: target, behavior: "smooth" });
            } else {
              el.scrollIntoView({ behavior: "smooth", block: "start" });
            }
            settleTimer = setTimeout(() => setNudged(true), SETTLE_MS);
            observer.disconnect();
            break;
          }
        }
      },
      { root: main ?? null, threshold: triggerRatio }
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      if (settleTimer) clearTimeout(settleTimer);
    };
  }, [ref, triggerRatio]);

  return nudged;
}
