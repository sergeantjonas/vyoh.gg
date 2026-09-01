import { viewerQueryKey } from "@/auth/use-viewer";
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
  useSyncPatches,
} from "./use-status";

// Every write here is behind `OwnerGuard`, and the api is a different origin in
// dev, so `credentials` is what decides whether the session cookie is sent at
// all. Asserted on each call rather than trusted: dropping it fails nothing
// locally until the guard is reached, and then fails everything.
const POST = { method: "POST", credentials: "include" };

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

    expect(fetch).toHaveBeenCalledWith("http://localhost:2010/status/sync", POST);
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

  it("rewrites the guard's 401 into copy that describes the user's situation", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ message: "Owner session required" }), {
        status: 401,
      })
    );
    const { result } = renderHook(() => useSyncNow(), {
      wrapper: makeWrapper(freshClient()),
    });
    await expect(result.current.mutateAsync()).rejects.toThrow(
      "Session expired — sign in again"
    );
  });

  it("drops the cached viewer on 401 so the controls re-lock themselves", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response("{}", { status: 401 }));
    const client = freshClient();
    const invalidateSpy = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useSyncNow(), {
      wrapper: makeWrapper(client),
    });
    await expect(result.current.mutateAsync()).rejects.toThrow();
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: viewerQueryKey });
  });

  it("leaves the cached viewer alone for failures that are not about the session", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response("{}", { status: 500 }));
    const client = freshClient();
    const invalidateSpy = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useSyncNow(), {
      wrapper: makeWrapper(client),
    });
    await expect(result.current.mutateAsync()).rejects.toThrow();
    expect(invalidateSpy).not.toHaveBeenCalledWith({ queryKey: viewerQueryKey });
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
    expect(fetch).toHaveBeenCalledWith("http://localhost:2010/status/sync/resume", POST);
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
    expect(fetch).toHaveBeenCalledWith("http://localhost:2010/status/sync/pause", POST);
  });
});

describe("useSyncPatches", () => {
  const jobs = [
    {
      name: "lol-patch-notes",
      stream: "lol",
      label: "Patch notes",
      cron: "0 */6 * * *",
      running: false,
      lastRun: null,
    },
    {
      name: "steam-owned-games",
      stream: "steam",
      label: "Owned games",
      cron: "*/15 * * * *",
      running: false,
      lastRun: null,
    },
  ] as unknown as StatusSnapshot["jobs"];

  // The response carries one job, not a snapshot — patching the whole `jobs`
  // array from it would blank every other row until the next SSE frame.
  it("POSTs /status/sync/patches and patches only the triggered job", async () => {
    const triggered = { ...jobs[0], running: true };
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ triggered: true, job: triggered }), { status: 200 })
    );
    const client = freshClient();
    client.setQueryData<StatusSnapshot>(["status"], { ...baseSnapshot, jobs });

    const { result } = renderHook(() => useSyncPatches(), {
      wrapper: makeWrapper(client),
    });

    await act(async () => {
      await result.current.mutateAsync();
    });

    expect(fetch).toHaveBeenCalledWith("http://localhost:2010/status/sync/patches", POST);
    const patched = client.getQueryData<StatusSnapshot>(["status"]);
    expect(patched?.jobs).toEqual([triggered, jobs[1]]);
  });

  it("leaves the cache alone when the trigger is refused", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({ triggered: false, reason: "already running", job: jobs[0] }),
        { status: 200 }
      )
    );
    const client = freshClient();
    client.setQueryData<StatusSnapshot>(["status"], { ...baseSnapshot, jobs });

    const { result } = renderHook(() => useSyncPatches(), {
      wrapper: makeWrapper(client),
    });

    await expect(result.current.mutateAsync()).resolves.toMatchObject({
      triggered: false,
      reason: "already running",
    });
    // A refused trigger still returns the job unchanged, so the patch is a
    // no-op rather than a state the row would have to un-render.
    expect(client.getQueryData<StatusSnapshot>(["status"])?.jobs).toEqual(jobs);
  });

  it("rewrites the guard's 401 so the controls re-lock", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ message: "Owner session required" }), { status: 401 })
    );
    const { result } = renderHook(() => useSyncPatches(), {
      wrapper: makeWrapper(freshClient()),
    });

    await expect(result.current.mutateAsync()).rejects.toThrow(
      "Session expired — sign in again"
    );
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
      POST
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
