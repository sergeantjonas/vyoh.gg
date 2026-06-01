import { type RefObject, useEffect, useState } from "react";

import { mainScrollRef } from "@/lib/scroll-container";

/**
 * Threshold (0–1) at which the chapter snaps. Picked so the snap fires
 * once the user has decisively landed *inside* the chapter (anywhere
 * between top and bottom counts as "landed") — at which point the design
 * intent is to flip the user to the chapter top regardless of where they
 * arrived: book-page feel, every chapter a deliberate landing surface.
 *
 * 0.08 was too eager (fired mid-scroll, fought wheel velocity). 0.35
 * was too late (user often missed the entire snap zone at speed, and
 * when it did fire the backward yank from deep inside was disorienting).
 * 0.5 fires when the chapter occupies half the viewport — the user is
 * committedly looking at it, and the snap to align top reads as a
 * page-turn into the cascade rather than a hostile yank.
 */
const DEFAULT_TRIGGER_RATIO = 0.5;

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
 * via IntersectionObserver and, when its visible area crosses
 * `triggerRatio`, smooth-scrolls the chapter top into alignment with the
 * viewport top and then flips `nudged` after the settle window so the
 * chapter's reveal cascade starts from a stable view.
 *
 * The snap always fires once the threshold is crossed — direction agnostic.
 * Approach from above (chapter mostly below viewport) → scroll forward to
 * land at top. Overshoot or scrolled-past (chapter top already above
 * viewport top) → scroll backward to align. The book-page UX intent is
 * that every chapter is a deliberate viewing surface; anywhere the user
 * lands gets pulled to the canonical top so the cascade reads from beat
 * one rather than mid-stream.
 *
 * One-shot: scrolling back up doesn't re-fire. Smooth-scroll respects the
 * user's active wheel/touch input mid-nudge — if they fight it, their
 * scroll wins and `nudged` still flips on the settle so the cascade
 * plays at whatever position they ended up at (no trap).
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
