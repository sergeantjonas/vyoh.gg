import { type RefObject, useEffect, useState } from "react";

import { mainScrollRef } from "@/lib/scroll-container";

/**
 * Threshold (0–1) at which the chapter's reveal cascade fires, expressed as
 * a fraction of the VIEWPORT (not of the observed section). Picked so the
 * cascade plays once the user has decisively landed *inside* the chapter —
 * anywhere between top and bottom counts as "landed". 0.5 fires when the
 * pin occupies half the viewport.
 *
 * For multi-beat chapters whose section is taller than the viewport (R-13),
 * the raw IntersectionObserver ratio caps at `1 / sectionViewports` during
 * the pin window (a 2.4× section can never have more than 1/2.4 ≈ 0.417 of
 * itself visible). The hook scales the observer threshold down by that
 * factor at observe-time so `triggerRatio` keeps its viewport-relative
 * semantic regardless of section height.
 *
 * History: 0.08 was too eager (fired mid-scroll), 0.35 fired too late
 * (user often missed the trigger zone at speed). 0.5 reads as a
 * page-turn into the cascade rather than a hostile yank.
 */
const DEFAULT_TRIGGER_RATIO = 0.5;

/**
 * Milliseconds to wait after the threshold crosses before flipping
 * `nudged` true. Originally 500ms (tuned to the CSS scroll-snap settle
 * window) but R-13's stacked-beat model produced visible "dead air"
 * between the outgoing beat's exit-dissolve completing (~end of the
 * ~150ms snap) and the incoming beat's reveal starting — the gap was
 * ~500ms of mostly-empty viewport. Dropped to 120ms so the incoming
 * reveal overlaps with the back half of the outgoing dissolve rather
 * than waiting for full snap-settle. Still long enough to absorb the
 * tail of the snap interpolation; short enough that the transition
 * reads as one continuous gesture.
 */
const SETTLE_MS = 120;

type Options = {
  triggerRatio?: number;
};

/**
 * One-shot reveal-cascade gate for a chapter. Watches the referenced
 * element via IntersectionObserver and flips `nudged` once its visible
 * area crosses `triggerRatio` (after a settle window). Chapter bands
 * gate their `ChapterReveal` `active` prop on it.
 *
 * This hook owns the cascade trigger and nothing else. There is no
 * chapter snap to coordinate with: the JS-based one-shot `main.scrollTo`
 * that used to live here was replaced by CSS snap, and the recap then
 * migrated off snap entirely to the persistent-frame model (one sticky
 * scope per chapter, normal-flow beat zones, view-timeline-driven fade).
 * No `scroll-snap-type` exists on <main> or anywhere else in the app.
 *
 * Crystallized out of duplicated implementations in `ahri-chapter.tsx`
 * and `steam-chapter.tsx` (R-3 feedback round). Single tuning point now.
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
    // Scale the threshold by section height so triggerRatio remains
    // viewport-relative across single-pin (1× viewport) and multi-beat
    // (e.g. 2.4× viewport) sections. Falls back to the raw ratio when
    // measurement isn't available (SSR-shaped DOM, happy-dom, etc.) —
    // same behavior as before the multi-beat retrofit.
    const viewportHeight = window.innerHeight || 0;
    const sectionHeight = el.getBoundingClientRect().height || 0;
    const sectionViewports =
      viewportHeight > 0 && sectionHeight > 0 ? sectionHeight / viewportHeight : 1;
    const observerThreshold =
      sectionViewports > 1 ? Math.min(1, triggerRatio / sectionViewports) : triggerRatio;
    let triggered = false;
    let settleTimer: ReturnType<typeof setTimeout> | null = null;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (
            entry.isIntersecting &&
            entry.intersectionRatio >= observerThreshold &&
            !triggered
          ) {
            triggered = true;
            settleTimer = setTimeout(() => setNudged(true), SETTLE_MS);
            observer.disconnect();
            break;
          }
        }
      },
      { root: main ?? null, threshold: observerThreshold }
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      if (settleTimer) clearTimeout(settleTimer);
    };
  }, [ref, triggerRatio]);

  return nudged;
}
