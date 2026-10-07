import { mainScrollRef } from "@/lib/scroll-container";
import { useMediaQuery } from "@/lib/use-media-query";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "motion/react";
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
  // Omitted by the LoL listing; the Steam layout uses it for its `Playing` chip, whose tab row is too full for the `live` slot — left-untouched.
  leading?: ReactNode;
  // The section's landing route as a tab, for the collapsed dropdown only.
  // The full row has no Profile tab (the identity is that link), but the
  // dropdown names the current section on its trigger, and without this it
  // would read "Sections" on the one route the identity link points at.
  indexTab?: SectionTab | undefined;
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
  // Current route pathname. When provided, every change re-syncs the scroll-
  // driven `compact` state to the destination's scroll position, since the
  // shell outlives tab navs and would otherwise carry the source's state.
  pathname?: string;
  // True when a hero card upstream (LoL `LolIdentityHero` / Steam
  // `SteamIdentityHero`) owns the identity at scroll-top, so the strip's
  // identity slot resolves to `null` while not compact. Drives the narrow-
  // viewport (<640px) layout: the dropdown sits on row 1 rather than its own
  // row 2, so the strip doesn't read as a bar of empty whitespace above a
  // dropdown, and it stays there once the identity morphs in — the identity
  // shrinks to its avatar (`avatarOnly`) to fit beside it instead. Moving the
  // dropdown to a second row on compact would grow the strip by a row, and
  // the strip sits above <main>, so that row would shove the content down
  // mid-scroll.
  heroOwnsIdentity?: boolean;
  children: ReactNode;
  // External ref to the <header>; merged with the shell's internal ref.
  // Consumers who need DOM access (e.g. LoL writing `--account-header-h`) pass
  // a ref here OR use `onHeaderRect` for the callback flavour.
  headerRef?: Ref<HTMLElement>;
  // Fires on initial mount, every ResizeObserver tick, and window resize.
  // Identity is captured in a ref so inline callbacks don't re-subscribe.
  onHeaderRect?: (rect: DOMRect) => void;
  // Expected bottom edge of the header in viewport px. `--account-header-h`
  // is only ever written from JS after measurement, so anything docked under
  // the header would sit at the viewport top on the server-rendered frame;
  // this is the CSS-visible stand-in for that frame, replaced as soon as the
  // ResizeObserver fires. A per-section number because each section's strip
  // content sets its height; it is the wide-viewport measurement, so a
  // wrapped narrow header is briefly taller than declared.
  headerDockPx?: number | undefined;
};

