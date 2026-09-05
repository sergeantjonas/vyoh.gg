import { QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { championExtrasQueryOptions } from "@/lol/champions/use-champion-extras";
import { patchChangesQueryOptions } from "@/lol/patches/use-patch-changes";
import { patchListQueryOptions } from "@/lol/patches/use-patch-list";
import { gameAchievementsQueryOptions } from "@/steam/game/use-game-achievements";
import { gameDescriptionQueryOptions } from "@/steam/game/use-game-description";
import { steamGameQueryOptions } from "@/steam/game/use-steam-game";
import { steamUpcomingQueryOptions } from "@/steam/use-upcoming";
import { steamWishlistQueryOptions } from "@/steam/use-wishlist";
import { Route as ChampionDetailRoute } from "./routes/lol/$accountSlug/champions/$championKey";
import { Route as AccountIndexRoute } from "./routes/lol/$accountSlug/index";
import { Route as MatchesRoute } from "./routes/lol/$accountSlug/matches";
import { Route as MatchDetailRoute } from "./routes/lol/$accountSlug/matches/$matchId";
import { Route as PatchVersionRoute } from "./routes/lol/patches/$version";
import { Route as PatchesIndexRoute } from "./routes/lol/patches/index";
import { Route as AchievementsRoute } from "./routes/steam/achievements";
import { Route as GamePanelRoute } from "./routes/steam/library/$appid";
import { Route as PortraitRoute } from "./routes/steam/portrait";
import { Route as UpcomingRoute } from "./routes/steam/upcoming";
import { Route as WishlistRoute } from "./routes/steam/wishlist";

// Which loaders tolerate a failing prime and which take the route down is a
// per-route editorial decision, not a default: a rejected loader is escalated
// to the route-tier `errorComponent` and answers HTTP 500 on a server render.
// That is right when the primed query *is* the page and wrong when it is one
// region of a page that still says something true without it. Nothing about
// either choice fails to compile, and the two are indistinguishable until an
// upstream is actually down — so the decision is pinned here.

const API = "http://localhost:2010";

// A predicate rather than a substring list, because `/lol/patches` is a prefix
// of `/lol/patches/26.3/changes` and the whole point of the $version case is
// failing one without the other.
let fails: (url: string) => boolean = () => false;
// A 404 is a settled answer rather than an outage, and one loader tells them apart.
let notFound: (url: string) => boolean = () => false;

// Mutable so the empty-season case can drain it without a second fetch mock.
let patchList: Array<{ version: string; patchDate: string }> = [];

function jsonFor(url: string): unknown {
  // Only the shapes a loader itself reads matter — the patches index loader
  // picks `patches[0].version` to build its second query, and the LoL routes
  // resolve their slug against the account list. Everything else is handed
  // straight to the cache.
  if (url === `${API}/lol/patches`) return patchList;
  if (url.includes("/changes")) return { patchVersion: "26.3" };
  if (url.endsWith("/me")) {
    return {
      lol: [{ slug: "ahri", puuid: "p", region: "euw1", gameName: "a", tagLine: "b" }],
    };
  }
  return {};
}

// `ensureQueryData` retries by default, which would turn every failure case
// into a multi-second test for no added confidence.
function runLoader(
  route: { options: { loader?: unknown } },
  params: Record<string, string> = {},
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
) {
  const loader = route.options.loader;
  // Without this, a route that lost its loader entirely would make the call
  // below throw a TypeError, and every `rejects.toThrow()` here would keep
  // passing against a route that no longer primes anything at all.
  if (typeof loader !== "function") throw new Error("route has no loader");
  return Promise.resolve(
    (loader as (ctx: unknown) => Promise<unknown>)({
      context: { queryClient },
      params,
      location: {},
    })
  );
}

beforeEach(() => {
  fails = () => false;
  notFound = () => false;
  patchList = [{ version: "26.3", patchDate: "2026-08-01" }];
  vi.stubGlobal(
    "fetch",
    vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      const status = fails(url) ? 500 : notFound(url) ? 404 : 200;
      const body =
        status === 500
          ? { message: "upstream is having a moment" }
          : status === 404
            ? { message: "not in the tracked library" }
            : jsonFor(url);
      return Promise.resolve(
        new Response(JSON.stringify(body), {
          status,
          headers: { "content-type": "application/json" },
        })
      );
    })
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("tolerated primes", () => {
  it("/lol/patches/$version survives a failing patch list", async () => {
    // The list only supplies the release date, read through `patchList?.find`.
    // Losing it costs one line of an otherwise intact page.
    fails = (url) => url === `${API}/lol/patches`;

    // Resolving is half the contract; the other half is that swallowing the
    // list did not cost the changeset, which is the page itself.
    const [, changes] = (await runLoader(PatchVersionRoute, {
      version: "26.3",
    })) as unknown[];

    expect(changes).toEqual({ patchVersion: "26.3" });
  });

  it("/lol/$accountSlug survives rank and live both failing", async () => {
    // Two chips on a page that also carries the champion pool, the match links
    // and the season history.
    fails = (url) => url.includes("/rank") || url.includes("/live");

    await expect(
      runLoader(AccountIndexRoute, { accountSlug: "ahri" })
    ).resolves.toBeUndefined();
  });

  it("/steam/library/$appid survives its description and achievements failing", async () => {
    // Both are regions of a panel whose identity card still says something
    // true without them, so a failing one must not take the row down with it —
    // and the sibling that was going to succeed must still land in the cache.
    vi.stubEnv("SSR", true);
    fails = (url) => url.endsWith("/description");
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    await expect(
      runLoader(GamePanelRoute, { appid: "440" }, queryClient)
    ).resolves.toEqual({
      rowMissing: false,
    });
    expect(queryClient.getQueryData(steamGameQueryOptions(440).queryKey)).toBeDefined();
    expect(
      queryClient.getQueryData(gameAchievementsQueryOptions(440).queryKey)
    ).toBeDefined();
    expect(
      queryClient.getQueryData(gameDescriptionQueryOptions(440).queryKey)
    ).toBeUndefined();
  });

  it("/steam/library/$appid carries a 404 row out as loader data instead of failing", async () => {
    // The server primes the public projection, so the owner's hidden games are
    // the rows that 404 here; failing would turn the owner's own refresh into
    // an error card. The flag is how the hydrating render agrees with the
    // server, since a failed query is not dehydrated.
    vi.stubEnv("SSR", true);
    notFound = (url) => url.endsWith("/steam/game/440");
    await expect(runLoader(GamePanelRoute, { appid: "440" })).resolves.toEqual({
      rowMissing: true,
    });
  });

  it("/steam/library/$appid reports the row present when it primes", async () => {
    vi.stubEnv("SSR", true);
    await expect(runLoader(GamePanelRoute, { appid: "440" })).resolves.toEqual({
      rowMissing: false,
    });
  });

  it("/steam/portrait survives either half failing", async () => {
    fails = (url) => url.includes("/portrait") || url.includes("platform-mix");

    await expect(runLoader(PortraitRoute)).resolves.toBeUndefined();
  });
});

describe("fatal primes", () => {
  // Each of these is the whole of its route. Swallowing would answer HTTP 200
  // over an empty page, which teaches a crawler the page is empty; rejecting
  // answers 500, which asks it to come back.
  it("/lol/patches/$version fails on a missing changeset", async () => {
    // Without it `PatchesPage` returns `PatchesEmpty` before the version
    // sidebar renders, so the tolerated document would be unnavigable too.
    fails = (url) => url.includes("/changes");

    await expect(runLoader(PatchVersionRoute, { version: "26.3" })).rejects.toThrow();
  });

  it("/lol/patches fails when the list it picks a version from fails", async () => {
    fails = (url) => url === `${API}/lol/patches`;

    await expect(runLoader(PatchesIndexRoute)).rejects.toThrow();
  });

  it("/lol/$accountSlug fails when identity fails", async () => {
    // Without `me` there is no account to resolve the slug against.
    fails = (url) => url.endsWith("/me");

    await expect(runLoader(AccountIndexRoute, { accountSlug: "ahri" })).rejects.toThrow();
  });

  it("/steam/wishlist fails rather than serving an empty page", async () => {
    fails = (url) => url.endsWith("/wishlist");

    await expect(runLoader(WishlistRoute)).rejects.toThrow();
  });

  it("/steam/upcoming fails rather than serving an empty timeline", async () => {
    fails = (url) => url.endsWith("/upcoming");

    await expect(runLoader(UpcomingRoute)).rejects.toThrow();
  });

  it("/steam/achievements fails rather than serving an empty feed", async () => {
    fails = (url) => url.includes("/achievements");

    await expect(runLoader(AchievementsRoute)).rejects.toThrow();
  });

  it("/lol/$accountSlug/matches/$matchId fails on the server rather than serving a skeleton", async () => {
    // Server-only, because the client branch is deliberately non-blocking: the
    // panel renders in place for a server render, so a swallowed prime is a 200
    // over a skeleton on a URL whose whole subject is the match.
    vi.stubEnv("SSR", true);
    fails = (url) => url.includes("/lol/matches/");
    await expect(runLoader(MatchDetailRoute, { matchId: "EUW1_1" })).rejects.toThrow();
  });

  it("/steam/library/$appid fails on the server when the game row is down", async () => {
    // The row is what the whole body gates on; without it the document is a
    // skeleton under a 200, which teaches a crawler the URL is empty.
    vi.stubEnv("SSR", true);
    fails = (url) => url.endsWith("/steam/game/440");
    await expect(runLoader(GamePanelRoute, { appid: "440" })).rejects.toThrow();
  });

  it("/steam/library/$appid primes nothing on the client", async () => {
    // A click from the library already holds the row in the owned-games list,
    // and the panel's own query covers a cold client-side navigation.
    vi.stubEnv("SSR", false);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    await expect(
      runLoader(GamePanelRoute, { appid: "440" }, queryClient)
    ).resolves.toBeUndefined();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("/lol/$accountSlug/champions/$championKey fails on the server when the extras fail", async () => {
    // The extras carry the detail aggregate the body renders from; without them
    // a server render is a skeleton under a 200 on a URL whose subject is the
    // champion. Server only — the client branch primes nothing.
    vi.stubEnv("SSR", true);
    fails = (url) => url.includes("/champions/Ahri/stats");
    await expect(
      runLoader(ChampionDetailRoute, { accountSlug: "ahri", championKey: "Ahri" })
    ).rejects.toThrow();
  });

  it("/lol/$accountSlug/champions/$championKey warms the key the panel reads", async () => {
    // The hook keys on the account and the serious-queue ids sorted; the loader
    // has neither a viewer nor a stored preference, so it must build the same
    // key from the provider's default or the page renders its pending branch
    // while looking primed.
    vi.stubEnv("SSR", true);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    await runLoader(
      ChampionDetailRoute,
      { accountSlug: "ahri", championKey: "Ahri" },
      queryClient
    );
    const account = {
      slug: "ahri",
      puuid: "p",
      region: "euw1",
      gameName: "a",
      tagLine: "b",
    };
    expect(
      queryClient.getQueryData(
        championExtrasQueryOptions(account as never, "Ahri", [420, 440]).queryKey
      )
    ).toBeDefined();
  });

  it("/lol/$accountSlug/champions/$championKey primes nothing for an unknown slug or on the client", async () => {
    vi.stubEnv("SSR", true);
    await expect(
      runLoader(ChampionDetailRoute, { accountSlug: "nobody", championKey: "Ahri" })
    ).resolves.toBeUndefined();
    expect(
      vi.mocked(fetch).mock.calls.some(([u]) => String(u).includes("/champions/"))
    ).toBe(false);
    vi.stubEnv("SSR", false);
    vi.mocked(fetch).mockClear();
    await expect(
      runLoader(ChampionDetailRoute, { accountSlug: "ahri", championKey: "Ahri" })
    ).resolves.toBeUndefined();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("/lol/$accountSlug/matches fails rather than serving an empty history", async () => {
    fails = (url) => url.includes("/matches");

    await expect(runLoader(MatchesRoute, { accountSlug: "ahri" })).rejects.toThrow();
  });
});

describe("dependent primes", () => {
  it("/lol/patches warms both queries under the keys the page reads", async () => {
    // The changeset key must come out of the same queryOptions factory the
    // hook uses — a loader that built the key inline would warm an entry the
    // component never reads, and the page would look primed while rendering
    // its pending branch.
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    await runLoader(PatchesIndexRoute, {}, queryClient);

    expect(queryClient.getQueryData(patchListQueryOptions().queryKey)).toEqual([
      { version: "26.3", patchDate: "2026-08-01" },
    ]);
    expect(queryClient.getQueryData(patchChangesQueryOptions("26.3").queryKey)).toEqual({
      patchVersion: "26.3",
    });
  });

  it("the two Steam list routes each warm only their own query", async () => {
    // They read different endpoints — the wishlist from /wishlist, the timeline
    // from /upcoming — and each one's key must come out of the same queryOptions
    // factory its panel uses, or the page renders a pending branch while looking
    // primed. Pinned as a pair because they were one route behind `?tab=` and
    // priming both from either side is the shape that survived the split.
    const forWishlist = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    await runLoader(WishlistRoute, {}, forWishlist);

    expect(forWishlist.getQueryData(steamWishlistQueryOptions().queryKey)).toBeDefined();
    expect(
      forWishlist.getQueryData(steamUpcomingQueryOptions().queryKey)
    ).toBeUndefined();

    const forUpcoming = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    await runLoader(UpcomingRoute, {}, forUpcoming);

    expect(forUpcoming.getQueryData(steamUpcomingQueryOptions().queryKey)).toBeDefined();
    expect(
      forUpcoming.getQueryData(steamWishlistQueryOptions().queryKey)
    ).toBeUndefined();
  });

  it("/lol/patches settles for the list alone when the season has no patches yet", async () => {
    // An empty list is data, not an outage: there is no version to pick, so
    // the loader must neither reject nor fire a changeset request for nobody.
    patchList = [];

    await expect(runLoader(PatchesIndexRoute)).resolves.toBeUndefined();

    const requested = vi.mocked(fetch).mock.calls.map(([input]) => String(input));
    expect(requested.some((url) => url.includes("/changes"))).toBe(false);
  });
});
