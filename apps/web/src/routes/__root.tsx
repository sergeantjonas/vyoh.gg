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
import { meQueryOptions } from "@/identity/use-me";
import { API_PUBLIC_URL } from "@/lib/api-url";
import { PresenceMounts } from "@/lib/presence-mounts";
import { routeOwnsEntry } from "@/lib/route-owns-entry";
import { mainScrollRef } from "@/lib/scroll-container";
import { topLevelScope } from "@/lib/top-level-scope";
import { useAudio, useAudioHydration } from "@/lib/use-audio";
import { useAudioShortcut } from "@/lib/use-audio-shortcut";
import { useFaviconDot } from "@/lib/use-favicon-dot";
import { usePerfFlag } from "@/lib/use-perf-flag";
import { reportWebVitals } from "@/lib/web-vitals";
import { SplashProvider } from "@/lol/_shared/assets/splash-backdrop";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import type { QueryClient } from "@tanstack/react-query";
import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
} from "@tanstack/react-router";
import { m } from "motion/react";
import { Suspense, lazy, useEffect, useLayoutEffect, useRef, useState } from "react";
import appCss from "../index.css?url";
// `?url` rather than a bare side-effect import: the shell needs a real
// <link rel="stylesheet"> in the server-rendered HTML. A bare import works in
// the browser but leaves the first server response unstyled until the client
// bundle evaluates, which is a full-page flash on every cold load.
import motionCss from "../styles/motion.css?url";
import viewTransitionsCss from "../styles/view-transitions.css?url";

// Recharts ResponsiveContainer initialises with { width: -1, height: -1 } as a
// sentinel before ResizeObserver fires, producing a noisy but harmless warning.
if (import.meta.env.DEV) {
  const _warn = console.warn.bind(console);
  console.warn = (...args: unknown[]) => {
    if (typeof args[0] === "string" && args[0].startsWith("The width(-1)")) return;
    _warn(...args);
  };
}

const SITE_DESCRIPTION =
  "Personal cross-platform gaming dashboard — League of Legends, Steam, and more, stitched into one self-portrait.";

// Debug-only web-vitals overlay. Gated on usePerfFlag() at the mount site so
// the chunk is only fetched when ?perf / localStorage opt-in is set — keeps it
// out of the eager bundle for the 99% of visits that never enable it.
const PerfOverlay = lazy(() =>
  import("@/components/perf-overlay").then((mod) => ({ default: mod.PerfOverlay }))
);

// Declares the shape of the router context so route `loader`s can reach the
// Query cache in a typed way. Without this, `createRouter({ context })` in
// router.tsx type-checks against the default `{}` and the property is silently
// dropped — `context.queryClient` would then be a TS2741 at every loader.
// The factory is curried: `createRootRouteWithContext<T>()({ ... })`.
export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: RootLayout,
  shellComponent: RootDocument,
  notFoundComponent: NotFound,
  // Awaited at the root because almost everything downstream is keyed off it:
  // `useAccountFromSlug` resolves the LoL section's account out of this list,
  // `/lol` picks its redirect target from it, and `/` reads the primary
  // account. Priming it once here means every section route can render an
  // identity on the server instead of a spinner, at the cost of one request
  // that every route was going to make anyway.
  //
  // Deliberately NOT wrapped in try/catch. A failure here is the api being
  // unreachable, and `errorComponent` is the right place to say so — swallowing
  // it would hand every child route an empty account list and render a
  // confident "no accounts" page against what is really an outage.
  loader: ({ context: { queryClient } }) => queryClient.ensureQueryData(meQueryOptions()),
  // The base document head, absorbed from index.html when the Start shell took
  // over. Per-route head() exports merge over this, so anything a deep route
  // overrides (title, description, og:image) only needs its own key here as a
  // site-wide default.
  head: () => ({
    meta: [
      { charSet: "UTF-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1.0" },
      { name: "theme-color", content: "#0a0a0a" },
      { title: "vyoh.gg" },
      { name: "description", content: SITE_DESCRIPTION },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      {
        name: "apple-mobile-web-app-status-bar-style",
        content: "black-translucent",
      },
      { name: "apple-mobile-web-app-title", content: "vyoh" },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "vyoh.gg" },
      { property: "og:title", content: "vyoh.gg" },
      { property: "og:description", content: SITE_DESCRIPTION },
      { property: "og:url", content: "https://vyoh.gg/" },
      // Default site-wide OG image — overridden per-route by head() on routes
      // that ship their own template (match/champion/profile/Steam game).
      // Endpoint renders dynamically; HTTP cache absorbs the cost.
      { property: "og:image", content: `${API_PUBLIC_URL}/og/home.png` },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      {
        name: "robots",
        content: "index, follow, max-image-preview:large, max-snippet:-1",
      },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: `${API_PUBLIC_URL}/og/home.png` },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "stylesheet", href: viewTransitionsCss },
      { rel: "stylesheet", href: motionCss },
      { rel: "canonical", href: "https://vyoh.gg/" },
      { rel: "icon", type: "image/svg+xml", href: "/vyoh-orb-favicon.svg" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
      { rel: "manifest", href: "/manifest.json" },
    ],
  }),
});

// The document itself. `shellComponent` is the only place allowed to render
// <html>/<head>/<body>: it wraps every match, renders once per request on the
// server, and is what makes the markup a real document rather than a div that
// gets mounted into one. `className="dark"` stays on <html> because the theme
// tokens in index.css are scoped to it and a flash of the light palette before
// hydration would be visible.
function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootLayout() {
  // Was a bare call at the bottom of main.tsx. In an effect now because this
  // component also renders on the server, where there is no performance
  // observer to attach to and no browser to report from.
  useEffect(() => {
    reportWebVitals();
  }, []);
  useFaviconDot();
  // False through the server render AND the hydrating client render, so both
  // agree; flipped by an effect that only ever runs in the browser. The scope
  // fade below reads it to suppress its entrance on the very first paint —
  // see the comment at the `initial` prop for why that matters.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
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
                    // `!hydrated` suppresses the fade for the first paint
                    // only. Server-rendered markup that starts at opacity 0
                    // is invisible until Motion runs, which costs the two
                    // things this migration exists to buy: an HTML-only
                    // crawler sees the page's primary content behind an
                    // opacity rule, and LCP does not count an element that
                    // has not painted, so the largest element's timestamp
                    // slips to whenever hydration finishes.
                    //
                    // Nothing is lost visually — there is no previous route
                    // to fade away from on a cold load. `key={scope}` still
                    // remounts on every cross-scope navigation, and by then
                    // `hydrated` is true, so the fade re-engages exactly
                    // where it was always meant to run.
                    initial={ownsEntry || !hydrated ? false : { opacity: 0 }}
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