export function SectionShell({
  identity,
  leading,
  actions,
  tabs = [],
  tabIndicatorId = "section-tab-indicator",
  live,
  pathname,
  heroOwnsIdentity = false,
  children,
  headerRef: externalHeaderRef,
  onHeaderRect,
  headerDockPx,
  indexTab,
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

  // Below 640px a hero route keeps the dropdown on row 1 in both states (see
  // `heroOwnsIdentity`), so the identity that morphs in has to fit beside it.
  const wideStrip = useMediaQuery("(min-width: 640px)");
  const avatarOnly = heroOwnsIdentity && !wideStrip;

  // Two scroll-driven states with different thresholds. `compact` hands the
  // identity from the hero to the strip, with wide hysteresis (>96 enter, <8
  // exit). It must never change the strip's height: the strip sits above
  // <main>, so every pixel it gained or lost would move the content on top of
  // the finger's own travel. `bandOpaque` drives the band's opacity off a much
  // smaller threshold (16px) so the tint catches up to the first scroll.
  const [compact, setCompact] = useState(false);
  const [bandOpaque, setBandOpaque] = useState(false);
  useEffect(() => {
    const scrollEl = mainScrollRef.current;
    if (!scrollEl) return;
    const onScroll = () => {
      const top = scrollEl.scrollTop;
      setBandOpaque(top > 16);
      setCompact((prev) => (prev ? top >= 8 : top > 96));
    };
    scrollEl.addEventListener("scroll", onScroll, { passive: true });
    return () => scrollEl.removeEventListener("scroll", onScroll);
  }, []);

  // Sync the scroll-driven states to the current scrollTop on every route
  // transition. SectionShell is the section layout — it doesn't remount on
  // tab nav, so the destination would otherwise commit with the source's
  // `compact` and only correct itself when the reset's scroll event lands.
  //
  // Reading `scrollTop` directly here — rather than unconditionally setting
  // compact=false — keeps panel-open navs honest. List↔detail-panel pairs
  // skip `useScrollResetOnNav`'s top-reset (the list stays mounted under
  // the panel), so `scrollTop` carries over. Unconditionally collapsing
  // would yank the strip out of compact the moment a detail panel opens.
  // Tab navs still scroll-reset to 0 in the section root's
  // `useScrollResetOnNav`, so this effect runs AFTER that reset and reads
  // the post-reset position — compact correctly exits there too.
  // biome-ignore lint/correctness/useExhaustiveDependencies: `pathname` is the trigger, see comment above
  useEffect(() => {
    const scrollEl = mainScrollRef.current;
    const scrollTop = scrollEl?.scrollTop ?? 0;
    if (scrollTop > 96) setCompact(true);
    else if (scrollTop < 8) setCompact(false);
    setBandOpaque(scrollTop > 16);
  }, [pathname]);

  const header = (
    <header ref={setHeaderRef} className="relative">
      {/* Header band — `position: fixed` so it spans the true viewport width
          (including the scrollbar-gutter reserve on either side of <main>)
          instead of being clipped by <main>'s `overflow-x: clip`. Height +
          top sync to the in-flow header via ResizeObserver so the band's
          bottom matches the gradient hairline whenever the strip reflows.
          Opacity fades on first-scroll so the section's backdrop (LoL splash
          / Steam profile bg) reads cleanly at the top. */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 bg-background/50 backdrop-blur-md transition-opacity duration-200"
        style={{
          top: `${headerTop}px`,
          height: `${headerHeight}px`,
          opacity: bandOpaque ? 1 : 0,
        }}
      />
      <div className="relative mx-auto max-w-4xl px-6 py-3">
        {/* Tiered merged strip (sizing pass locked 2026-05-29, see
            nav-condensation-arc.md). One flex-wrap row whose pieces reorder by
            viewport via `order` + `basis`, so identity/live/actions each render
            ONCE (no per-tier duplication of interactive controls):
              ≥880px  identity · [tab row] · ⟶ · live · actions
              640-879 identity · [filling section dropdown] · live · actions
              <640    row1: identity · ⟶ · live · actions  /  row2: dropdown
                      (hero route: row1 only — avatar · dropdown · actions)
            The full-row break is 880 (not 820): a long Riot ID like
            "Nine Tailed Fox#EUW" + 4 tabs + live chip crowds the 848 box at
            820, so collapse to the dropdown a bit sooner. `min-h-10` is the
            identity's avatar height, so a hero route's row keeps its height
            when the identity mounts into it. Below 640px a hero route also
            reserves the avatar's width while the slot is empty: a crowded
            row (live chip, 320px phone) would otherwise wrap its actions onto
            a second line the moment the avatar arrives. */}
        <div className="flex min-h-10 flex-wrap items-center gap-x-3 gap-y-3.5">
          <div
            className={cn(
              "order-1 flex min-w-0 shrink items-center",
              heroOwnsIdentity && "min-h-10 max-[639px]:min-w-10"
            )}
          >
            {identity}
          </div>
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
                tabs={indexTab ? [indexTab, ...tabs] : tabs}
                onLive={live?.active ?? false}
                className={cn(
                  // 640px+ is unchanged: dropdown inline on row 1.
                  "min-[640px]:order-3 min-[640px]:basis-0 min-[640px]:grow min-[880px]:hidden",
                  // <640px: on a hero route the dropdown shares row 1 in both
                  // `compact` states (see `heroOwnsIdentity`). Any other route
                  // gives it its own row 2 so the identity has row 1 to itself.
                  heroOwnsIdentity ? "order-3 basis-0 grow" : "order-last basis-full"
                )}
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
      </div>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-linear-to-r from-transparent via-foreground/15 to-transparent"
      />
    </header>
  );

  return (
    <SectionShellProvider value={{ compact, avatarOnly, headerDockPx }}>
      {slot ? createPortal(header, slot) : null}
      <div className="flex flex-col gap-6">{children}</div>
    </SectionShellProvider>
  );
}
