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
    if (prev === null || prev === pathname) return;
    for (const skip of skipsRef.current) {
      if (prev.startsWith(skip.fromPrefix) && pathname === skip.toExact) return;
    }
    mainScrollRef.current?.scrollTo(0, 0);
  }, [pathname]);
}
