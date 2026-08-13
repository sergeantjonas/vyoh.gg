import { QueryClient } from "@tanstack/react-query";
import { isRedirect } from "@tanstack/react-router";
import type { Me } from "@vyoh/shared";
import { describe, expect, it } from "vitest";

// Lives beside route-loaders.test.ts rather than in src/routes/ — the
// tanstackStart plugin scans that directory for route files, and nothing
// guarantees it ignores a .test.ts dropped in there.
//
// Loader behaviour is pinned in route-loaders.test.ts; this file owns the rest
// of the wiring a route file declares: head() output, redirect gates, search
// validation. Nothing here renders a route component: the router plugin's
// automatic code-splitting is active under vitest too, so `options.component`
// is a React.lazy wrapper whose split module does not resolve in this
// environment — page components get their own test files instead.

import { meQueryOptions } from "@/identity/use-me";
import { validateAccountSearch } from "@/lol/account/account-search";
import { Route as HomeRoute } from "./routes/index";
import { Route as LoginRoute } from "./routes/login";
import { Route as LolSectionRoute } from "./routes/lol/$accountSlug";
import { Route as ChampionsRoute } from "./routes/lol/$accountSlug/champions";
import { Route as ChampionDetailRoute } from "./routes/lol/$accountSlug/champions/$championKey";
import { Route as ProfileRoute } from "./routes/lol/$accountSlug/index";
import { Route as LiveRoute } from "./routes/lol/$accountSlug/live";
import { Route as MatchesLayoutRoute } from "./routes/lol/$accountSlug/matches";
import { Route as MatchLayoutRoute } from "./routes/lol/$accountSlug/matches/$matchId";
import { Route as MatchIndexRoute } from "./routes/lol/$accountSlug/matches/$matchId/index";
import { Route as MatchRecapRoute } from "./routes/lol/$accountSlug/matches/$matchId/recap";
import { Route as MatchReviewRoute } from "./routes/lol/$accountSlug/matches/$matchId/review";
import { Route as MatchTimelineRoute } from "./routes/lol/$accountSlug/matches/$matchId/timeline";
import { Route as MatchYourGameRoute } from "./routes/lol/$accountSlug/matches/$matchId/your-game";
import { Route as LolRecapRoute } from "./routes/lol/$accountSlug/recap";
import { Route as TrendsRoute } from "./routes/lol/$accountSlug/trends";
import { Route as LolIndexRoute } from "./routes/lol/index";
import { Route as PatchVersionRoute } from "./routes/lol/patches/$version";
import { Route as PatchesIndexRoute } from "./routes/lol/patches/index";
import { Route as SitemapRoute } from "./routes/sitemap[.]xml";
import { Route as StatusRoute } from "./routes/status";
import { Route as SteamSectionRoute } from "./routes/steam";
import { Route as AchievementsRoute } from "./routes/steam/achievements";
import { Route as SignatureRoute } from "./routes/steam/achievements_.signature";
import { Route as SteamIndexRoute } from "./routes/steam/index";
import { Route as LibraryRoute } from "./routes/steam/library";
import { Route as GamePanelRoute } from "./routes/steam/library/$appid";
import { Route as PortraitRoute } from "./routes/steam/portrait";
import { Route as UpcomingRoute } from "./routes/steam/upcoming";
import { Route as WishlistRoute } from "./routes/steam/wishlist";

type HeadTags = Record<string, string | undefined>;
type AnyRoute = {
  options: {
    head?: unknown;
    beforeLoad?: unknown;
    validateSearch?: unknown;
    component?: unknown;
    pendingComponent?: unknown;
    staticData?: unknown;
  };
};

// head() is typed Awaitable, so the destructurable shape needs a cast; every
// head in the app is synchronous and reads at most `params` off its context.
const headOf = (route: AnyRoute, params: Record<string, string> = {}) => {
  const head = route.options.head;
  if (typeof head !== "function") throw new Error("route has no head()");
  return (head({ params }) ?? {}) as { meta?: HeadTags[]; links?: HeadTags[] };
};

