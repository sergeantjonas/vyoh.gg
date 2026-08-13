import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { Viewer } from "@vyoh/shared";
import { type ReactNode, createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useIsOwner, useLogout, useViewer, viewerQueryKey } from "./use-viewer";

function makeWrapper(client: QueryClient) {
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children);
}

function freshClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

const OWNER: Viewer = { isOwner: true, login: "sergeantjonas" };
const ANON: Viewer = { isOwner: false };

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useViewer", () => {
  it("sends the session cookie — without credentials the api sees an anonymous request", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(OWNER)));
    const { result } = renderHook(() => useViewer(), {
      wrapper: makeWrapper(freshClient()),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetch).toHaveBeenCalledWith("http://localhost:2010/auth/viewer", {
      credentials: "include",
    });
    expect(result.current.data).toEqual(OWNER);
  });
});

describe("useIsOwner", () => {
  it("reads true only from a confirmed owner session", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(OWNER)));
    const { result } = renderHook(() => useIsOwner(), {
      wrapper: makeWrapper(freshClient()),
    });
    await waitFor(() => expect(result.current).toBe(true));
  });

  it("stays false while the answer is still in flight", () => {
    vi.mocked(fetch).mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useIsOwner(), {
      wrapper: makeWrapper(freshClient()),
    });
    // Closed-by-default: a pending viewer must not briefly unlock the controls.
    expect(result.current).toBe(false);
  });

  it("stays false when the api is unreachable", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("network down"));
    const client = freshClient();
    const { result } = renderHook(() => useIsOwner(), {
      wrapper: makeWrapper(client),
    });
    await waitFor(() =>
      expect(client.getQueryState(viewerQueryKey)?.status).toBe("error")
    );
    expect(result.current).toBe(false);
  });

  it("reads false for a visitor the api recognises as not the owner", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(ANON)));
    const client = freshClient();
    const { result } = renderHook(() => useIsOwner(), {
      wrapper: makeWrapper(client),
    });
    await waitFor(() =>
      expect(client.getQueryState(viewerQueryKey)?.status).toBe("success")
    );
    expect(result.current).toBe(false);
  });
});

describe("useLogout", () => {
  it("POSTs with credentials and re-locks the cache", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 204 }));
    const client = freshClient();
    client.setQueryData(viewerQueryKey, OWNER);

    const { result } = renderHook(() => useLogout(), {
      wrapper: makeWrapper(client),
    });
    await act(async () => {
      await result.current.mutateAsync();
    });

    expect(fetch).toHaveBeenCalledWith("http://localhost:2010/auth/logout", {
      method: "POST",
      credentials: "include",
    });
    expect(client.getQueryData<Viewer>(viewerQueryKey)).toEqual(ANON);
  });

  it("re-locks even when the request fails after the server deleted the row", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 500 }));
    const client = freshClient();
    client.setQueryData(viewerQueryKey, OWNER);

    const { result } = renderHook(() => useLogout(), {
      wrapper: makeWrapper(client),
    });
    await act(async () => {
      await result.current.mutateAsync().catch(() => {});
    });

    expect(client.getQueryData<Viewer>(viewerQueryKey)).toEqual(ANON);
  });
});
