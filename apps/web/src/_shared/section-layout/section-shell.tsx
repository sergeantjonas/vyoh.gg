import { mainScrollRef } from "@/lib/scroll-container";
import { cn } from "@/lib/utils";
import { type Transition, m, useReducedMotion } from "motion/react";
import { type ReactNode, type Ref, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { SectionShellProvider } from "./section-shell-context";

// Kept exported-shape only while consumers still pass it; the VT spike no
// longer reads any field. Drop in Chunk 6 of the migration plan.
type SlideTransitionOverride = {
  initial?: false | "enter" | "center";
  transition?: Transition;
};

type SectionShellProps = {
  identity: ReactNode;
  actions?: ReactNode;
  nav: ReactNode;
  children: ReactNode;
  pathname: string;
  slideDirection: number;
  slideTransitionOverride?: SlideTransitionOverride | undefined;
  // External ref to the <header>; merged with the shell's internal ref.
  // Consumers who need DOM access (e.g. LoL writing `--account-header-h`) pass
  // a ref here OR use `onHeaderRect` for the callback flavour.
  headerRef?: Ref<HTMLElement>;
  // Fires on initial mount, every ResizeObserver tick, and window resize.
  // Identity is captured in a ref so inline callbacks don't re-subscribe.
  onHeaderRect?: (rect: DOMRect) => void;
};

export function SectionShell({
  identity,
  actions,
  nav,
  children,
  // Spike: pathname / slideDirection / slideTransitionOverride are still in
  // the prop surface but unused now that the router-level VT call drives
  // section transitions. Drop in Chunk 6 once consumers are updated.
  pathname: _pathname,
  slideDirection: _slideDirection,
  slideTransitionOverride: _slideTransitionOverride,
  headerRef: externalHeaderRef,
  onHeaderRect,
}: SectionShellProps) {
  const prefersReducedMotion = useReducedMotion();

  // The fixed-position band below needs to match the in-flow header's height
  // *and* sit at the same viewport y — the header lives in the portal slot
  // between <Nav> and <main>, so its viewport top is at <Nav>.bottom (read
  // via getBoundingClientRect, not assumed).
  const internalHeaderRef = useRef<HTMLElement | null>(null);
  const [headerHeight, setHeaderHeight] = useState(0);
  const [headerTop, setHeaderTop] = useState(0);

  const onHeaderRectRef = useRef(onHeaderRect);
  onHeaderRectRef.current = onHeaderRect;

  const setHeaderRef = (el: HTMLElement | null) => {
    internalHeaderRef.current = el;
    if (typeof externalHeaderRef === "function") {
      externalHeaderRef(el);
    } else if (externalHeaderRef && "current" in externalHeaderRef) {
      (externalHeaderRef as { current: HTMLElement | null }).current = el;
    }
  };

  // Section header is portaled into #section-header-slot (declared in
  // routes/__root.tsx) so it lives OUTSIDE <main>. <main> carries the
  // vt-main view-transition-name; portaling the header out means only the
  // content slides during a route VT — the header holds still. The slot is
  // a DOM-id portal target rather than a context ref so SectionShell stays
  // decoupled from root layout; the trade-off is the one-frame mount delay
  // covered by the effect below.
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setSlot(document.getElementById("section-header-slot"));
  }, []);

  // Re-runs when `slot` flips from null to the slot element — that's the
  // render where the portaled <header> first commits and the ref is set.
  // Without the `slot` dep this effect fires once before the portal exists
  // and exits via `if (!el) return`, leaving the rect callback un-invoked.
  useEffect(() => {
    if (!slot) return;
    const el = internalHeaderRef.current;
    if (!el) return;
    const update = () => {
      const rect = el.getBoundingClientRect();
      setHeaderHeight(rect.height);
      setHeaderTop(rect.top);
      onHeaderRectRef.current?.(rect);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    // Window resize can shift main's top edge (nav reflows at a different
    // breakpoint) without the header element itself resizing.
    window.addEventListener("resize", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [slot]);

  // Two scroll-driven states with different thresholds. `compact` drives the
  // header padding spring with wide hysteresis (>96 enter, <8 exit) and a
  // 400ms cooldown — defends against the scroll-anchoring flap loop where
  // shrinking the header bumps scrollTop back across the threshold.
  // `bandOpaque` drives the band's opacity off a much smaller threshold (16px)
  // so the tint catches up to the first scroll. The band doesn't change
  // layout, so it skips the cooldown.
  const [compact, setCompact] = useState(false);
  const [bandOpaque, setBandOpaque] = useState(false);
  const lastToggleRef = useRef(0);
  useEffect(() => {
    const scrollEl = mainScrollRef.current;
    if (!scrollEl) return;
    const onScroll = () => {
      setBandOpaque(scrollEl.scrollTop > 16);
      if (Date.now() - lastToggleRef.current < 400) return;
      setCompact((prev) => {
        if (!prev && scrollEl.scrollTop > 96) {
          lastToggleRef.current = Date.now();
          return true;
        }
        if (prev && scrollEl.scrollTop < 8) {
          lastToggleRef.current = Date.now();
          return false;
        }
        return prev;
      });
    };
    scrollEl.addEventListener("scroll", onScroll, { passive: true });
    return () => scrollEl.removeEventListener("scroll", onScroll);
  }, []);

  const header = (
    <header ref={setHeaderRef} className="relative">
      {/* Header band — `position: fixed` so it spans the true viewport width
          (including the scrollbar-gutter reserve on either side of <main>)
          instead of being clipped by <main>'s `overflow-x: clip`. Height +
          top sync to the in-flow header via ResizeObserver so the band's
          bottom matches the gradient hairline during the compact/expanded
          spring. Opacity fades on first-scroll so the section's backdrop
          (LoL splash / Steam profile bg) reads cleanly at the top. */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 bg-background/50 backdrop-blur-md transition-opacity duration-200"
        style={{
          top: `${headerTop}px`,
          height: `${headerHeight}px`,
          opacity: bandOpaque ? 1 : 0,
        }}
      />
      <m.div
        className="relative mx-auto max-w-4xl px-6"
        animate={{
          paddingTop: compact ? 8 : 24,
          paddingBottom: compact ? 8 : 12,
        }}
        transition={
          prefersReducedMotion
            ? { duration: 0 }
            : { type: "spring", stiffness: 380, damping: 32 }
        }
      >
        <div className="flex flex-col gap-3">
          <div
            className={cn(
              "flex flex-wrap items-center gap-3",
              actions ? "justify-between" : undefined
            )}
          >
            {identity}
            {actions}
          </div>
          {nav}
        </div>
      </m.div>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-linear-to-r from-transparent via-foreground/15 to-transparent"
      />
    </header>
  );

  return (
    <SectionShellProvider value={{ compact }}>
      {slot ? createPortal(header, slot) : null}
      <div className="flex flex-col gap-6">{children}</div>
    </SectionShellProvider>
  );
}
