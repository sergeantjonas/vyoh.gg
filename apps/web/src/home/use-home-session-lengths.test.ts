import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { HomeSessionLengths } from "@vyoh/shared";
import { type ReactNode, createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useHomeSessionLengths } from "./use-home-session-lengths";

function makeWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children);
}

const sample: HomeSessionLengths = {
  buckets: [
    { label: "<30m", lolCount: 0, steamCount: 0 },
    { label: "30m–1h", lolCount: 0, steamCount: 0 },
    { label: "1h–2h", lolCount: 0, steamCount: 0 },
    { label: "2h–4h", lolCount: 0, steamCount: 0 },
    { label: "4h+", lolCount: 0, steamCount: 0 },
  ],
  lolSessionCount: 0,
  steamSessionCount: 0,
};

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useHomeSessionLengths", () => {
  it("fetches /home/session-lengths and returns parsed data", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify(sample), { status: 200 })
    );
    const { result } = renderHook(() => useHomeSessionLengths(), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetch).toHaveBeenCalledWith("http://localhost:2010/home/session-lengths");
    expect(result.current.data).toEqual(sample);
  });

  it("surfaces the api error message when the response is not ok", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ message: "no sessions" }), { status: 500 })
    );
    const { result } = renderHook(() => useHomeSessionLengths(), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("no sessions");
  });

  it("falls back to HTTP <status> when the response body is not json", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response("nope", { status: 503 }));
    const { result } = renderHook(() => useHomeSessionLengths(), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toMatch(/HTTP 503/);
  });
});
