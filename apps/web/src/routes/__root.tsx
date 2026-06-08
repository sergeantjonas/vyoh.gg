import { CommandPalette } from "@/components/command-palette";
import { CommandPaletteProvider } from "@/components/command-palette-context";
import { ErrorBoundary } from "@/components/error-boundary";
import { FetchProgress } from "@/components/fetch-progress";
import { Nav } from "@/components/nav";
import { NotFound } from "@/components/not-found";
import { OrbGlyph } from "@/components/orb-glyph";
import { ScrollProgress } from "@/components/scroll-progress";
import { ScrollToTop } from "@/components/scroll-to-top";
import { Button } from "@/components/ui/button";
import { PresenceMounts } from "@/lib/presence-mounts";
import { routeOwnsEntry } from "@/lib/route-owns-entry";
import { mainScrollRef } from "@/lib/scroll-container";
import { topLevelScope } from "@/lib/top-level-scope";
import { useFaviconDot } from "@/lib/use-favicon-dot";
import { usePerfFlag } from "@/lib/use-perf-flag";
import { SplashProvider } from "@/lol/_shared/assets/splash-backdrop";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import {
  HeadContent,
  Outlet,
  createRootRoute,
  useRouter,
  useRouterState,
} from "@tanstack/react-router";
import { m } from "motion/react";
import { Suspense, lazy, useEffect, useLayoutEffect, useRef } from "react";

// Debug-only web-vitals overlay. Gated on usePerfFlag() at the mount site so
// the chunk is only fetched when ?perf / localStorage opt-in is set — keeps it
// out of the eager bundle for the 99% of visits that never enable it.
const PerfOverlay = lazy(() =>
  import("@/components/perf-overlay").then((mod) => ({ default: mod.PerfOverlay }))
);

export const Route = createRootRoute({
  component: RootLayout,
  notFoundComponent: NotFound,
});

