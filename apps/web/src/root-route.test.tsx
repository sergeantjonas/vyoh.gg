import { QueryClient } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import type { ComponentType, ReactNode } from "react";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

// Lives beside route-loaders.test.ts rather than in src/routes/ — the
// tanstackStart plugin scans that directory for route files, and nothing
// guarantees it ignores a .test.tsx dropped in there.

// Mutable knobs the router mock reads at render time. `vi.hoisted` because the
// mock factories below run while the module graph is still loading, before
// this file's own top-level consts would exist.
const harness = vi.hoisted(() => {
  const h = {
    pathname: "/",
    onResolved: null as ((arg: { toLocation: { pathname: string } }) => void) | null,
    router: {
      subscribe: (
        _event: string,
        cb: (arg: { toLocation: { pathname: string } }) => void
      ) => {
        h.onResolved = cb;
        return () => {};
      },
      preloadRoute: vi.fn((_opts: { to: string }) => Promise.resolve()),
    },
    play: vi.fn(),
  };
  return h;
});

// Everything real routing would provide, minus the routing: the file under
// test is __root.tsx, so its route options and its own hooks/effects/JSX stay
// real while the router state they read becomes a knob. createRootRoute…,
// notFound() etc. pass through untouched.
vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    useRouterState: ({ select }: { select?: (s: unknown) => unknown } = {}) => {
      const state = { location: { pathname: harness.pathname }, matches: [] };
      return select ? select(state) : state;
    },
    useRouter: () => harness.router,
    HeadContent: () => null,
    Scripts: () => null,
    Outlet: () => null,
  };
});

// The shell subtrees have their own test files; here they would only drag
// queries, portals and Motion scroll plumbing into a test about the root's
// wiring. Providers keep rendering children so the layout's own tree stays
// intact.
vi.mock("@/components/command-palette", () => ({ CommandPalette: () => null }));
vi.mock("@/components/command-palette-context", () => ({
  CommandPaletteProvider: ({ children }: { children?: ReactNode }) => children,
}));
vi.mock("@/lol/_shared/assets/splash-backdrop", () => ({
  SplashProvider: ({ children }: { children?: ReactNode }) => children,
}));
vi.mock("@/lib/presence-mounts", () => ({ PresenceMounts: () => null }));
vi.mock("@/components/fetch-progress", () => ({ FetchProgress: () => null }));
vi.mock("@/components/nav", () => ({ Nav: () => null }));
vi.mock("@/components/scroll-progress", () => ({ ScrollProgress: () => null }));
vi.mock("@/components/scroll-to-top", () => ({ ScrollToTop: () => null }));
vi.mock("@/components/not-found", () => ({ NotFound: () => null }));
vi.mock("@/components/error-boundary", () => ({
  AppErrorFallback: () => null,
  ErrorBoundary: ({ children }: { children?: ReactNode }) => children,
  WidgetBoundary: ({ children }: { children?: ReactNode }) => children,
}));
vi.mock("@/components/route-error", () => ({
  RouteErrorFallback: ({ error }: { error: Error }) => error.message,
}));
vi.mock("@/lib/use-audio", () => ({
  useAudio: () => ({ play: harness.play }),
  useAudioHydration: () => {},
}));
vi.mock("@/lib/use-audio-shortcut", () => ({ useAudioShortcut: () => {} }));
vi.mock("@/lib/use-favicon-dot", () => ({ useFaviconDot: () => {} }));
vi.mock("@/lib/use-perf-flag", () => ({ usePerfFlag: () => false }));
vi.mock("@/lib/web-vitals", () => ({ reportWebVitals: () => {} }));

import { meQueryOptions } from "@/identity/use-me";
import { mainScrollRef } from "@/lib/scroll-container";
import { SITE_URL } from "@/lib/site-url";
import { Route } from "./routes/__root";

// head() is typed Awaitable and shellComponent is a Start extension the base
// RouteOptions type doesn't carry; both are plain values at runtime.
type HeadTags = Record<string, string | undefined>;
const headOf = () =>
  (Route.options.head?.({} as never) ?? {}) as {
    meta?: Array<HeadTags>;
    links?: Array<HeadTags>;
  };

afterEach(() => {
  harness.pathname = "/";
  harness.onResolved = null;
  harness.play.mockClear();
  harness.router.preloadRoute.mockClear();
  vi.unstubAllGlobals();
});

