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
import { useSteamSummary } from "./use-steam-summary";
import { useSteamTags } from "./use-tags";
import { useSteamWishlist } from "./use-wishlist";

function makeWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
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
};

const cases: Case[] = [
  {
    name: "useSteamSummary",
    hook: () => useSteamSummary(),
    url: "http://localhost:2010/steam/summary",
  },
  {
    name: "useSteamOwnedGames",
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
    hook: () => useSteamWishlist(),
    url: "http://localhost:2010/steam/wishlist",
  },
  {
    name: "useLibraryCompletion",
    hook: () => useLibraryCompletion(),
    url: "http://localhost:2010/steam/achievements/library-completion",
  },
  {
    name: "useRecentUnlocks(10)",
    hook: () => useRecentUnlocks(10),
    url: "http://localhost:2010/steam/achievements/recent?limit=10",
  },
  {
    name: "useCrossGameRarest(10)",
    hook: () => useCrossGameRarest(10),
    url: "http://localhost:2010/steam/achievements/rarest?limit=10",
  },
  {
    name: "useSteamChronotype()",
    hook: () => useSteamChronotype(),
    url: "http://localhost:2010/steam/chronotype?count=500",
  },
];

describe("steam useQuery wrappers", () => {
  it.each(cases)("$name fetches $url and parses the response", async ({ hook, url }) => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );
    const { result } = renderHook(hook, { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetch).toHaveBeenCalledWith(url);
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
    expect(fetch).toHaveBeenCalledWith("http://localhost:2010/steam/player-state");
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
    // Single attempt — 404 must not retry per use-player-state.ts.
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
