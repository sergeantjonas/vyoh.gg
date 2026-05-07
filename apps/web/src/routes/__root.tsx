import { CommandPalette } from "@/components/command-palette";
import { ErrorBoundary } from "@/components/error-boundary";
import { FetchProgress } from "@/components/fetch-progress";
import { Nav } from "@/components/nav";
import { PerfOverlay } from "@/components/perf-overlay";
import { ScrollToTop } from "@/components/scroll-to-top";
import { Button } from "@/components/ui/button";
import { SplashProvider } from "@/lol/splash-backdrop";
import {
  HeadContent,
  Outlet,
  createRootRoute,
  useRouterState,
} from "@tanstack/react-router";
import { m } from "motion/react";

export const Route = createRootRoute({
  component: RootLayout,
});

function topLevelScope(pathname: string): string {
  const seg = pathname.split("/").filter(Boolean)[0];
  return seg ? `/${seg}` : "/";
}

function RootLayout() {
  const scope = useRouterState({
    select: (s) => topLevelScope(s.location.pathname),
  });
  return (
    <SplashProvider>
      <HeadContent />
      <FetchProgress />
      <CommandPalette />
      <ScrollToTop />
      <ErrorBoundary>
        <PerfOverlay />
      </ErrorBoundary>
      <div className="min-h-dvh text-foreground">
        <Nav />
        <main className="mx-auto max-w-4xl p-6">
          <ErrorBoundary
            fallback={(error) => (
              <div className="flex flex-col items-start gap-3 rounded-md border border-destructive/30 bg-destructive/10 p-4">
                <p className="text-sm font-medium text-destructive">
                  Something broke on this page.
                </p>
                <p className="font-mono text-xs text-muted-foreground">{error.message}</p>
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
        </main>
      </div>
    </SplashProvider>
  );
}
