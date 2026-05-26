import { HttpError } from "@/lib/http-error";

// Recharts ResponsiveContainer initialises with { width: -1, height: -1 } as a
// sentinel before ResizeObserver fires, producing a noisy but harmless warning.
if (import.meta.env.DEV) {
  const _warn = console.warn.bind(console);
  console.warn = (...args: unknown[]) => {
    if (typeof args[0] === "string" && args[0].startsWith("The width(-1)")) return;
    _warn(...args);
  };
}
import { toastError } from "@/lib/toast";
import { reportWebVitals } from "@/lib/web-vitals";
import {
  MutationCache,
  QueryCache,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import { LazyMotion, domMax } from "motion/react";
import { StrictMode, Suspense, lazy } from "react";
import { createRoot } from "react-dom/client";
import { getNavigationType } from "./lib/navigation-type";
import { emitRouteTransitionStart } from "./lib/route-transition-bus";
import { mainScrollRef } from "./lib/scroll-container";
import { routeTree } from "./routeTree.gen";
import "./index.css";
import "./styles/view-transitions.css";
import "./styles/motion.css";

const Toaster = lazy(() => import("sonner").then((m) => ({ default: m.Toaster })));

const router = createRouter({
  routeTree,
  defaultPreload: "intent",
  defaultPreloadStaleTime: 0,
  defaultViewTransition: {
    types: ({ fromLocation, toLocation }) => {
      const types = getNavigationType(fromLocation, toLocation);
      // Gate `view-transition-name: section-content` on whether the shell
      // itself needs to animate. The body attribute is read by a CSS rule in
      // styles/view-transitions.css; mutating it here happens before the
      // browser captures the OLD snapshot, so naming is in effect for both
      // halves of the morph pair (slide / fade) or absent entirely for
      // intra-section (per-element morphs run alone — no parent group
      // size-morph competing for the eye).
      const isSlide =
        Array.isArray(types) &&
        (types.includes("slide-left") || types.includes("slide-right"));
      const needsShellAnim =
        isSlide ||
        (Array.isArray(types) &&
          (types.includes("cross-section") || types.includes("account-swap")));
      document.body.dataset.vtShell = needsShellAnim ? "on" : "off";
      // For slide types, reset `<main>` scrollTop BEFORE the OLD snapshot is
      // captured. If we don't, the new route's useScrollResetOnNav effect
      // fires AFTER OLD but BEFORE NEW snapshot — flipping the
      // section-shell's compact header off in between — and the section-
      // content's viewport-top differs across the two snapshots. The
      // default group rect-morph then interpolates that delta, sliding the
      // content diagonally instead of purely horizontally.
      if (isSlide && mainScrollRef.current) mainScrollRef.current.scrollTop = 0;
      // Tell subscribers (e.g. the Steam profile-background video) that a
      // VT is about to start — fires only when this nav will actually
      // animate, so listeners can pause expensive continuous work during
      // the snapshot+slide window without churning on skipped navs.
      if (Array.isArray(types)) emitRouteTransitionStart();
      return types;
    },
  },
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

const errorMessage = (error: unknown, fallback: string) => {
  if (error instanceof HttpError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
};

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        if (error instanceof HttpError && error.status >= 400 && error.status < 500) {
          return false;
        }
        return failureCount < 3;
      },
    },
  },
  queryCache: new QueryCache({
    onError: (error, query) => {
      if (query.state.data === undefined) return;
      void toastError(errorMessage(error, "Background refresh failed"));
    },
  }),
  mutationCache: new MutationCache({
    onError: (error) => {
      void toastError(errorMessage(error, "Something went wrong"));
    },
  }),
});

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Root element #root not found in index.html");

createRoot(rootElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <LazyMotion features={domMax}>
        <RouterProvider router={router} />
      </LazyMotion>
      <Suspense fallback={null}>
        <Toaster theme="dark" richColors position="bottom-right" />
      </Suspense>
    </QueryClientProvider>
  </StrictMode>
);

reportWebVitals();
