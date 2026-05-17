import { mainScrollRef } from "@/lib/scroll-container";
import { useCallback, useEffect, useRef, useState } from "react";

function getStickyThreshold(): number {
  const strip = document.querySelector("[data-champion-strip]");
  if (strip) {
    const rect = strip.getBoundingClientRect();
    if (rect.height > 0) return rect.bottom;
  }
  const header = document.querySelector("[data-account-header]") as HTMLElement | null;
  return (header?.getBoundingClientRect().bottom ?? 96) + 80;
}

/**
 * Scroll-position-based sub-nav for a list of anchored sections. Mirrors the
 * pattern in useHeroScrolledPast: listens on mainScrollRef, evaluates on each
 * scroll tick.
 *
 * ids must be a stable (module-level) constant — the effect captures them at
 * mount and intentionally has empty deps.
 */
export function useScrollspy(ids: readonly string[]): {
  activeId: string;
  refFor: (id: string) => (el: HTMLElement | null) => void;
  navigateTo: (id: string, smooth?: boolean) => void;
} {
  const [activeId, setActiveId] = useState<string>(ids[0] ?? "");
  const activeRef = useRef<string>(ids[0] ?? "");
  const elsRef = useRef(new Map<string, HTMLElement>());
  const evaluateRef = useRef<(() => void) | null>(null);

  const refFor = useCallback(
    (id: string) => (el: HTMLElement | null) => {
      if (el) {
        elsRef.current.set(id, el);
        // Re-evaluate when a section mounts (tab switch, initial render)
        requestAnimationFrame(() => evaluateRef.current?.());
      } else {
        elsRef.current.delete(id);
      }
    },
    []
  );

  const navigateTo = useCallback((id: string, smooth = true) => {
    const el = elsRef.current.get(id);
    const scrollEl = mainScrollRef.current;
    if (!el || !scrollEl) return;
    const threshold = getStickyThreshold();
    const rect = el.getBoundingClientRect();
    scrollEl.scrollTo({
      top: scrollEl.scrollTop + rect.top - threshold,
      behavior: smooth ? "smooth" : "auto",
    });
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: ids is a module constant; elsRef/activeRef/evaluateRef are stable
  useEffect(() => {
    const scrollEl = mainScrollRef.current;
    if (!scrollEl) return;

    const evaluate = () => {
      const threshold = getStickyThreshold();
      let next = ids[0] ?? "";
      for (const id of ids) {
        const el = elsRef.current.get(id);
        if (!el) continue;
        if (el.getBoundingClientRect().top <= threshold + 1) {
          next = id;
        }
      }
      if (next !== activeRef.current) {
        activeRef.current = next;
        setActiveId(next);
      }
    };

    evaluateRef.current = evaluate;
    evaluate();
    scrollEl.addEventListener("scroll", evaluate, { passive: true });
    return () => {
      scrollEl.removeEventListener("scroll", evaluate);
      evaluateRef.current = null;
    };
  }, []);

  return { activeId, refFor, navigateTo };
}
