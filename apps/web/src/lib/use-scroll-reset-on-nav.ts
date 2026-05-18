import { mainScrollRef } from "@/lib/scroll-container";
import { useLayoutEffect, useRef } from "react";

/**
 * Resets <main> scroll to top on every pathname change.
 * skipFromPrefix / skipToExact: skip the reset when navigating from a URL
 * that starts with `skipFromPrefix` to the exact URL `skipToExact` — used by
 * the LoL match list to let MatchList drive its own scroll restore on back-nav.
 */
export function useScrollResetOnNav(
  pathname: string,
  skipFromPrefix?: string,
  skipToExact?: string
): void {
  const prevRef = useRef<string | null>(null);
  useLayoutEffect(() => {
    const prev = prevRef.current;
    prevRef.current = pathname;
    if (prev === null || prev === pathname) return;
    if (
      skipFromPrefix &&
      skipToExact &&
      prev.startsWith(skipFromPrefix) &&
      pathname === skipToExact
    )
      return;
    mainScrollRef.current?.scrollTo(0, 0);
  }, [pathname, skipFromPrefix, skipToExact]);
}
