import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCurrentPatchChanges } from "./use-current-patch-changes";
import { usePatchChanges } from "./use-patch-changes";
import { usePatchList } from "./use-patch-list";

function makeWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
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

describe("usePatchList", () => {
  it("fetches /lol/patches and returns the body", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify([{ version: "14.20.1" }]), { status: 200 })
    );
    const { result } = renderHook(() => usePatchList(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetch).toHaveBeenCalledWith("http://localhost:2010/lol/patches");
    expect(result.current.data).toEqual([{ version: "14.20.1" }]);
  });

  it("surfaces the api error message", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ message: "patch list down" }), { status: 500 })
    );
    const { result } = renderHook(() => usePatchList(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("patch list down");
  });

  it("falls back to HTTP <status> on non-json body", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response("nope", { status: 503 }));
    const { result } = renderHook(() => usePatchList(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toMatch(/HTTP 503/);
  });
});

describe("usePatchChanges", () => {
  it("does not fetch when version is null", () => {
    renderHook(() => usePatchChanges(null), { wrapper: makeWrapper() });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("does not fetch when version is the empty string", () => {
    renderHook(() => usePatchChanges(""), { wrapper: makeWrapper() });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("fetches /lol/patches/<version>/changes when version is present", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ changes: [] }), { status: 200 })
    );
    const { result } = renderHook(() => usePatchChanges("14.20.1"), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:2010/lol/patches/14.20.1/changes"
    );
  });

  it("URL-encodes the version segment", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ changes: [] }), { status: 200 })
    );
    const { result } = renderHook(() => usePatchChanges("14.20/1"), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:2010/lol/patches/14.20%2F1/changes"
    );
  });

  it("surfaces the api error message", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ message: "bad patch" }), { status: 404 })
    );
    const { result } = renderHook(() => usePatchChanges("14.20.1"), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("bad patch");
  });

  it("falls back to HTTP <status> on non-json body", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response("nope", { status: 503 }));
    const { result } = renderHook(() => usePatchChanges("14.20.1"), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toMatch(/HTTP 503/);
  });
});

describe("useCurrentPatchChanges", () => {
  it("stays disabled when champions list is empty", () => {
    renderHook(() => useCurrentPatchChanges([]), { wrapper: makeWrapper() });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("appends each champion as a repeated query param", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ changes: [] }), { status: 200 })
    );
    const { result } = renderHook(() => useCurrentPatchChanges(["Ahri", "Lux"]), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(String(vi.mocked(fetch).mock.calls[0]?.[0])).toBe(
      "http://localhost:2010/lol/patches/current/changes?champion=Ahri&champion=Lux"
    );
  });

  it("surfaces the api error message", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ message: "out" }), { status: 500 })
    );
    const { result } = renderHook(() => useCurrentPatchChanges(["Ahri"]), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("out");
  });

  it("falls back to HTTP <status> on non-json body", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response("nope", { status: 503 }));
    const { result } = renderHook(() => useCurrentPatchChanges(["Ahri"]), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toMatch(/HTTP 503/);
  });
});
