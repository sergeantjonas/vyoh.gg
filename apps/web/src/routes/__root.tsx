import { CommandPalette } from "@/components/command-palette";
import { CommandPaletteProvider } from "@/components/command-palette-context";
import {
  AppErrorFallback,
  ErrorBoundary,
  WidgetBoundary,
} from "@/components/error-boundary";
import { FetchProgress } from "@/components/fetch-progress";
import { Nav } from "@/components/nav";
import { NotFound } from "@/components/not-found";
import { ScrollProgress } from "@/components/scroll-progress";
import { ScrollToTop } from "@/components/scroll-to-top";
import { PresenceMounts } from "@/lib/presence-mounts";
import { routeOwnsEntry } from "@/lib/route-owns-entry";
import { mainScrollRef } from "@/lib/scroll-container";
import { topLevelScope } from "@/lib/top-level-scope";
import { useAudio, useAudioHydration } from "@/lib/use-audio";
import { useAudioShortcut } from "@/lib/use-audio-shortcut";
import { useFaviconDot } from "@/lib/use-favicon-dot";
import { usePerfFlag } from "@/lib/use-perf-flag";
import { SplashProvider } from "@/lol/_shared/assets/splash-backdrop";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import type { QueryClient } from "@tanstack/react-query";
import {
  HeadContent,
  Outlet,
  createRootRouteWithContext,
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

// Declares the shape of the router context so route `loader`s can reach the
// Query cache in a typed way. Without this, `createRouter({ context })` in
// main.tsx type-checks against the default `{}` and the property is silently
// dropped — `context.queryClient` would then be a TS2741 at every loader.
// The factory is curried: `createRootRouteWithContext<T>()({ ... })`.
export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
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
  useAudioHydration();
  useAudioShortcut();
  const { play } = useAudio();
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
  // Sound on every resolved navigation. `useRouterState` selectors fall
  // silent when a route opts into its own entrance (ownsEntry routes like
  // `/` and `/lol/$accountSlug` don't trip the pathname selector cleanly
  // because the state shape they advertise doesn't change in a way the
  // selector observes mid-VT). Router events fire regardless.
  useEffect(() => {
    let prev: string | null = null;
    const unsub = router.subscribe("onResolved", ({ toLocation }) => {
      const next = toLocation.pathname;
      if (prev === null) {
        prev = next;
        return;
      }
      if (prev === next) return;
      prev = next;
      play("nav.transition");
    });
    return unsub;
  }, [router, play]);
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
          {/* Widget-tier boundary: a crash in the palette overlay (grammar
              parser, preview render) fails silently to nothing rather than
              taking the whole app down with it. */}
          <WidgetBoundary fallback={null}>
            <CommandPalette />
          </WidgetBoundary>
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
              // beat zones and a view-timeline-driven fade instead. The last
              // stale [scroll-snap-align] was removed on 2026-07-26; the only
              // snap left in the app is the horizontal thumbnail rail in
              // screenshot-lightbox.tsx, which owns its own container.
              className="relative flex-1 overflow-y-auto [overflow-anchor:none] [overflow-x:clip] [scrollbar-gutter:stable_both-edges]"
            >
              <div className="mx-auto max-w-4xl p-6">
                <ErrorBoundary
                  onError={() => play("error.toast")}
                  fallback={(error) => (
                    <AppErrorFallback
                      error={error}
                      title="Something broke on this page."
                    />
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