describe("head()", () => {
  // Params chosen to be visibly fake-but-shaped: a head that reads a param it
  // was not given interpolates the string "undefined", which the sweep below
  // rejects in any tag value.
  const HEADED: Array<[string, AnyRoute, Record<string, string>]> = [
    ["/", HomeRoute, {}],
    ["/login", LoginRoute, {}],
    ["/status", StatusRoute, {}],
    ["/steam (section)", SteamSectionRoute, {}],
    ["/steam/", SteamIndexRoute, {}],
    ["/steam/achievements", AchievementsRoute, {}],
    ["/steam/achievements/signature", SignatureRoute, {}],
    ["/steam/library", LibraryRoute, {}],
    ["/steam/library/$appid", GamePanelRoute, { appid: "440" }],
    ["/steam/portrait", PortraitRoute, {}],
    ["/steam/upcoming", UpcomingRoute, {}],
    ["/steam/wishlist", WishlistRoute, {}],
    ["/lol/", LolIndexRoute, {}],
    ["/lol/$accountSlug/", ProfileRoute, { accountSlug: "ahri" }],
    ["/lol/$accountSlug/champions", ChampionsRoute, { accountSlug: "ahri" }],
    [
      "/lol/$accountSlug/champions/$championKey",
      ChampionDetailRoute,
      { accountSlug: "ahri", championKey: "Ahri" },
    ],
    ["/lol/$accountSlug/live", LiveRoute, { accountSlug: "ahri" }],
    ["/lol/$accountSlug/matches", MatchesLayoutRoute, { accountSlug: "ahri" }],
    [
      "/lol/$accountSlug/matches/$matchId",
      MatchLayoutRoute,
      { accountSlug: "ahri", matchId: "EUW1_1" },
    ],
    [
      "/lol/$accountSlug/matches/$matchId/recap",
      MatchRecapRoute,
      { accountSlug: "ahri", matchId: "EUW1_1" },
    ],
    [
      "/lol/$accountSlug/matches/$matchId/review",
      MatchReviewRoute,
      { accountSlug: "ahri", matchId: "EUW1_1" },
    ],
    [
      "/lol/$accountSlug/matches/$matchId/timeline",
      MatchTimelineRoute,
      { accountSlug: "ahri", matchId: "EUW1_1" },
    ],
    [
      "/lol/$accountSlug/matches/$matchId/your-game",
      MatchYourGameRoute,
      { accountSlug: "ahri", matchId: "EUW1_1" },
    ],
    ["/lol/$accountSlug/recap", LolRecapRoute, { accountSlug: "ahri" }],
    ["/lol/$accountSlug/trends", TrendsRoute, { accountSlug: "ahri" }],
    ["/lol/patches/", PatchesIndexRoute, {}],
    ["/lol/patches/$version", PatchVersionRoute, { version: "26.3" }],
  ];

  it.each(HEADED)("%s declares its own document identity", (_path, route, params) => {
    const { meta = [], links = [] } = headOf(route, params);

    // The branded title and description are what a search result and a link
    // preview show; a route without them silently inherits the root's.
    expect(meta.find((m) => "title" in m)?.title).toContain("vyoh.gg");
    expect(meta.find((m) => m.name === "description")?.content).toBeTruthy();

    // Only the shell may claim a canonical or og:url: router merges `links`
    // by exact JSON equality, so a second canonical is a conflicting tag that
    // gets every canonical on the page discarded.
    expect(links.some((l) => l.rel === "canonical")).toBe(false);
    expect(meta.some((m) => m.property === "og:url")).toBe(false);

    for (const tag of meta) {
      for (const value of Object.values(tag)) {
        expect(String(value)).not.toContain("undefined");
      }
      // A relative og:image is legal HTML and ignored by every scraper.
      if (tag.property === "og:image") {
        expect(tag.content).toMatch(/^https?:\/\//);
      }
    }
  });

  it("/login opts out of the root's site-wide index, follow", () => {
    const robots = headOf(LoginRoute)
      .meta?.filter((m) => m.name === "robots")
      .map((m) => m.content);

    // Exactly one: the router merges root and route metas by `name`, so a
    // second entry here would leave the page carrying two conflicting rules.
    expect(robots).toEqual(["noindex, nofollow"]);
  });
});

describe("redirect gates", () => {
  const seededClient = (accounts: Array<{ slug: string }>) => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(meQueryOptions().queryKey, {
      lol: accounts,
      steam: [],
    } as unknown as Me);
    return queryClient;
  };
  const lolBeforeLoad = LolIndexRoute.options.beforeLoad as (ctx: {
    context: { queryClient: QueryClient };
  }) => Promise<void>;

  it("/lol hands a visitor to the primary account without a network round-trip", async () => {
    // The root loader has already awaited `me`, so this must be a cache read —
    // the test-setup fetch guard rejects any request this gate would make.
    const queryClient = seededClient([{ slug: "ahri" }, { slug: "second" }]);

    const caught = await lolBeforeLoad({ context: { queryClient } }).then(
      () => null,
      (thrown: unknown) => thrown
    );

    expect(isRedirect(caught)).toBe(true);
    expect((caught as Response & { options: unknown }).options).toMatchObject({
      to: "/lol/$accountSlug",
      params: { accountSlug: "ahri" },
      // As a `replace`, back from the profile leaves the site instead of
      // bouncing through /lol into the same redirect forever.
      replace: true,
    });
  });

  it("/lol stays put when there is no account to hand off to", async () => {
    const queryClient = seededClient([]);

    await expect(lolBeforeLoad({ context: { queryClient } })).resolves.toBeUndefined();
  });

  // The calendar and the list were one route behind `?tab=`, and the palette
  // emitted `?tab=upcoming` for months. Those URLs are bookmarked, so the gate
  // is the only thing keeping them from landing on a page that no longer has
  // the view they name.
  it("/steam/wishlist forwards the retired ?tab=upcoming to the calendar route", async () => {
    const beforeLoad = WishlistRoute.options.beforeLoad as unknown as (ctx: {
      search: Record<string, unknown>;
    }) => Promise<void>;

    const caught = await beforeLoad({ search: { tab: "upcoming" } }).then(
      () => null,
      (thrown: unknown) => thrown
    );

    expect(isRedirect(caught)).toBe(true);
    expect((caught as Response & { options: unknown }).options).toMatchObject({
      to: "/steam/upcoming",
      replace: true,
    });
  });

  it("/steam/wishlist stays put for the list itself, with or without the old tab", async () => {
    const beforeLoad = WishlistRoute.options.beforeLoad as unknown as (ctx: {
      search: Record<string, unknown>;
    }) => Promise<void>;

    // `?tab=all` named this route's own list, so it is already where it was
    // going — forwarding it would be a redirect to the current page.
    await expect(beforeLoad({ search: { tab: "all" } })).resolves.toBeUndefined();
    await expect(beforeLoad({ search: { appid: 440 } })).resolves.toBeUndefined();
  });

  it("/lol/…/matches/$matchId lands on the recap tab with its params intact", () => {
    const beforeLoad = MatchIndexRoute.options.beforeLoad as unknown as (ctx: {
      params: Record<string, string>;
    }) => void;
    let caught: unknown;
    try {
      beforeLoad({ params: { accountSlug: "ahri", matchId: "EUW1_1" } });
    } catch (thrown) {
      caught = thrown;
    }

    expect(isRedirect(caught)).toBe(true);
    expect((caught as Response & { options: unknown }).options).toMatchObject({
      to: "/lol/$accountSlug/matches/$matchId/recap",
      params: { accountSlug: "ahri", matchId: "EUW1_1" },
      replace: true,
    });
  });
});

