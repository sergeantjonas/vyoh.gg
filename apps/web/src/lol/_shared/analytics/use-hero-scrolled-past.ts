import { useActiveScrollContainer } from "@/lib/scroll-container-context";
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
export function useHeroScrolledPast(
  // Optional explicit scroll container. Pass this when the hook is called
  // OUTSIDE its target scroll container's React subtree — e.g. detail-panel
  // parents that run the hook above SlidePanel's ScrollContainerProvider in
  // render order and would otherwise resolve `useActiveScrollContainer` to
  // <main>. Undefined / null falls back to the context (and ultimately
  // <main>).
  explicitScrollEl?: HTMLElement | null
): [boolean, (el: HTMLElement | null) => void] {
  const [scrolledPast, setScrolledPast] = useState(false);
  const [heroEl, setHeroEl] = useState<HTMLElement | null>(null);
  const stateRef = useRef(false);

  const ctxScrollEl = useActiveScrollContainer();
  const scrollEl = explicitScrollEl ?? ctxScrollEl;

  useEffect(() => {
    if (!scrollEl || !heroEl) return;

    const onScroll = () => {
      // Prefer the most-local sticky chrome above the hero — when in a detail
      // panel, that's the panel header; on standalone pages, the account
      // header. Falls back to a hard estimate if neither is mounted.
      const panelHeader = document.querySelector(
        "[data-panel-header]"
      ) as HTMLElement | null;
      const referenceEl =
        panelHeader ??
        (document.querySelector("[data-account-header]") as HTMLElement | null);
      const referenceBottom = referenceEl?.getBoundingClientRect().bottom ?? 96;
      const heroRect = heroEl.getBoundingClientRect();
      const heroMid = heroRect.top + heroRect.height / 2;
      const current = stateRef.current;

      if (!current && heroMid < referenceBottom - 4) {
        stateRef.current = true;
        setScrolledPast(true);
      } else if (current && heroMid >= referenceBottom + 4) {
        stateRef.current = false;
        setScrolledPast(false);
      }
    };

    // Evaluate once in case the page loaded with the hero already scrolled past.
    onScroll();

    scrollEl.addEventListener("scroll", onScroll, { passive: true });
    return () => scrollEl.removeEventListener("scroll", onScroll);
  }, [heroEl, scrollEl]);

  return [scrolledPast, setHeroEl];
}
