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
import { routeTree } from "./routeTree.gen";
import "./index.css";

const Toaster = lazy(() => import("sonner").then((m) => ({ default: m.Toaster })));

const router = createRouter({ routeTree });

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