describe("validateSearch", () => {
  it("wishlist coerces appid from the URL string and drops junk", () => {
    const validate = WishlistRoute.options.validateSearch as (
      search: Record<string, unknown>
    ) => { appid?: number; tab?: string };

    // Everything arriving via a URL is a string; the profile chip deep-links
    // `?appid=440` and expects a number on the other side.
    expect(validate({ appid: "440" })).toEqual({ appid: 440, tab: undefined });
    expect(validate({ appid: 440 })).toEqual({ appid: 440, tab: undefined });
    expect(validate({ appid: "junk" })).toEqual({ appid: undefined, tab: undefined });
    expect(validate({ appid: "-3" })).toEqual({ appid: undefined, tab: undefined });
  });

  it("wishlist keeps the retired tab param only in the one shape it forwards", () => {
    const validate = WishlistRoute.options.validateSearch as (
      search: Record<string, unknown>
    ) => { appid?: number; tab?: string };

    // The param survives validation purely so `beforeLoad` can see it. Anything
    // other than the value that redirects is dropped, so the route never carries
    // a search key nothing reads.
    expect(validate({ tab: "upcoming" })).toEqual({ appid: undefined, tab: "upcoming" });
    expect(validate({ tab: "all" })).toEqual({ appid: undefined, tab: undefined });
    expect(validate({ tab: "nonsense" })).toEqual({ appid: undefined, tab: undefined });
  });

  it("champions keeps only a real role position", () => {
    const validate = ChampionsRoute.options.validateSearch as (
      search: Record<string, unknown>
    ) => { role?: string };

    expect(validate({ role: "JUNGLE" })).toEqual({ role: "JUNGLE" });
    expect(validate({ role: "jungle" })).toEqual({});
    expect(validate({})).toEqual({});
  });

  it("the game panel keeps only a string achievement anchor", () => {
    const validate = GamePanelRoute.options.validateSearch as (
      search: Record<string, unknown>
    ) => { ach?: string };

    expect(validate({ ach: "ACH_WIN_ONE_GAME" })).toEqual({ ach: "ACH_WIN_ONE_GAME" });
    expect(validate({ ach: 42 })).toEqual({ ach: undefined });
  });

  it("login keeps only the three errors the callback emits and a same-site next", () => {
    const validate = LoginRoute.options.validateSearch as (
      search: Record<string, unknown>
    ) => { error?: string; next?: string };

    expect(validate({ error: "forbidden", next: "/status" })).toEqual({
      error: "forbidden",
      next: "/status",
    });
    // The page renders `error` as copy and `next` into an href, so both are
    // attacker-reachable via a crafted /login link.
    expect(validate({ error: "<script>" })).toEqual({
      error: undefined,
      next: undefined,
    });
    expect(validate({ next: "https://evil.example" })).toEqual({
      error: undefined,
      next: undefined,
    });
    expect(validate({ next: "//evil.example" })).toEqual({
      error: undefined,
      next: undefined,
    });
  });

  it("the LoL section root wires the shared account-search validator", () => {
    // Its cases live with account-search's own tests; here only the wiring.
    expect(LolSectionRoute.options.validateSearch).toBe(validateAccountSearch);
  });
});

