import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { LolAccount } from "@vyoh/shared";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { liveGameQueryKey, useLiveGame, useLiveGameEvents } from "./use-live-match";

function makeClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function makeWrapper(client: QueryClient = makeClient()) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

const account: LolAccount = {
  slug: "ahri",
  region: "euw1",
  gameName: "Vyoh",
  tagLine: "Ahri",
};

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useLiveGame", () => {
  it("does not fetch while account is undefined", () => {
    renderHook(() => useLiveGame(undefined), { wrapper: makeWrapper() });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("fetches the live endpoint and returns the parsed body", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ gameId: "G1" }), { status: 200 })
    );
    const { result } = renderHook(() => useLiveGame(account), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:2010/lol/summoners/euw1/Vyoh/Ahri/live"
    );
    expect(result.current.data).toEqual({ gameId: "G1" });
  });

  it("returns null when the body is empty (game just ended)", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response("", { status: 200 }));
    const { result } = renderHook(() => useLiveGame(account), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeNull();
  });

  it("throws on non-ok response", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 500 }));
    const { result } = renderHook(() => useLiveGame(account), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toMatch(/HTTP 500/);
  });
});

describe("liveGameQueryKey", () => {
  it("returns the canonical key tuple for an account", () => {
    expect(liveGameQueryKey(account)).toEqual(["lol", "live", "euw1", "Vyoh", "Ahri"]);
  });

  it("returns undefined slots when account is missing", () => {
    expect(liveGameQueryKey(undefined)).toEqual([
      "lol",
      "live",
      undefined,
      undefined,
      undefined,
    ]);
  });
});

describe("useLiveGameEvents", () => {
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
    fire(name: string, data: unknown) {
      this.listeners[name]?.(new MessageEvent(name, { data: JSON.stringify(data) }));
    }
  }

  beforeEach(() => {
    FakeEventSource.instances = [];
    vi.stubGlobal("EventSource", FakeEventSource);
  });

  it("opens the live/events stream for the given account", () => {
    renderHook(() => useLiveGameEvents(account), { wrapper: makeWrapper() });
    expect(FakeEventSource.instances[0]?.url).toBe(
      "http://localhost:2010/lol/summoners/euw1/Vyoh/Ahri/live/events"
    );
  });

  it("does not open a stream when account is undefined", () => {
    renderHook(() => useLiveGameEvents(undefined), { wrapper: makeWrapper() });
    expect(FakeEventSource.instances.length).toBe(0);
  });

  it("invokes onGameStarted on game-started events", () => {
    const onGameStarted = vi.fn();
    const onGameEnded = vi.fn();
    renderHook(() => useLiveGameEvents(account, { onGameStarted, onGameEnded }), {
      wrapper: makeWrapper(),
    });
    FakeEventSource.instances[0]?.fire("live-game-updated", {
      type: "game-started",
      puuid: "abc",
    });
    expect(onGameStarted).toHaveBeenCalledWith({ type: "game-started", puuid: "abc" });
    expect(onGameEnded).not.toHaveBeenCalled();
  });

  it("invokes onGameEnded on game-ended events", () => {
    const onGameEnded = vi.fn();
    renderHook(() => useLiveGameEvents(account, { onGameEnded }), {
      wrapper: makeWrapper(),
    });
    FakeEventSource.instances[0]?.fire("live-game-updated", {
      type: "game-ended",
      puuid: "abc",
    });
    expect(onGameEnded).toHaveBeenCalledWith({ type: "game-ended", puuid: "abc" });
  });

  it("invalidates the live-game query on each event", () => {
    const client = makeClient();
    const invalidateSpy = vi.spyOn(client, "invalidateQueries");
    renderHook(() => useLiveGameEvents(account), { wrapper: makeWrapper(client) });
    FakeEventSource.instances[0]?.fire("live-game-updated", {
      type: "game-started",
      puuid: "abc",
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: liveGameQueryKey(account),
    });
  });

  it("closes the EventSource on unmount", () => {
    const { unmount } = renderHook(() => useLiveGameEvents(account), {
      wrapper: makeWrapper(),
    });
    const source = FakeEventSource.instances[0];
    unmount();
    expect(source?.closed).toBe(true);
  });
});
