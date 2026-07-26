import type { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

// Boot no real router: the property under test is what the factory hands to
// each caller, not route matching.
vi.mock("@tanstack/react-router", () => ({
  createRouter: (options: unknown) => ({ options }),
}));
vi.mock("./routeTree.gen", () => ({ routeTree: {} }));

import { getRouter } from "./router";

const clientOf = (router: ReturnType<typeof getRouter>) =>
  (router.options.context as { queryClient: QueryClient }).queryClient;

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

  it("passes the QueryClient through router context so loaders share it", () => {
    // __root.tsx declares `context: { queryClient }` via
    // createRootRouteWithContext; loaders read the cache through it. A second
    // client built anywhere else would silently double the cache.
    const router = getRouter();
    expect(clientOf(router)).toBeDefined();
    expect(clientOf(router).getQueryCache()).toBeDefined();
  });
});