describe("/sitemap.xml", () => {
  it("ships nothing of its GET handler to the client graph", () => {
    // The handler and its `collectSitemapUrls` reach into the api; the client
    // transform strips the whole `server` block, and this file's presence in
    // the client bundle must stay inert. The handler's logic is covered where
    // it lives, in lib/sitemap.test.ts — it is not reachable from here.
    expect(SitemapRoute.options).toEqual({});
  });
});

describe("wiring", () => {
  it("/ owns its entry animation so the shell scope-fade skips it", () => {
    expect(HomeRoute.options.staticData).toEqual({ ownsEntry: true });
  });

  it("the paged list routes bring their own layout-shaped skeletons", () => {
    // Per the skeleton convention these mirror the layout they replace; the
    // pin here is that the routes carry one at all instead of falling back to
    // the router's generic pending row.
    expect(typeof MatchesLayoutRoute.options.pendingComponent).toBe("function");
    expect(typeof WishlistRoute.options.pendingComponent).toBe("function");
    expect(typeof UpcomingRoute.options.pendingComponent).toBe("function");
    // And that the two Steam ones are not the same skeleton: a row list and a
    // calendar are the layouts, and one shape standing in for both is the reflow
    // the convention exists to prevent. While they shared a route behind `?tab=`
    // that was unavoidable, and the row skeleton stood in for the calendar.
    expect(UpcomingRoute.options.pendingComponent).not.toBe(
      WishlistRoute.options.pendingComponent
    );
  });
});
