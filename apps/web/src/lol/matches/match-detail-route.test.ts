import { matchDetailQueryOptions } from "@/lol/matches/use-match-detail";
// Lives here rather than beside the route file: the TanStack Router generator
// scans `src/routes/` and a test module dropped in there risks being picked up
// as a route and written into routeTree.gen.ts.
import { Route } from "@/routes/lol/$accountSlug/matches/$matchId";
import { describe, expect, it, vi } from "vitest";

const params = { accountSlug: "vyoh-euw", matchId: "EUW1_1234567890" };

// `Route.options.loader` is typed as a function-or-object union, so it needs
// narrowing before it can be invoked directly.
type LoaderArg = {
  context: { queryClient: { prefetchQuery: unknown } };
  params: typeof params;
};
const invokeLoader = (arg: LoaderArg) =>
  (Route.options.loader as unknown as (a: LoaderArg) => unknown)(arg);

describe("match-detail route loader", () => {
  it("primes the match-detail query during route resolution", () => {
    const prefetchQuery = vi.fn();
    expect(Route.options.loader).toBeTypeOf("function");

    invokeLoader({ context: { queryClient: { prefetchQuery } }, params });

    expect(prefetchQuery).toHaveBeenCalledTimes(1);
    expect(prefetchQuery.mock.calls[0]?.[0]).toMatchObject({
      queryKey: matchDetailQueryOptions(params.matchId).queryKey,
    });
  });

  it("does not gate navigation on the fetch", () => {
    // Load-bearing, not a style assertion. Returning the promise would make the
    // router hold the navigation open until the response lands, which (a) freezes
    // the page under the view-transition snapshot match-row.tsx opens around its
    // awaited navigate(), and (b) skips MatchDetailSkeleton, since the query is
    // no longer pending by the time the component mounts. The full reasoning is
    // on the loader in routes/lol/$accountSlug/matches/$matchId.tsx.
    const result = invokeLoader({
      context: { queryClient: { prefetchQuery: vi.fn() } },
      params,
    });

    expect(result).toBeUndefined();
  });
});
