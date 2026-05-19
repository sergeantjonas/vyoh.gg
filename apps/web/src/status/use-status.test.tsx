import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { LolAccount, StatusSnapshot } from "@vyoh/shared";
import { type ReactNode, createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  useSetSyncEnabled,
  useStatus,
  useStatusStream,
  useSyncAccount,
  useSyncNow,
} from "./use-status";

function makeWrapper(client: QueryClient) {
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children);
}

function freshClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

const baseSnapshot: StatusSnapshot = {
  sync: {
    enabled: true,
    running: false,
    lastTickAt: null,
    lastTickDurationMs: null,
    nextTickAt: null,
  },
  riot: {
    apps: [],
    methods: [],
  },
} as unknown as StatusSnapshot;

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useStatus", () => {
  it("fetches /status on mount and parses the snapshot", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify(baseSnapshot), { status: 200 })
    );
    const client = freshClient();
    const { result } = renderHook(() => useStatus(), {
      wrapper: makeWrapper(client),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetch).toHaveBeenCalledWith("http://localhost:2010/status");
    expect(result.current.data).toEqual(baseSnapshot);
  });

  it("throws HTTP <status> when /status returns a non-ok response", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 500 }));
    const client = freshClient();
    const { result } = renderHook(() => useStatus(), {
      wrapper: makeWrapper(client),
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toMatch(/HTTP 500/);
  });
});

describe("useSyncNow", () => {
  it("POSTs /status/sync and patches the cached sync state on success", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          status: { ...baseSnapshot.sync, running: true },
          triggered: true,
        }),
        { status: 200 }
      )
    );
    const client = freshClient();
    client.setQueryData<StatusSnapshot>(["status"], baseSnapshot);

    const { result } = renderHook(() => useSyncNow(), {
      wrapper: makeWrapper(client),
    });

    await act(async () => {
      await result.current.mutateAsync();
    });

    expect(fetch).toHaveBeenCalledWith("http://localhost:2010/status/sync", {
      method: "POST",
    });
    const patched = client.getQueryData<StatusSnapshot>(["status"]);
    expect(patched?.sync.running).toBe(true);
  });

  it("surfaces the api error message when /status/sync fails", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ message: "already running" }), { status: 409 })
    );
    const { result } = renderHook(() => useSyncNow(), {
      wrapper: makeWrapper(freshClient()),
    });
    await expect(result.current.mutateAsync()).rejects.toThrow("already running");
  });

  it("falls back to HTTP <status> when the body is not json", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response("nope", { status: 500 }));
    const { result } = renderHook(() => useSyncNow(), {
      wrapper: makeWrapper(freshClient()),
    });
    await expect(result.current.mutateAsync()).rejects.toThrow(/HTTP 500/);
  });
});

describe("useSetSyncEnabled", () => {
  it("POSTs /status/sync/resume when enabling and patches the cache", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ ...baseSnapshot.sync, enabled: true }), {
        status: 200,
      })
    );
    const client = freshClient();
    client.setQueryData<StatusSnapshot>(["status"], baseSnapshot);

    const { result } = renderHook(() => useSetSyncEnabled(), {
      wrapper: makeWrapper(client),
    });
    await act(async () => {
      await result.current.mutateAsync(true);
    });
    expect(fetch).toHaveBeenCalledWith("http://localhost:2010/status/sync/resume", {
      method: "POST",
    });
    expect(client.getQueryData<StatusSnapshot>(["status"])?.sync.enabled).toBe(true);
  });

  it("POSTs /status/sync/pause when disabling", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ ...baseSnapshot.sync, enabled: false }), {
        status: 200,
      })
    );
    const { result } = renderHook(() => useSetSyncEnabled(), {
      wrapper: makeWrapper(freshClient()),
    });
    await act(async () => {
      await result.current.mutateAsync(false);
    });
    expect(fetch).toHaveBeenCalledWith("http://localhost:2010/status/sync/pause", {
      method: "POST",
    });
  });
});

describe("useSyncAccount", () => {
  const account: LolAccount = {
    slug: "ahri",
    region: "euw1",
    gameName: "Vyoh",
    tagLine: "Ahri",
  };

  it("POSTs the URL-encoded per-account sync path and invalidates the status cache", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ idCount: 5, backfilled: 2 }), { status: 200 })
    );
    const client = freshClient();
    const invalidateSpy = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useSyncAccount(), {
      wrapper: makeWrapper(client),
    });
    await act(async () => {
      await result.current.mutateAsync(account);
    });
    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:2010/lol/summoners/euw1/Vyoh/Ahri/matches/sync",
      { method: "POST" }
    );
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["status"] });
  });
});

describe("useStatusStream", () => {
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

  it("writes parsed snapshots into the status query cache", () => {
    const client = freshClient();
    renderHook(() => useStatusStream(), { wrapper: makeWrapper(client) });
    const source = FakeEventSource.instances[0];
    expect(source?.url).toBe("http://localhost:2010/status/stream");

    act(() => {
      source?.fire("snapshot", baseSnapshot);
    });
    expect(client.getQueryData<StatusSnapshot>(["status"])).toEqual(baseSnapshot);
  });

  it("invalidates the cache on tick events", () => {
    const client = freshClient();
    const invalidateSpy = vi.spyOn(client, "invalidateQueries");
    renderHook(() => useStatusStream(), { wrapper: makeWrapper(client) });
    const source = FakeEventSource.instances[0];

    act(() => {
      source?.fire("tick", { durationMs: 5 });
    });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["status"] });
  });

  it("closes the EventSource on unmount", () => {
    const { unmount } = renderHook(() => useStatusStream(), {
      wrapper: makeWrapper(freshClient()),
    });
    const source = FakeEventSource.instances[0];
    unmount();
    expect(source?.closed).toBe(true);
  });
});
