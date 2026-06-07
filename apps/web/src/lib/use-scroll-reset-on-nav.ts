import { mainScrollRef } from "@/lib/scroll-container";
import { useLayoutEffect, useRef } from "react";

export type ScrollResetSkip =
  // Back-nav restore: detail page → list. The list drives its own scroll
  // restore, so suppress the default top-reset.
  | { fromPrefix: string; toExact: string }
  // Detail-panel open/close: both directions. The detail panel overlays the
  // list (the list stays mounted in the parent layout), so navigating in or
  // out of the panel should leave the list scroll position alone.
  | { listPath: string; detailPrefix: string };

/**
 * Resets <main> scroll to top on every pathname change.
 *
 * `skips` is the set of prev→curr matchers that suppress the reset. List
 * views use these for back-nav restore (so MatchList / ChampionTable can pin
 * the previous scroll) and for detail-panel open/close (the list stays
 * mounted underneath; resetting would jerk the page to the top the moment
 * the panel opens).
 */
export function useScrollResetOnNav(
  pathname: string,
  skips: readonly ScrollResetSkip[] = []
): void {
  const prevRef = useRef<string | null>(null);
  const skipsRef = useRef(skips);
  skipsRef.current = skips;
  useLayoutEffect(() => {
    const prev = prevRef.current;
    prevRef.current = pathname;
    if (prev === null || prev === pathname) return;
    for (const skip of skipsRef.current) {
      if ("fromPrefix" in skip) {
        if (prev.startsWith(skip.fromPrefix) && pathname === skip.toExact) return;
      } else {
        const { listPath, detailPrefix } = skip;
        const prevIsList = prev === listPath;
        const prevIsDetail = prev.startsWith(detailPrefix);
        const nextIsList = pathname === listPath;
        const nextIsDetail = pathname.startsWith(detailPrefix);
        // Cover opening (list → detail), closing (detail → list), and
        // sub-tab navigation inside the panel (detail → detail).
        if (
          (prevIsList && nextIsDetail) ||
          (prevIsDetail && nextIsList) ||
          (prevIsDetail && nextIsDetail)
        ) {
          return;
        }
      }
    }
    mainScrollRef.current?.scrollTo(0, 0);
  }, [pathname]);
}