function RootLayout() {
  useFaviconDot();
  const perfEnabled = usePerfFlag();
  const scope = useRouterState({
    select: (s) => topLevelScope(s.location.pathname),
  });
  // When the active match chain opts into owning its entrance via
  // `staticData: { ownsEntry: true }`, skip the global scope-fade for this
  // mount — the route's own variants (e.g. landing's editorial cascade) are
  // the only entrance the user should see. Cross-scope navigations still
  // remount the m.div via `key={scope}`, so the standard fade re-engages
  // whenever the next scope doesn't claim ownership.
  const ownsEntry = useRouterState({
    select: (s) => routeOwnsEntry(s.matches),
  });
  // Reset <main> scroll when crossing a top-level scope boundary. Section
  // roots stay mounted across child routes and own intra-section reset
  // (with their own skip lists for list↔detail back-restore); cross-scope
  // navigation unmounts the previous section, so a freshly-mounted section
  // or sectionless route would otherwise inherit the previous scrollTop.
  const prevScopeRef = useRef<string | null>(null);
  useLayoutEffect(() => {
    const prev = prevScopeRef.current;
    prevScopeRef.current = scope;
    if (prev === null || prev === scope) return;
    mainScrollRef.current?.scrollTo(0, 0);
  }, [scope]);
  // Keep --main-h in sync with <main>'s actual height across viewport resizes
  // and browser-chrome reflows (mobile address bar collapse, etc.). The
  // callback ref handles first paint; this effect handles every subsequent
  // change. ResizeObserver fires synchronously on each resize round, so
  // descendants using `var(--main-h)` get the new value before paint.
  useEffect(() => {
    const main = mainScrollRef.current;
    if (!main) return;
    const update = () => {
      main.style.setProperty("--main-h", `${main.clientHeight}px`);
    };
    const observer = new ResizeObserver(update);
    observer.observe(main);
    return () => observer.disconnect();
  }, []);
  // Eagerly preload the route chunks for /steam and /lol on idle so the
  // first cross-section navigation doesn't pay a fetch cost. Goes beyond
  // the router's intent-based hover preload, which only fires when the
  // pointer touches a Link. Neither route has a loader, so this is a
  // pure JS-chunk warmup.
  const router = useRouter();
  useEffect(() => {
    const preload = () => {
      router.preloadRoute({ to: "/steam" }).catch(() => {});
      router.preloadRoute({ to: "/lol" }).catch(() => {});
    };
    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(preload, { timeout: 2000 });
      return () => window.cancelIdleCallback(id);
    }
    const id = window.setTimeout(preload, 200);
    return () => window.clearTimeout(id);
  }, [router]);
  return (
    <TooltipPrimitive.Provider delayDuration={150}>
      <CommandPaletteProvider>
        <SplashProvider>
          <HeadContent />
          <PresenceMounts />
          <FetchProgress />
          <CommandPalette />
          <ScrollToTop />
          <ErrorBoundary>
            {perfEnabled && (
              <Suspense fallback={null}>
                <PerfOverlay />
              </Suspense>
            )}
          </ErrorBoundary>
          <div className="flex h-dvh flex-col overflow-hidden text-foreground">
            <Nav />
            {/* Section header portal target. SectionShell renders its sticky
                header into this slot via createPortal so the header lives
                OUTSIDE <main> — only <main>'s content (named vt-main) slides
                during a view transition; the header holds still. The slot has
                no intrinsic height; it grows to fit the portaled header and
                its compact-spring padding animation, and <main flex-1> absorbs
                the delta. */}
            <div id="section-header-slot" className="relative z-40" />
            <ScrollProgress />
            <main
              ref={(el) => {
                mainScrollRef.current = el;
                // Publish <main>'s visible height as a CSS variable that
                // descendants can use to size themselves against the actual
                // scroll viewport — useMainHeight (a hook variant) hit a React
                // commit-ordering bug where a child's effect read the ref
                // before the parent ref attached. Writing the variable from
                // the callback ref runs during commit (before paint), so the
                // first painted frame is already correct. ResizeObserver below
                // keeps it current on viewport / browser-chrome changes.
                if (el) {
                  el.style.setProperty("--main-h", `${el.clientHeight}px`);
                }
              }}
              data-vt-main=""
              // `relative` so Motion's `useScroll({ target, container })`
              // walks the offsetParent chain correctly: descendants' offsetTop
              // is measured against <main>, not against whatever non-static
              // ancestor happens to be next up the tree. Without this, Motion
              // logs "container has a non-static position" and the per-target
              // scroll progress is computed in the wrong frame.
              //
              // No `scroll-snap-type` here — the recap migrated off mandatory
              // snap (chunk 2 of the persistent-frame arc). Snap fought the
              // mouse wheel, produced mid-snap dead zones, and forced every
              // beat to be its own 100dvh pin scope; the persistent-frame
              // pattern uses one sticky scope per chapter with normal-flow
              // beat zones and a view-timeline-driven fade instead. Stale
              // [scroll-snap-align] / [scroll-snap-stop] classes still live
              // on a few chapters that have not been rewritten yet — they
              // are inert without a snap-type on the container and get
              // cleaned up alongside each chapter's own migration.
              className="relative flex-1 overflow-y-auto [overflow-anchor:none] [overflow-x:clip] [scrollbar-gutter:stable_both-edges]"
            >
              <div className="mx-auto max-w-4xl p-6">
                <ErrorBoundary
                  fallback={(error) => (
                    <div className="flex flex-col items-center gap-4 rounded-md border border-destructive/30 bg-destructive/10 px-6 py-10 text-center">
                      <OrbGlyph className="size-16" />
                      <p className="text-sm font-medium text-destructive">
                        Something broke on this page.
                      </p>
                      <p className="font-mono text-xs text-muted-foreground">
                        {error.message}
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.location.reload()}
                      >
                        Reload
                      </Button>
                    </div>
                  )}
                >
                  <m.div
                    key={scope}
                    initial={ownsEntry ? false : { opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.35, ease: "easeOut" }}
                  >
                    <Outlet />
                  </m.div>
                </ErrorBoundary>
              </div>
            </main>
          </div>
        </SplashProvider>
      </CommandPaletteProvider>
    </TooltipPrimitive.Provider>
  );
}
