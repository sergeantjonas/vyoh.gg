import { mainScrollRef } from "@/lib/scroll-container";
import { m, useReducedMotion } from "motion/react";
import { type ReactNode, type Ref, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  SectionLiveChip,
  type SectionLiveTab,
  type SectionTab,
  SectionTabRow,
  SectionTabsDropdown,
} from "./section-nav";
import { SectionShellProvider } from "./section-shell-context";

type SectionShellProps = {
  identity: ReactNode;
  // Optional slot rendered immediately after identity, before the tab row.
  // Model 3 uses it for the match-detail `‹ Matches` breadcrumb: on a detail
  // page the strip carries identity · breadcrumb · detail tabs (not section
  // tabs), so the breadcrumb represents section scope where a tab used to.
  // Omitted by every non-detail consumer (LoL listing, Steam) — left-untouched.
  leading?: ReactNode;
  actions?: ReactNode;
  // Structured tabs the shell renders three ways across viewport tiers (full
  // row ≥880px / filling section dropdown 640–879px / own-row dropdown <640px).
  // Empty (or omitted) renders no section nav — e.g. a detail page that hasn't
  // restored it yet.
  tabs?: SectionTab[];
  // Section-scoped `layoutId` for the active-tab underline morph. Required when
  // `tabs` is non-empty so LoL and Steam don't share a morph group.
  tabIndicatorId?: string;
  // Optional live route, rendered as a route-aware presence chip (not a tab).
  live?: SectionLiveTab | undefined;
  children: ReactNode;
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
  leading,
  actions,
  tabs = [],
  tabIndicatorId = "section-tab-indicator",
  live,
  children,
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
        {/* Tiered merged strip (sizing pass locked 2026-05-29, see
            nav-condensation-arc.md). One flex-wrap row whose pieces reorder by
            viewport via `order` + `basis`, so identity/live/actions each render
            ONCE (no per-tier duplication of interactive controls):
              ≥880px  identity · [tab row] · ⟶ · live · actions
              640-879 identity · [filling section dropdown] · live · actions
              <640    row1: identity · ⟶ · live · actions  /  row2: dropdown
            The full-row break is 880 (not 820): a long Riot ID like
            "Nine Tailed Fox#EUW" + 4 tabs + live chip crowds the 848 box at
            820, so collapse to the dropdown a bit sooner. */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-3.5">
          <div className="order-1 flex min-w-0 shrink items-center">{identity}</div>
          {leading && <div className="order-1 flex shrink-0 items-center">{leading}</div>}
          {tabs.length > 0 && (
            <>
              <div className="order-2 hidden shrink-0 min-[880px]:block">
                <SectionTabRow
                  tabs={tabs}
                  indicatorId={tabIndicatorId}
                  prefersReducedMotion={prefersReducedMotion}
                />
              </div>
              <SectionTabsDropdown
                tabs={tabs}
                onLive={live?.active ?? false}
                className="order-last basis-full min-[640px]:order-3 min-[640px]:basis-0 min-[640px]:grow min-[880px]:hidden"
              />
            </>
          )}
          <div className="order-3 ml-auto flex shrink-0 items-center gap-3">
            {live && (
              <SectionLiveChip live={live} prefersReducedMotion={prefersReducedMotion} />
            )}
            {actions}
          </div>
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
