import type { QueryClient } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import type { ComponentType, ReactElement, ReactNode } from "react";
import { createElement, isValidElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

// Boot no real router: the property under test is what the factory hands to
// each caller, not route matching.
vi.mock("@tanstack/react-router", () => ({
  createRouter: (options: unknown) => ({ options }),
}));
vi.mock("./routeTree.gen", () => ({ routeTree: {} }));

const toastError = vi.fn();
vi.mock("./lib/toast", () => ({ toastError: (msg: string) => toastError(msg) }));

// The types callback under test consumes whatever the classifier returns, so
// the classifier itself (engine gates included) stays out of scope here — it
// has its own tests via navigation-type.
const navigationType = vi.fn();
vi.mock("./lib/navigation-type", () => ({
  getNavigationType: (...args: unknown[]) => navigationType(...args),
}));

const emitRouteTransitionStart = vi.fn();
vi.mock("./lib/route-transition-bus", () => ({
  emitRouteTransitionStart: () => emitRouteTransitionStart(),
}));

import { HttpError } from "@/lib/http-error";
import { mainScrollRef } from "./lib/scroll-container";
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

  it("gives every route a route-tier error and pending component", () => {
    // Router escalates a rejected loader to the nearest `errorComponent`.
    // Without these defaults the nearest one is the root's, so a single failing
    // endpoint takes nav, backdrop and palette down with the region it broke —
    // and on a cold server render, takes the document down with it. Nothing
    // fails to compile if they go missing; the regression is only visible when
    // an upstream is already down.
    const { options } = getRouter();
    expect(typeof options.defaultErrorComponent).toBe("function");
    expect(typeof options.defaultPendingComponent).toBe("function");
  });

  it("passes the QueryClient through router context so loaders share it", () => {
    // __root.tsx declares `context: { queryClient }` via
    // createRootRouteWithContext; loaders read the cache through it. A second
    // client built anywhere else would silently double the cache.
    const router = getRouter();
    expect(clientOf(router)).toBeDefined();
    expect(clientOf(router).getQueryCache()).toBeDefined();
  });

  it("stops retrying client-shaped failures but retries server errors", () => {
    // A 4xx is deterministic — the third retry of a 404 returns a 404 and
    // burns three Riot rate-limit tokens doing it. Everything else (5xx,
    // network) is worth the default three attempts.
    const retry = clientOf(getRouter()).getDefaultOptions().queries?.retry as (
      failureCount: number,
      error: Error
    ) => boolean;

    expect(retry(0, new HttpError(404))).toBe(false);
    expect(retry(0, new HttpError(500))).toBe(true);
    expect(retry(2, new Error("socket hang up"))).toBe(true);
    expect(retry(3, new Error("socket hang up"))).toBe(false);
  });

  it("does not toast a first-load failure", () => {
    // A query with no data yet renders its own error surface; toasting it too
    // would announce the same failure twice.
    toastError.mockClear();
    const client = clientOf(getRouter());

    client
      .getQueryCache()
      .config.onError?.(new Error("boom"), { state: { data: undefined } } as never);

    expect(toastError).not.toHaveBeenCalled();
  });

  it("prefers the upstream message and falls back when there is none", () => {
    // HttpError bodies carry the api's own wording ("Riot rate limit hit");
    // an errorless throw (a string, an empty Error) must still say something.
    toastError.mockClear();
    const client = clientOf(getRouter());
    const cached = { state: { data: "cached" } } as never;

    client
      .getQueryCache()
      .config.onError?.(new HttpError(502, "riot upstream down"), cached);
    expect(toastError).toHaveBeenCalledWith("riot upstream down");

    client.getQueryCache().config.onError?.("exploded" as never, cached);
    expect(toastError).toHaveBeenCalledWith("Background refresh failed");
  });

  it("toasts mutation failures with their message or a generic fallback", () => {
    toastError.mockClear();
    const onError = clientOf(getRouter()).getMutationCache().config.onError;

    onError?.(new Error("save failed"), undefined, undefined, {} as never, {} as never);
    expect(toastError).toHaveBeenCalledWith("save failed");

    onError?.("exploded" as never, undefined, undefined, {} as never, {} as never);
    expect(toastError).toHaveBeenCalledWith("Something went wrong");
  });

  it("renders a loader row as the generic pending fallback", () => {
    // Deliberately minimal — a generic skeleton here would violate the
    // "skeletons mirror the layout they replace" rule on every route it
    // landed on. If this grows layout, something took a wrong turn.
    const Pending = getRouter().options.defaultPendingComponent as ComponentType;
    const { getByText } = render(createElement(Pending));

    expect(getByText("Loading…")).toBeTruthy();
  });
});

describe("defaultViewTransition types", () => {
  const runTypes = (types: Array<string> | false) => {
    navigationType.mockReturnValueOnce(types);
    const vt = getRouter().options.defaultViewTransition as {
      types: (ctx: { fromLocation: unknown; toLocation: unknown }) =>
        | Array<string>
        | false;
    };
    return vt.types({ fromLocation: {}, toLocation: {} });
  };

  afterEach(() => {
    mainScrollRef.current = null;
    delete document.body.dataset.vtShell;
    emitRouteTransitionStart.mockClear();
  });

  it.each(["slide-left", "slide-right"] as const)(
    "resets <main> scroll before a %s so both snapshots agree",
    (slide) => {
      // The reset must land BEFORE the OLD snapshot is captured: left to the
      // route's own scroll-reset effect it fires between the two snapshots,
      // and the rect-morph interpolates the scroll delta into a diagonal
      // slide. The dataset flag is what view-transitions.css keys the shell
      // animation on.
      mainScrollRef.current = { scrollTop: 480 } as HTMLElement;

      expect(runTypes([slide])).toEqual([slide]);

      expect(mainScrollRef.current.scrollTop).toBe(0);
      expect(document.body.dataset.vtShell).toBe("on");
      expect(emitRouteTransitionStart).toHaveBeenCalledTimes(1);
    }
  );

  it.each(["cross-section", "account-swap"] as const)(
    "names the shell for a %s fade without touching scroll",
    (type) => {
      mainScrollRef.current = { scrollTop: 480 } as HTMLElement;

      runTypes([type]);

      expect(mainScrollRef.current.scrollTop).toBe(480);
      expect(document.body.dataset.vtShell).toBe("on");
    }
  );

  it("keeps the shell static for intra-section morphs but still signals subscribers", () => {
    // Per-element morphs must run alone — naming the shell would add a parent
    // group size-morph competing for the eye. Subscribers (e.g. the Steam
    // background video pause) still need the start signal.
    runTypes(["match-morph"]);

    expect(document.body.dataset.vtShell).toBe("off");
    expect(emitRouteTransitionStart).toHaveBeenCalledTimes(1);
  });

  it("does not signal subscribers when the transition is skipped", () => {
    // The bus exists so listeners can pause expensive work during the
    // snapshot window; firing it on skipped navs would churn them on every
    // same-scope click.
    expect(runTypes(false)).toBe(false);

    expect(emitRouteTransitionStart).not.toHaveBeenCalled();
    expect(document.body.dataset.vtShell).toBe("off");
  });
});
