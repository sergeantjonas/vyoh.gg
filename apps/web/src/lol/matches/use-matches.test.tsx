import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { CachedMatchesResult, LolAccount, MatchSummary } from "@vyoh/shared";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  prefetchCachedMatches,
  useCachedMatchSummary,
  useCachedMatches,
  useCachedMatchesWindow,
  useMatchEventsSubscription,
  useMatches,
  useMatchesWindow,
  useSyncAccount,
} from "./use-matches";

const account: LolAccount = {
  slug: "ahri",
  region: "euw1",
  gameName: "Vyoh",
  tagLine: "Ahri",
};

const sample: MatchSummary = {
  matchId: "EUW1_1",
  queueType: "Ranked Solo",
  champion: "Ahri",
  kills: 8,
  deaths: 3,
  assists: 12,
  win: true,
  durationSec: 1834,
  playedAt: new Date().toISOString(),
  remake: false,
  teamPosition: "MIDDLE",
  gameVersion: "14.20.586.5840",
  visionScore: 30,
  damageShare: 0.25,
  firstBloodKill: false,
  csAt10: 0,
  csAt15: 0,
  goldAt10: 0,
  goldAt15: 0,
  teamGoldDiffAt15: 0,
  deathTimings: [],
  deathXs: [],
  deathYs: [],
  killTimings: [],
  killXs: [],
  killYs: [],
  laneOpponent: null,
};

function makeClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

function makeWrapper(client: QueryClient = makeClient()) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useMatches", () => {
  it("does not fetch while account is undefined", () => {
    renderHook(() => useMatches(undefined), { wrapper: makeWrapper() });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("returns the first page when the request succeeds", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify([sample]), { status: 200 })
    );

    const { result } = renderHook(() => useMatches(account), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.pages).toEqual([[sample]]);
    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:2010/lol/summoners/euw1/Vyoh/Ahri/matches?start=0&count=20"
    );
  });

  it("surfaces an error when the request fails", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 500 }));

    const { result } = renderHook(() => useMatches(account), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toMatch(/HTTP 500/);
  });

  it("surfaces the api's message when the response body has one", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ statusCode: 404, message: "Summoner not found" }), {
        status: 404,
      })
    );

    const { result } = renderHook(() => useMatches(account), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("Summoner not found");
  });

  it("passes the queue param to the API when provided", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify([sample]), { status: 200 })
    );
    const { result } = renderHook(() => useMatches(account, 420), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:2010/lol/summoners/euw1/Vyoh/Ahri/matches?start=0&count=20&queue=420"
    );
  });
});

describe("useMatchesWindow", () => {
  it("does not fetch while account is undefined", () => {
    renderHook(() => useMatchesWindow(undefined, 10), { wrapper: makeWrapper() });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("fetches a single page sized by `count`", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify([sample]), { status: 200 })
    );
    const { result } = renderHook(() => useMatchesWindow(account, 10), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:2010/lol/summoners/euw1/Vyoh/Ahri/matches?start=0&count=10"
    );
    expect(result.current.data).toEqual([sample]);
  });

  it("appends queue param when provided", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify([sample]), { status: 200 })
    );
    const { result } = renderHook(() => useMatchesWindow(account, 5, 420), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:2010/lol/summoners/euw1/Vyoh/Ahri/matches?start=0&count=5&queue=420"
    );
  });
});

describe("useCachedMatches", () => {
  it("does not fetch while account is undefined", () => {
    renderHook(() => useCachedMatches(undefined), { wrapper: makeWrapper() });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("fetches the cached-matches infinite endpoint", async () => {
    const page: CachedMatchesResult = {
      matches: [sample],
      total: 1,
    } as unknown as CachedMatchesResult;
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify(page), { status: 200 })
    );
    const { result } = renderHook(() => useCachedMatches(account), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:2010/lol/summoners/euw1/Vyoh/Ahri/matches/cached?start=0&count=20"
    );
  });

  it("surfaces the api message on a non-OK cached-matches response", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ message: "Cache unavailable" }), { status: 503 })
    );
    const { result } = renderHook(() => useCachedMatches(account), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("Cache unavailable");
  });

  it("falls back to 'HTTP <status>' when the cached-matches error body isn't JSON", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response("<html>500 internal error</html>", { status: 500 })
    );
    const { result } = renderHook(() => useCachedMatches(account), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toMatch(/HTTP 500/);
  });

  it("stops paginating once consumed reaches total", async () => {
    // total=2, page returns 2 matches → consumed (0+2) >= total → no next page.
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ matches: [sample, sample], total: 2 }), {
        status: 200,
      })
    );
    const { result } = renderHook(() => useCachedMatches(account), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.hasNextPage).toBe(false);
  });

  it("bails out of pagination when a page comes back empty before total is reached", async () => {
    // total=10 but matches is empty → cache has gaps → no next page.
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ matches: [], total: 10 }), { status: 200 })
    );
    const { result } = renderHook(() => useCachedMatches(account), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.hasNextPage).toBe(false);
  });
});

