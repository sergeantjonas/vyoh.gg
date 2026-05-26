import { mainScrollRef } from "@/lib/scroll-container";
import { useEffect, useRef } from "react";

// 2px hairline placed between section-header-slot and <main> in __root.tsx
// (sibling of <main>, not inside it). Living outside <main> means the bar
// is not constrained by <main>'s scrollbar-gutter and naturally spans the
// full viewport width.
//
// Pure-CSS path (Chrome / Safari): motion.css drives `--progress-width` via
// the named `--main-scroll` scroll timeline (timeline-scope on body extends
// it across the subtree). Firefox stable doesn't implement scroll-driven
// animations on stable yet, so the JS fallback below subscribes to the
// shared <main> scroll ref and writes `--progress-width` directly.
export function ScrollProgress() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof CSS !== "undefined" && CSS.supports("animation-timeline: scroll()")) {
      return;
    }
    const main = mainScrollRef.current;
    const el = ref.current;
    if (!main || !el) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const max = main.scrollHeight - main.clientHeight;
      const progress = max > 0 ? main.scrollTop / max : 0;
      el.style.setProperty("--progress-width", `${progress * 100}%`);
    };
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(update);
    };
    update();
    main.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      main.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div
      ref={ref}
      data-scroll-progress=""
      aria-hidden="true"
      className="pointer-events-none relative z-40 mx-0.5 h-0.5"
    />
  );
}