describe("head()", () => {
  it("declares the site-wide defaults a leaf route merges over", () => {
    const { meta = [], links = [] } = headOf();

    expect(meta).toContainEqual({ title: "vyoh.gg" });
    const description = meta.find((m) => m.name === "description");
    expect(description?.content).toBeTruthy();
    // The og:image default must be absolute — a relative URL is silently
    // ignored by every scraper that matters.
    const ogImage = meta.find((m) => m.property === "og:image");
    expect(ogImage?.content).toMatch(/^https?:\/\//);
    expect(links.filter((l) => l.rel === "stylesheet")).toHaveLength(3);
  });

  it("emits no canonical and no og:url — the shell owns the self-identifying URL", () => {
    // Router merges `links` by exact JSON equality, not by rel: a canonical
    // here plus the shell's would be two conflicting tags, and a page carrying
    // conflicting canonicals has all of them discarded.
    const { meta = [], links = [] } = headOf();

    expect(links.some((l) => l.rel === "canonical")).toBe(false);
    expect(meta.some((m) => m.property === "og:url")).toBe(false);
  });
});

describe("document shell", () => {
  // The shell only ever renders on the server, so renderToString *is* the
  // faithful harness — these assertions read the same markup a crawler gets.
  const renderShell = () => {
    const Shell = (
      Route.options as { shellComponent?: ComponentType<{ children?: ReactNode }> }
    ).shellComponent;
    if (!Shell) throw new Error("root route has no shellComponent");
    return renderToString(createElement(Shell, null));
  };

  it("emits exactly one canonical link, derived from the rendered pathname", () => {
    // Also pins the normalisation seam: /steam/ and /steam are the same
    // document, so the canonical must name the unslashed spelling.
    harness.pathname = "/steam/";
    const html = renderShell();

    expect(html.match(/rel="canonical"/g)).toHaveLength(1);
    expect(html).toContain(`<link rel="canonical" href="${SITE_URL}/steam"`);
    expect(html).toContain(`<meta property="og:url" content="${SITE_URL}/steam"`);
  });

  it("follows the pathname instead of claiming the homepage", () => {
    // Until 2026-07-27 the shell emitted a hardcoded homepage canonical, so
    // every page told crawlers it was a duplicate of `/` — including the
    // patch-notes routes the SSR migration exists to get indexed.
    harness.pathname = "/lol/patches/26.3";
    const html = renderShell();

    expect(html).toContain(`href="${SITE_URL}/lol/patches/26.3"`);
    expect(html).not.toContain(`href="${SITE_URL}/"`);
  });
});

describe("errorComponent", () => {
  it("owns the viewport instead of rendering a card into a page that was never built", () => {
    const RootError = Route.options.errorComponent as ComponentType<{
      error: Error;
      reset: () => void;
    }>;
    const { container, getByText } = render(
      createElement(RootError, { error: new Error("api unreachable"), reset: () => {} })
    );

    expect(getByText("api unreachable")).toBeTruthy();
    expect(container.firstElementChild?.className).toContain("min-h-dvh");
  });
});

describe("loader", () => {
  const runLoader = () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const loader = Route.options.loader as (ctx: unknown) => Promise<unknown>;
    return { queryClient, result: loader({ context: { queryClient } }) };
  };

  it("primes identity under the same key the useMe hook reads", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify({ lol: [{ slug: "ahri" }] }), {
            status: 200,
            headers: { "content-type": "application/json" },
          })
        )
      )
    );
    const { queryClient, result } = runLoader();
    await result;

    expect(queryClient.getQueryData(meQueryOptions().queryKey)).toMatchObject({
      lol: [{ slug: "ahri" }],
    });
  });

  it("fails rather than handing every route an empty account list", async () => {
    // The one loader in the app with no shell to degrade into: everything
    // downstream resolves its identity from this list, so swallowing the
    // failure would render a confident "no accounts" page against an outage.
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response("{}", { status: 500 })))
    );

    await expect(runLoader().result).rejects.toThrow();
  });
});

describe("RootLayout scroll reset", () => {
  const Layout = Route.options.component as ComponentType;

  const mountAt = (pathname: string) => {
    harness.pathname = pathname;
    const view = render(createElement(Layout));
    const main = mainScrollRef.current;
    if (!main) throw new Error("layout did not attach mainScrollRef");
    const scrollTo = vi.fn();
    main.scrollTo = scrollTo as unknown as HTMLElement["scrollTo"];
    return {
      scrollTo,
      navigate: (next: string) => {
        harness.pathname = next;
        view.rerender(createElement(Layout));
      },
    };
  };

  it("leaves scroll alone on mount and on same-scope navigation", () => {
    // Section roots own intra-section reset, with skip lists for list↔detail
    // back-restore. A root that also reset here would break those skips.
    const { scrollTo, navigate } = mountAt("/lol/ahri");

    navigate("/lol/ahri/matches");

    expect(scrollTo).not.toHaveBeenCalled();
  });

  it("resets <main> scroll when navigation crosses a top-level scope", () => {
    // Cross-scope navigation unmounts the previous section, so nothing below
    // the root is still mounted to see the transition — a freshly-mounted
    // section would silently inherit the previous scrollTop.
    const { scrollTo, navigate } = mountAt("/lol/ahri");

    navigate("/steam");

    expect(scrollTo).toHaveBeenCalledWith(0, 0);
  });

  it("plays the transition sound once per resolved pathname change", () => {
    render(createElement(Layout));
    const resolve = (pathname: string) =>
      harness.onResolved?.({ toLocation: { pathname } });

    // The first onResolved is the initial load, not a navigation.
    resolve("/");
    resolve("/");
    expect(harness.play).not.toHaveBeenCalled();

    resolve("/steam");
    expect(harness.play).toHaveBeenCalledExactlyOnceWith("nav.transition");
  });

  it("warms both section chunks on idle so the first cross-section nav is instant", () => {
    // Goes beyond the router's hover preload, which only fires when the
    // pointer touches a Link — this is a pure JS-chunk warmup (neither route
    // has a loader).
    vi.useFakeTimers();
    const view = render(createElement(Layout));

    vi.advanceTimersByTime(2100);

    const warmed = harness.router.preloadRoute.mock.calls.map(([opts]) => opts.to);
    expect(warmed.toSorted()).toEqual(["/lol", "/steam"]);
    view.unmount();
    vi.useRealTimers();
  });
});
