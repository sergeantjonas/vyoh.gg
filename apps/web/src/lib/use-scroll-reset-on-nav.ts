import { mainScrollRef } from "@/lib/scroll-container";
import { useLayoutEffect, useRef } from "react";

export type ScrollResetSkip = { fromPrefix: string; toExact: string };

/**
 * Resets <main> scroll to top on every pathname change.
 *
 * `skips` is the set of prev→curr pairs that suppress the reset, so a list
 * view can drive its own scroll restore on back-nav (match list + champion
 * list both use this).
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
    console.log("[scroll-reset]", { prev, pathname, skips: skipsRef.current });
    if (prev === null || prev === pathname) {
      console.log("[scroll-reset] skipped: null prev or same pathname");
      return;
    }
    for (const skip of skipsRef.current) {
      if (prev.startsWith(skip.fromPrefix) && pathname === skip.toExact) {
        console.log("[scroll-reset] skipped: matched skip", skip);
        return;
      }
    }
    const main = mainScrollRef.current;
    console.log(
      "[scroll-reset] scrolling to top. main=",
      main,
      "scrollTop before=",
      main?.scrollTop
    );
    main?.scrollTo(0, 0);
  }, [pathname]);
}
