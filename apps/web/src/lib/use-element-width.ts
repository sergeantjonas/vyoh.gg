import { useCallback, useEffect, useState } from "react";

// The rendered width of an element, tracked through resizes. For charts that
// size themselves to their column but must keep their own height: visx's
// `ParentSize` puts its child in an absolutely positioned, `inset: 0` box, so
// the content never gives the wrapper any height and a chart taller than the
// column beside it is clipped. This hook measures width only and lets the
// SVG's own height flow into the layout. Reads 0 until the element mounts.
export function useElementWidth(): {
  ref: (el: HTMLElement | null) => void;
  width: number;
} {
  const [el, setEl] = useState<HTMLElement | null>(null);
  const [width, setWidth] = useState(0);
  const ref = useCallback((node: HTMLElement | null) => setEl(node), []);

  useEffect(() => {
    if (!el) return;
    setWidth(el.getBoundingClientRect().width);
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setWidth(entry.contentRect.width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [el]);

  return { ref, width };
}
