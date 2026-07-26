// Recharts ResponsiveContainer initialises with { width: -1, height: -1 } as a
// sentinel before ResizeObserver fires, producing a noisy but harmless warning.
if (import.meta.env.DEV) {
  const _warn = console.warn.bind(console);
  console.warn = (...args: unknown[]) => {
    if (typeof args[0] === "string" && args[0].startsWith("The width(-1)")) return;
    _warn(...args);
  };
}
import { AppErrorFallback, ErrorBoundary } from "@/components/error-boundary";
import { reportWebVitals } from "@/lib/web-vitals";
import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { LazyMotion, MotionConfig, domMax } from "motion/react";
import { StrictMode, Suspense, lazy } from "react";
import { createRoot } from "react-dom/client";
import { getRouter } from "./router";
import "./index.css";
import "./styles/view-transitions.css";
import "./styles/motion.css";

const Toaster = lazy(() => import("sonner").then((m) => ({ default: m.Toaster })));

// Called exactly once in the browser. The factory exists so the server render
// can build a per-request pair instead; see the note in router.tsx.
const router = getRouter();
// Same instance the route loaders read through router context — taking it off
// the router rather than constructing a second one is what keeps the provider
// and the loaders on one cache.
const { queryClient } = router.options.context;

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Root element #root not found in index.html");

createRoot(rootElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <LazyMotion features={domMax}>
        {/* reducedMotion="user" drops transform + layout animations under the OS
            preference while leaving opacity/color animations intact — the
            "replace, don't disable" principle as a single switch. Surface-level
            useReducedMotion() calls (orb mark, splash drift, card tilt, count-up)
            still apply on top for finer-grained replacements. */}
        <MotionConfig reducedMotion="user">
          {/* App-root error boundary (tier 1): catches a crash in the router
              itself or any provider above the route tree — anything the
              in-tree <Outlet> boundary in __root.tsx can't see. Renders a
              static, provider-independent reload screen. */}
          <ErrorBoundary fallback={<AppErrorFallback fullScreen />}>
            <RouterProvider router={router} />
          </ErrorBoundary>
        </MotionConfig>
      </LazyMotion>
      <Suspense fallback={null}>
        <Toaster theme="dark" richColors position="bottom-right" />
      </Suspense>
    </QueryClientProvider>
  </StrictMode>
);

reportWebVitals();
