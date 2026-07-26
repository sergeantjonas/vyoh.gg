import { HttpError } from "@/lib/http-error";
import { toastError } from "@/lib/toast";
import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { getNavigationType } from "./lib/navigation-type";
import { emitRouteTransitionStart } from "./lib/route-transition-bus";
import { mainScrollRef } from "./lib/scroll-container";
import { routeTree } from "./routeTree.gen";

const errorMessage = (error: unknown, fallback: string) => {
  if (error instanceof HttpError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
};

/**
 * Builds the QueryClient + router pair for one consumer.
 *
 * This is a factory rather than a pair of module-level singletons because the
 * server render must not share a cache between requests: a module singleton in
 * a long-lived Node process would serve one visitor's account data to the next.
 * The browser still calls it exactly once, so SPA behaviour is unchanged.
 *
 * The name and `() => router` shape are what TanStack Start's entry contract
 * expects, so the entry cutover doesn't have to reshape this again.
 */
export function getRouter() {
  // Declared above `createRouter` on purpose: the router options object is an
  // argument expression, so it is evaluated before the call. A `queryClient`
  // declared further down would still be in its temporal dead zone here and
  // throw `ReferenceError`.
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

  return createRouter({
    routeTree,
    // Route loaders read the Query cache through this context. Its shape is
    // declared by `createRootRouteWithContext` in routes/__root.tsx, which is
    // what makes this property required rather than silently widened to `{}`.
    context: { queryClient },
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
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
