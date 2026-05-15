import { mainScrollRef } from "@/lib/scroll-container";
import { cn } from "@/lib/utils";
import { useSteamSummary } from "@/steam/use-steam-summary";
import { Link, Outlet, createFileRoute, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Library, ListChecks, Trophy } from "lucide-react";
import { AnimatePresence, type Variants, m, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export const Route = createFileRoute("/steam")({
  component: SteamLayout,
});

const TABS = [
  { to: "/steam", label: "Profile", Icon: LayoutDashboard, exact: true },
  {
    to: "/steam/library",
    label: "Library",
    Icon: Library,
    exact: false,
    // /steam/game/$appid is a Library drill-in but lives outside the /library/* subtree.
    extraPrefixes: ["/steam/game"],
  },
  { to: "/steam/wishlist", label: "Wishlist", Icon: ListChecks, exact: false },
  { to: "/steam/achievements", label: "Achievements", Icon: Trophy, exact: false },
] as const;

const tabSlideVariants: Variants = {
  enter: (d: number) => ({ opacity: 0, x: d * 32 }),
  center: { opacity: 1, x: 0 },
  exit: (d: number) => ({ opacity: 0, x: d * -32 }),
};

function isTabActive(tab: (typeof TABS)[number], pathname: string): boolean {
  if (tab.exact) return pathname === tab.to;
  if (pathname === tab.to || pathname.startsWith(`${tab.to}/`)) return true;
  if ("extraPrefixes" in tab) {
    return tab.extraPrefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  }
  return false;
}

function SteamLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { data: summary } = useSteamSummary();
  const prefersReducedMotion = useReducedMotion();

  // Compute slide direction synchronously during render so the entering element
  // always receives the correct `initial` on the same frame it mounts.
  const slideDirectionRef = useRef(0);
  const prevPathnameRef = useRef(pathname);
  if (prevPathnameRef.current !== pathname) {
    const prevIdx = TABS.findIndex((tab) => isTabActive(tab, prevPathnameRef.current));
    const currIdx = TABS.findIndex((tab) => isTabActive(tab, pathname));
    slideDirectionRef.current =
      prevIdx !== -1 && currIdx !== -1 ? Math.sign(currIdx - prevIdx) : 0;
    prevPathnameRef.current = pathname;
  }
  const effectiveDir = prefersReducedMotion ? 0 : slideDirectionRef.current;

  // Header ref + viewport-rect tracking. The fixed-position header band (below)
  // needs to match the in-flow header's height *and* sit at the same viewport y
  // — the header is sticky inside <main> so its viewport top is at main's top
  // edge (≈ global nav height), not at viewport top. Anchoring the band to
  // `top: 0` instead would float it up over the nav. Width comes from the band
  // being `fixed inset-x-0`, which spans the true viewport including the
  // scrollbar-gutter reserve on either side of <main> — that's the whole point
  // of using fixed positioning here (it escapes <main>'s overflow-x: clip).
  const headerRef = useRef<HTMLElement>(null);
  const [headerHeight, setHeaderHeight] = useState(0);
  const [headerTop, setHeaderTop] = useState(0);
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const update = () => {
      const rect = el.getBoundingClientRect();
      setHeaderHeight(rect.height);
      setHeaderTop(rect.top);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    // Window resize can shift main's top edge (e.g., nav reflows at a different
    // breakpoint) without the header element itself resizing.
    window.addEventListener("resize", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, []);

  // Sticky header compact behaviour mirrors the LoL layout: scroll past 96 → compact,
  // scroll back under 8 → expanded. Tab navigation resets scrollTop to 0, which fires
  // the spring expansion (paddingTop 8 → 24) — the visible "slide down" on every
  // section/tab entry. Hysteresis + cooldown prevent oscillation around the threshold.
  // Two scroll-driven states with different thresholds. `compact` drives the
  // header padding spring (wide hysteresis + cooldown defends against the
  // scroll-anchoring flap loop). `bandOpaque` drives the fixed band's opacity
  // and uses a much smaller threshold (16px) so the tint catches up to the
  // first scroll — otherwise content goes under the header before the band
  // has faded in, and you see content briefly through a transparent header.
  // The band doesn't change layout, so it doesn't need the cooldown.
  const [compact, setCompact] = useState(false);
  const [bandOpaque, setBandOpaque] = useState(false);
  const lastToggleRef = useRef(0);
  useEffect(() => {
    const el = mainScrollRef.current;
    if (!el) return;
    const onScroll = () => {
      setBandOpaque(el.scrollTop > 16);
      if (Date.now() - lastToggleRef.current < 400) return;
      setCompact((prev) => {
        if (!prev && el.scrollTop > 96) {
          lastToggleRef.current = Date.now();
          return true;
        }
        if (prev && el.scrollTop < 8) {
          lastToggleRef.current = Date.now();
          return false;
        }
        return prev;
      });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="flex flex-col gap-6">
      {summary?.profileBackgroundUrl &&
        typeof document !== "undefined" &&
        createPortal(
          // Fade the backdrop in on mount instead of having it pop in the
          // moment `summary` resolves — the network round-trip means the
          // image/video appears noticeably after first paint, which reads as
          // jarring without the easing.
          <m.div
            aria-hidden="true"
            className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
            initial={prefersReducedMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={
              prefersReducedMotion ? { duration: 0 } : { duration: 0.6, ease: "easeOut" }
            }
          >
            {summary.profileBackgroundVideoUrl && !prefersReducedMotion ? (
              <video
                key={summary.profileBackgroundVideoUrl}
                src={summary.profileBackgroundVideoUrl}
                poster={summary.profileBackgroundUrl}
                autoPlay
                loop
                muted
                playsInline
                className="size-full scale-105 object-cover blur-[2px]"
              />
            ) : (
              <img
                src={summary.profileBackgroundUrl}
                alt=""
                className="size-full scale-105 object-cover blur-[2px]"
              />
            )}
            {/* Gradient mask anchored heavier at the bottom so the page content
                cards stay focal. Mirrors the LoL splash gradient shape. The
                bottom stop is /95 (not /100) so a hint of image texture
                survives below the cards instead of fading to flat dark. */}
            <div className="absolute inset-0 bg-linear-to-b from-background/40 via-background/70 to-background/95" />
          </m.div>,
          document.body
        )}
      <header
        ref={headerRef}
        className="sticky top-0 z-40 ml-[calc(50%-50vw)] -mt-6 w-screen"
      >
        {/* Header band — `position: fixed` so it spans the true viewport width
            (including the scrollbar-gutter reserve on either side of <main>)
            instead of being clipped by <main>'s overflow-x: clip. Lives inside
            the header so it inherits the z-40 stacking context — that puts it
            above content scrolling under the header but below the m.div content
            (which paints later in DOM order). Height syncs to the in-flow
            header via ResizeObserver so the band's bottom matches the gradient
            hairline during the compact/expanded spring. Opacity fades on
            `compact` so the band only appears once content scrolls under. */}
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
            <section className="flex items-center gap-3">
              {summary ? (
                <img
                  src={
                    summary.animatedAvatarUrl && !prefersReducedMotion
                      ? summary.animatedAvatarUrl
                      : summary.avatarUrl
                  }
                  alt=""
                  className={cn(
                    "rounded-full object-cover ring-1 ring-border transition-all",
                    compact ? "size-10" : "size-12"
                  )}
                />
              ) : (
                <div
                  className={cn(
                    "animate-pulse rounded-full bg-muted ring-1 ring-border transition-all",
                    compact ? "size-10" : "size-12"
                  )}
                />
              )}
              {summary ? (
                <span className="text-xl font-semibold">{summary.personaName}</span>
              ) : (
                <div className="h-5 w-32 animate-pulse rounded bg-muted" />
              )}
            </section>
            <nav aria-label="Steam sections" className="flex items-center gap-1">
              {TABS.map((tab) => {
                const active = isTabActive(tab, pathname);
                return (
                  <Link
                    key={tab.to}
                    to={tab.to}
                    className={cn(
                      "group relative flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors",
                      active
                        ? "text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <m.span
                      key={active ? 1 : 0}
                      initial={
                        active && !prefersReducedMotion ? { scale: 0.75, y: -4 } : false
                      }
                      animate={{ scale: 1, y: 0 }}
                      transition={{ type: "spring", stiffness: 450, damping: 18 }}
                      className="inline-flex"
                    >
                      <tab.Icon
                        className={cn(
                          "size-4 transition-colors",
                          active
                            ? "text-blue-400 drop-shadow-[0_0_6px_rgba(96,165,250,0.5)]"
                            : "text-muted-foreground group-hover:text-foreground"
                        )}
                      />
                    </m.span>
                    {tab.label}
                    {active && (
                      <m.div
                        layoutId="steam-tab-indicator"
                        className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-linear-to-r from-blue-400 via-cyan-400 to-sky-300"
                        animate={{
                          boxShadow: [
                            "0 0 0px 0px rgba(96,165,250,0)",
                            "0 0 10px 1px rgba(96,165,250,0.45)",
                            "0 0 0px 0px rgba(96,165,250,0)",
                          ],
                        }}
                        transition={{
                          default: { type: "spring", stiffness: 500, damping: 35 },
                          boxShadow: {
                            duration: 2.4,
                            repeat: Number.POSITIVE_INFINITY,
                            ease: "easeInOut",
                          },
                        }}
                      />
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>
        </m.div>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-linear-to-r from-transparent via-foreground/15 to-transparent"
        />
      </header>
      <AnimatePresence mode="popLayout" initial={false} custom={effectiveDir}>
        <m.div
          key={pathname}
          custom={effectiveDir}
          variants={tabSlideVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
        >
          <Outlet />
        </m.div>
      </AnimatePresence>
    </div>
  );
}
