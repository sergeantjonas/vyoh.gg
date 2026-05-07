import { Nav } from "@/components/nav";
import { SplashProvider } from "@/lol/splash-backdrop";
import { Outlet, createRootRoute, useRouterState } from "@tanstack/react-router";
import { AnimatePresence, m } from "motion/react";

export const Route = createRootRoute({
  component: RootLayout,
});

function RootLayout() {
  const { location } = useRouterState();
  return (
    <SplashProvider>
      <div className="min-h-dvh text-foreground">
        <Nav />
        <main className="mx-auto max-w-4xl p-6">
          <AnimatePresence mode="wait" initial={false}>
            <m.div
              key={location.pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              <Outlet />
            </m.div>
          </AnimatePresence>
        </main>
      </div>
    </SplashProvider>
  );
}
