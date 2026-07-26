import type { QueryClient } from "@tanstack/react-query";
import type { ReactElement, ReactNode } from "react";
import { isValidElement } from "react";
import { describe, expect, it, vi } from "vitest";

// Boot no real router: the property under test is what the factory hands to
// each caller, not route matching.
vi.mock("@tanstack/react-router", () => ({
  createRouter: (options: unknown) => ({ options }),
}));
vi.mock("./routeTree.gen", () => ({ routeTree: {} }));

const toastError = vi.fn();
vi.mock("./lib/toast", () => ({ toastError: (msg: string) => toastError(msg) }));

import { getRouter } from "./router";

const clientOf = (router: ReturnType<typeof getRouter>) =>
  (router.options.context as { queryClient: QueryClient }).queryClient;

function findElementByType(node: ReactNode, displayName: string): ReactElement | null {
  if (!node || typeof node !== "object") return null;
  if (Array.isArray(node)) {
    for (const child of node) {
      const hit = findElementByType(child, displayName);
      if (hit) return hit;
    }
    return null;
  }
  if (!isValidElement(node)) return null;
  const type = node.type as { displayName?: string; name?: string } | string;
  const typeName = typeof type === "string" ? type : (type.displayName ?? type.name);
  if (typeName === displayName) return node;
  const children = (node.props as { children?: ReactNode }).children;
  return findElementByType(children, displayName);
}

describe("getRouter", () => {
  it("gives every call its own QueryClient", () => {
    // Under SSR this factory runs once per request. If it ever collapses back
    // to a module singleton, one visitor's cached account data is served to
    // the next — so the isolation is a correctness property, not a style one.
    expect(clientOf(getRouter())).not.toBe(clientOf(getRouter()));
  });

  it("does not leak cache entries between calls", () => {
    const first = clientOf(getRouter());
    const second = clientOf(getRouter());

    first.setQueryData(["owner"], "account-a");

    expect(first.getQueryData(["owner"])).toBe("account-a");
    expect(second.getQueryData(["owner"])).toBeUndefined();
  });

  it("wraps the route matches in a MotionConfig with reducedMotion='user'", () => {
    // Inherited from the deleted main.test.tsx. The provider stack moved from
    // main.tsx into the router's `Wrap` during the Start cutover, so this is
    // the same assertion pointed at its new home: reduced-motion has to be
    // configured above every route, not per-surface.
    const wrapped = getRouter().options.Wrap?.({ children: null });
    const motionConfig = findElementByType(wrapped ?? null, "MotionConfig");

    expect(motionConfig).not.toBeNull();
    expect((motionConfig?.props as { reducedMotion?: string }).reducedMotion).toBe(
      "user"
    );
  });

  it("provides the same QueryClient it puts in router context", () => {
    // Two clients would type-check fine and silently double the cache: loaders
    // would prime one and components would read the other.
    const router = getRouter();
    const wrapped = router.options.Wrap?.({ children: null });
    const provider = findElementByType(wrapped ?? null, "QueryClientProvider");

    expect((provider?.props as { client?: unknown }).client).toBe(clientOf(router));
  });

  it("installs the SSR query hydration hook", () => {
    // `setupRouterSsrQueryIntegration` is what carries loader-primed data
    // across the server→client boundary. Drop the call and every awaited
    // loader still renders correct HTML, then hydrates against an empty
    // client cache — the failure shows up as a hydration mismatch and a
    // refetch of data the page already had, not as a build error.
    expect(typeof getRouter().options.hydrate).toBe("function");
  });

  it("keeps the error toast on the query cache the integration rewires", () => {
    // The integration replaces `queryCache.config` wholesale to intercept
    // redirects, calling through to whatever was there. If that call-through
    // ever regresses, background-refresh failures go silent: no error, no
    // toast, and stale data on screen with nothing to explain it.
    toastError.mockClear();
    const client = clientOf(getRouter());

    client.getQueryCache().config.onError?.(
      new Error("boom"),
      // Only queries that already hold data toast — a first-load failure is
      // rendered by the surface itself.
      { state: { data: "cached" } } as never
    );

    expect(toastError).toHaveBeenCalledWith("boom");
  });

  it("passes the QueryClient through router context so loaders share it", () => {
    // __root.tsx declares `context: { queryClient }` via
    // createRootRouteWithContext; loaders read the cache through it. A second
    // client built anywhere else would silently double the cache.
    const router = getRouter();
    expect(clientOf(router)).toBeDefined();
    expect(clientOf(router).getQueryCache()).toBeDefined();
  });
});
