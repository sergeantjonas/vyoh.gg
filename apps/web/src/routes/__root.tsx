import { CommandPalette } from "@/components/command-palette";
import { ErrorBoundary } from "@/components/error-boundary";
import { FetchProgress } from "@/components/fetch-progress";
import { Nav } from "@/components/nav";
import { OrbGlyph } from "@/components/orb-glyph";
import { PerfOverlay } from "@/components/perf-overlay";
import { ScrollToTop } from "@/components/scroll-to-top";
import { Button } from "@/components/ui/button";
import { mainScrollRef } from "@/lib/scroll-container";
import { SplashProvider } from "@/lol/_shared/assets/splash-backdrop";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import {
  HeadContent,
  Link,
  Outlet,
  createRootRoute,
  useRouterState,
} from "@tanstack/react-router";
import { m } from "motion/react";

export const Route = createRootRoute({
  component: RootLayout,
  notFoundComponent: NotFound,
});

function NotFound() {
  return (
    <div className="flex flex-col items-center gap-4 px-6 py-16 text-center">
      <OrbGlyph className="size-24" />
      <p className="text-lg font-medium">No such page.</p>
      <p className="max-w-sm text-sm text-muted-foreground">
        Wherever you were heading, vyoh.gg hasn't been there yet.
      </p>
      <Button variant="outline" size="sm" asChild>
        <Link to="/">Back home</Link>
      </Button>
    </div>
  );
}

function topLevelScope(pathname: string): string {
  const seg = pathname.split("/").filter(Boolean)[0];
  return seg ? `/${seg}` : "/";
}

function RootLayout() {
  const scope = useRouterState({
    select: (s) => topLevelScope(s.location.pathname),
  });
  return (
    <TooltipPrimitive.Provider delayDuration={150}>
      <SplashProvider>
        <HeadContent />
        <FetchProgress />
        <CommandPalette />
        <ScrollToTop />
        <ErrorBoundary>
          <PerfOverlay />
        </ErrorBoundary>
        <div className="flex h-dvh flex-col overflow-hidden text-foreground">
          <Nav />
          <main
            ref={(el) => {
              mainScrollRef.current = el;
            }}
            className="flex-1 overflow-y-auto [overflow-x:clip] [scrollbar-gutter:stable_both-edges]"
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
                  initial={{ opacity: 0 }}
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
    </TooltipPrimitive.Provider>
  );
}