describe("useCachedMatchesWindow", () => {
  it("does not fetch while account is undefined", () => {
    renderHook(() => useCachedMatchesWindow(undefined, 20), { wrapper: makeWrapper() });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("fetches a single cached-matches window sized by `count`", async () => {
    const page: CachedMatchesResult = {
      matches: [sample],
      total: 1,
    } as unknown as CachedMatchesResult;
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify(page), { status: 200 })
    );
    const { result } = renderHook(() => useCachedMatchesWindow(account, 10), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:2010/lol/summoners/euw1/Vyoh/Ahri/matches/cached?start=0&count=10"
    );
  });

  it("forwards an explicit queue param when supplied", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ matches: [], total: 0 }), { status: 200 })
    );
    const { result } = renderHook(() => useCachedMatchesWindow(account, 5, 420), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:2010/lol/summoners/euw1/Vyoh/Ahri/matches/cached?start=0&count=5&queue=420"
    );
  });
});

describe("useSyncAccount (mutation)", () => {
  it("does nothing when called with no account and throws on mutate", async () => {
    const { result } = renderHook(() => useSyncAccount(undefined), {
      wrapper: makeWrapper(),
    });
    await expect(result.current.mutateAsync()).rejects.toThrow(/No account/);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("POSTs the URL-encoded per-account sync path on mutate", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ idCount: 5, backfilled: 2 }), { status: 200 })
    );
    const { result } = renderHook(() => useSyncAccount(account), {
      wrapper: makeWrapper(),
    });
    await result.current.mutateAsync();
    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:2010/lol/summoners/euw1/Vyoh/Ahri/matches/sync",
      { method: "POST" }
    );
  });

  it("surfaces the api message on a non-OK sync response", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ message: "Rate limited" }), { status: 429 })
    );
    const { result } = renderHook(() => useSyncAccount(account), {
      wrapper: makeWrapper(),
    });
    await expect(result.current.mutateAsync()).rejects.toThrow(/Rate limited/);
  });

  it("falls back to 'HTTP <status>' when the sync error body isn't JSON", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response("nope", { status: 502 }));
    const { result } = renderHook(() => useSyncAccount(account), {
      wrapper: makeWrapper(),
    });
    await expect(result.current.mutateAsync()).rejects.toThrow(/HTTP 502/);
  });

  it("invalidates matches-cached / champion-extras for this account on success", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ idCount: 5, backfilled: 2 }), { status: 200 })
    );
    const client = makeClient();
    const invalidateSpy = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useSyncAccount(account), {
      wrapper: makeWrapper(client),
    });
    await result.current.mutateAsync();
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ predicate: expect.any(Function) })
    );

    const call = invalidateSpy.mock.calls[0]?.[0] as unknown as {
      predicate: (q: { queryKey: unknown[] }) => boolean;
    };
    expect(
      call.predicate({
        queryKey: ["lol", "matches-cached", "euw1", "Vyoh", "Ahri"],
      })
    ).toBe(true);
    expect(
      call.predicate({
        queryKey: ["lol", "champion-extras", "euw1", "Vyoh", "Ahri"],
      })
    ).toBe(true);
    expect(
      call.predicate({
        queryKey: ["lol", "matches-cached", "na1", "Other", "X"],
      })
    ).toBe(false);
    expect(call.predicate({ queryKey: ["lol", "trends", "euw1", "Vyoh", "Ahri"] })).toBe(
      false
    );
    expect(call.predicate({ queryKey: ["other"] })).toBe(false);
  });
});

