import { CommandPalette } from "@/components/command-palette";
import { FetchProgress } from "@/components/fetch-progress";
import { Nav } from "@/components/nav";
import { ScrollToTop } from "@/components/scroll-to-top";
import { SplashProvider } from "@/lol/splash-backdrop";
import { Outlet, createRootRoute, useRouterState } from "@tanstack/react-router";
import { AnimatePresence, m } from "motion/react";

export const Route = createRootRoute({
  component: RootLayout,
});

function topLevelScope(pathname: string): string {
  // First path segment determines the top-level scope ("/", "/lol", "/steam")
  // so sub-tab navigation within an area doesn't re-key this transition.
  const seg = pathname.split("/").filter(Boolean)[0];
  return seg ? `/${seg}` : "/";
}

function RootLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const scope = topLevelScope(pathname);

  return (
    <SplashProvider>
      <FetchProgress />
      <CommandPalette />
      <ScrollToTop />
      <div className="min-h-dvh text-foreground">
        <Nav />
        <main className="mx-auto max-w-4xl p-6">
          <AnimatePresence mode="wait" initial={false}>
            <m.div
              key={scope}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
            >
              <Outlet />
            </m.div>
          </AnimatePresence>
        </main>
      </div>
    </SplashProvider>
  );
}
