import { mainScrollRef } from "@/lib/scroll-container";
import { useEffect, useRef, useState } from "react";

/**
 * Returns `[scrolledPast, refCallback]`. Spread the callback as `ref={...}` on
 * the hero element. The flag flips true once the hero's midpoint crosses
 * above the account header's bottom edge — symmetric show/hide threshold so
 * scrolling back up restores the hero at the same position. Small hysteresis
 * prevents flicker at the boundary.
 *
 * Uses a callback ref (not a RefObject) so the hook reacts when the element
 * mounts later than the hook itself — important for pages that early-return a
 * placeholder while data loads, then render the hero on a subsequent pass.
 */
export function useHeroScrolledPast(): [boolean, (el: HTMLElement | null) => void] {
  const [scrolledPast, setScrolledPast] = useState(false);
  const [heroEl, setHeroEl] = useState<HTMLElement | null>(null);
  const stateRef = useRef(false);

  useEffect(() => {
    const scrollEl = mainScrollRef.current;
    if (!scrollEl || !heroEl) return;

    const onScroll = () => {
      const headerEl = document.querySelector(
        "[data-account-header]"
      ) as HTMLElement | null;
      const headerBottom = headerEl?.getBoundingClientRect().bottom ?? 96;
      const heroRect = heroEl.getBoundingClientRect();
      const heroMid = heroRect.top + heroRect.height / 2;
      const current = stateRef.current;

      if (!current && heroMid < headerBottom - 4) {
        stateRef.current = true;
        setScrolledPast(true);
      } else if (current && heroMid >= headerBottom + 4) {
        stateRef.current = false;
        setScrolledPast(false);
      }
    };

    // Evaluate once in case the page loaded with the hero already scrolled past.
    onScroll();

    scrollEl.addEventListener("scroll", onScroll, { passive: true });
    return () => scrollEl.removeEventListener("scroll", onScroll);
  }, [heroEl]);

  return [scrolledPast, setHeroEl];
}