describe("useCachedMatchSummary", () => {
  it("looks up the match across matches / cached-infinite / cached / window caches", () => {
    const client = makeClient();
    const hit: MatchSummary = { ...sample, matchId: "EUW1_HIT" };
    client.setQueryData(["lol", "matches"], { pages: [[hit]] });

    const { result } = renderHook(() => useCachedMatchSummary("EUW1_HIT"), {
      wrapper: makeWrapper(client),
    });
    expect(result.current).toEqual(hit);
  });

  it("returns undefined when no cache contains the match", () => {
    const { result } = renderHook(() => useCachedMatchSummary("NOPE"), {
      wrapper: makeWrapper(),
    });
    expect(result.current).toBeUndefined();
  });

  it("falls through to matches-window when other caches miss", () => {
    const client = makeClient();
    const hit: MatchSummary = { ...sample, matchId: "EUW1_W" };
    client.setQueryData(["lol", "matches-window", "euw1", "Vyoh", "Ahri", 10], [hit]);
    const { result } = renderHook(() => useCachedMatchSummary("EUW1_W"), {
      wrapper: makeWrapper(client),
    });
    expect(result.current).toEqual(hit);
  });

  it("finds the match in the cached-infinite paged cache", () => {
    const client = makeClient();
    const hit: MatchSummary = { ...sample, matchId: "EUW1_CI" };
    client.setQueryData(
      ["lol", "matches-cached-infinite", "euw1", "Vyoh", "Ahri", undefined],
      { pages: [{ matches: [hit], total: 1 }] }
    );
    const { result } = renderHook(() => useCachedMatchSummary("EUW1_CI"), {
      wrapper: makeWrapper(client),
    });
    expect(result.current).toEqual(hit);
  });

  it("finds the match in the single-window cached cache", () => {
    const client = makeClient();
    const hit: MatchSummary = { ...sample, matchId: "EUW1_CW" };
    client.setQueryData(
      ["lol", "matches-cached", "euw1", "Vyoh", "Ahri", 10, undefined],
      { matches: [hit], total: 1 }
    );
    const { result } = renderHook(() => useCachedMatchSummary("EUW1_CW"), {
      wrapper: makeWrapper(client),
    });
    expect(result.current).toEqual(hit);
  });
});

describe("useMatchEventsSubscription", () => {
  class FakeEventSource {
    static instances: FakeEventSource[] = [];
    listeners: Record<string, ((e: MessageEvent) => void) | undefined> = {};
    closed = false;
    url: string;
    constructor(url: string) {
      this.url = url;
      FakeEventSource.instances.push(this);
    }
    addEventListener(name: string, fn: (e: MessageEvent) => void) {
      this.listeners[name] = fn;
    }
    removeEventListener(name: string, _fn: (e: MessageEvent) => void) {
      this.listeners[name] = undefined;
    }
    close() {
      this.closed = true;
    }
    fire(name: string) {
      this.listeners[name]?.(new MessageEvent(name, { data: "{}" }));
    }
  }

  beforeEach(() => {
    FakeEventSource.instances = [];
    vi.stubGlobal("EventSource", FakeEventSource);
  });

  it("opens the per-account events stream when an account is provided", () => {
    renderHook(() => useMatchEventsSubscription(account), { wrapper: makeWrapper() });
    expect(FakeEventSource.instances[0]?.url).toBe(
      "http://localhost:2010/lol/summoners/euw1/Vyoh/Ahri/matches/events"
    );
  });

  it("does not open a stream when account is undefined", () => {
    renderHook(() => useMatchEventsSubscription(undefined), { wrapper: makeWrapper() });
    expect(FakeEventSource.instances.length).toBe(0);
  });

  it("invalidates account-scoped matches-cached queries on match-updated events", () => {
    const client = makeClient();
    const invalidateSpy = vi.spyOn(client, "invalidateQueries");
    renderHook(() => useMatchEventsSubscription(account), {
      wrapper: makeWrapper(client),
    });
    FakeEventSource.instances[0]?.fire("match-updated");
    expect(invalidateSpy).toHaveBeenCalled();
    const call = invalidateSpy.mock.calls[0]?.[0] as unknown as {
      predicate: (q: { queryKey: unknown[] }) => boolean;
    };
    expect(
      call.predicate({
        queryKey: ["lol", "matches-cached", "euw1", "Vyoh", "Ahri"],
      })
    ).toBe(true);
    expect(
      call.predicate({
        queryKey: ["lol", "matches-cached", "na1", "Other", "X"],
      })
    ).toBe(false);
  });

  it("closes the EventSource on unmount", () => {
    const { unmount } = renderHook(() => useMatchEventsSubscription(account), {
      wrapper: makeWrapper(),
    });
    const source = FakeEventSource.instances[0];
    unmount();
    expect(source?.closed).toBe(true);
  });
});

describe("prefetchCachedMatches", () => {
  it("prefetches the cached-infinite query for the account", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ matches: [sample], total: 1 }), { status: 200 })
    );
    const client = makeClient();
    await prefetchCachedMatches(client, account);
    const data = client.getQueryData<{ pages: CachedMatchesResult[] }>([
      "lol",
      "matches-cached-infinite",
      "euw1",
      "Vyoh",
      "Ahri",
      undefined,
    ]);
    expect(data?.pages.length).toBe(1);
    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:2010/lol/summoners/euw1/Vyoh/Ahri/matches/cached?start=0&count=20"
    );
  });
});
