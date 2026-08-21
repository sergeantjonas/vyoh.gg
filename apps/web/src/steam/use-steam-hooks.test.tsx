import { seedViewer } from "@/auth/mock-viewer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { type ReactNode, createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCrossGameRarest } from "./use-cross-game-rarest";
import { useLibraryCompletion } from "./use-library-completion";
import { useSteamLibrarySummary } from "./use-library-summary";
import { useSteamOwnedGames } from "./use-owned-games";
import { useSteamPlatformMix } from "./use-platform-mix";
import { useSteamPlayerState } from "./use-player-state";
import { useRecentUnlocks } from "./use-recent-unlocks";
import { useSteamChronotype } from "./use-steam-chronotype";
import { useSteamGameRecap } from "./use-steam-game-recap";
import { useSteamSummary } from "./use-steam-summary";
import { useSteamTags } from "./use-tags";
import { useSteamWishlist } from "./use-wishlist";

function makeWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  seedViewer(client);
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children);
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

type Case = {
  name: string;
  hook: () => {
    isSuccess: boolean;
    isError: boolean;
    data?: unknown;
    error?: Error | null;
  };
  url: string;
  /** The api answers this route differently for the owner. */
  viewerAware?: true;
};

// The viewer query fires alongside every viewer-scoped read, so the request
// under test is no longer the first one the mock saw.
function callFor(url: string) {
  return vi.mocked(fetch).mock.calls.find(([requested]) => String(requested) === url);
}

const cases: Case[] = [
  {
    name: "useSteamSummary",
    viewerAware: true,
    hook: () => useSteamSummary(),
    url: "http://localhost:2010/steam/summary",
  },
  {
    name: "useSteamOwnedGames",
    viewerAware: true,
    hook: () => useSteamOwnedGames(),
    url: "http://localhost:2010/steam/owned-games",
  },
  {
    name: "useSteamLibrarySummary",
    hook: () => useSteamLibrarySummary(),
    url: "http://localhost:2010/steam/library-summary",
  },
  {
    name: "useSteamPlatformMix",
    hook: () => useSteamPlatformMix(),
    url: "http://localhost:2010/steam/platform-mix",
  },
  {
    name: "useSteamTags",
    hook: () => useSteamTags(),
    url: "http://localhost:2010/steam/tags",
  },
  {
    name: "useSteamWishlist",
    viewerAware: true,
    hook: () => useSteamWishlist(),
    url: "http://localhost:2010/steam/wishlist",
  },
  {
    name: "useLibraryCompletion",
    viewerAware: true,
    hook: () => useLibraryCompletion(),
    url: "http://localhost:2010/steam/achievements/library-completion",
  },
  {
    name: "useRecentUnlocks(10)",
    viewerAware: true,
    hook: () => useRecentUnlocks(10),
    url: "http://localhost:2010/steam/achievements/recent?limit=10",
  },
  {
    name: "useCrossGameRarest(10)",
    viewerAware: true,
    hook: () => useCrossGameRarest(10),
    url: "http://localhost:2010/steam/achievements/rarest?limit=10",
  },
  {
    name: "useSteamChronotype()",
    hook: () => useSteamChronotype(),
    url: "http://localhost:2010/steam/chronotype?count=500",
  },
  {
    name: "useSteamGameRecap(367520)",
    viewerAware: true,
    hook: () => useSteamGameRecap(367520),
    url: "http://localhost:2010/steam/game/367520/recap",
  },
];

describe("steam useQuery wrappers", () => {
  it.each(cases)("$name fetches $url and parses the response", async ({ hook, url }) => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );
    const { result } = renderHook(hook, { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(callFor(url)).toBeDefined();
    expect(result.current.data).toEqual({ ok: true });
  });

  it.each(cases)("$name surfaces the api error message", async ({ hook }) => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ message: "no soup" }), { status: 500 })
    );
    const { result } = renderHook(hook, { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("no soup");
  });

  it.each(cases)(
    "$name falls back to HTTP <status> on non-json body",
    async ({ hook }) => {
      vi.mocked(fetch).mockResolvedValue(new Response("nope", { status: 503 }));
      const { result } = renderHook(hook, { wrapper: makeWrapper() });
      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error?.message).toMatch(/HTTP 503/);
    }
  );
});

describe("useSteamPlayerState", () => {
  it("fetches /steam/player-state on success", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ steamId: "1" }), { status: 200 })
    );
    const { result } = renderHook(() => useSteamPlayerState(), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(callFor("http://localhost:2010/steam/player-state")).toBeDefined();
  });

  it("surfaces a 404 without retrying (fresh-DB edge case)", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ message: "no row yet" }), { status: 404 })
    );
    const { result } = renderHook(() => useSteamPlayerState(), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("no row yet");
    // Single attempt — 404 must not retry per use-player-state.ts. Counted over
    // the player-state calls alone, since the viewer query shares the mock.
    const attempts = vi
      .mocked(fetch)
      .mock.calls.filter(([url]) => String(url).endsWith("/steam/player-state"));
    expect(attempts).toHaveLength(1);
  });
});

describe("viewer-scoped reads", () => {
  // The cookie and the cache key have to travel together. Without
  // `credentials: "include"` the api sees an anonymous request and answers the
  // public projection, which then sits in the owner-scoped entry looking right.
  it.each(cases.filter((c) => c.viewerAware))(
    "$name sends the session cookie",
    async ({ hook, url }) => {
      vi.mocked(fetch).mockResolvedValue(
        new Response(JSON.stringify({ ok: true }), { status: 200 })
      );
      const { result } = renderHook(hook, { wrapper: makeWrapper() });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(callFor(url)?.[1]).toMatchObject({ credentials: "include" });
    }
  );

  it.each(cases.filter((c) => !c.viewerAware))(
    "$name is not viewer-aware and sends no cookie",
    async ({ hook, url }) => {
      vi.mocked(fetch).mockResolvedValue(
        new Response(JSON.stringify({ ok: true }), { status: 200 })
      );
      const { result } = renderHook(hook, { wrapper: makeWrapper() });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(callFor(url)?.[1]).toBeUndefined();
    }
  );
});
