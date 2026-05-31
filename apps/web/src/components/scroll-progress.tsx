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
    // Force the JS fallback on Firefox unconditionally. Firefox now reports
    // CSS.supports("animation-timeline: scroll()") AND
    // CSS.supports("timeline-scope: --x") as true (parser-level), but the
    // named `--main-scroll` timeline declared on <main> still doesn't reach
    // this bar (which sits OUTSIDE <main>) — owner's contract is that this
    // bar works in Firefox, so we don't rely on CSS feature-detection here.
    // Chrome / Safari fall through to the early return and use the CSS path.
    const isFirefox =
      typeof navigator !== "undefined" && /Firefox\//.test(navigator.userAgent);
    if (
      !isFirefox &&
      typeof CSS !== "undefined" &&
      CSS.supports("animation-timeline: scroll()")
    ) {
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

  // z-[45] sits above the section header band (z-40, which contains the
  // portaled compact-collapse chrome on long sections) but below the top
  // nav and overlays (z-50). Bumped from z-40 because on pages where the
  // section header collapses into a chrome strip, that strip painted over
  // this hairline.
  return (
    <div
      ref={ref}
      data-scroll-progress=""
      aria-hidden="true"
      className="pointer-events-none relative z-[45] mx-0.5 h-0.5"
    />
  );
}
