import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { HomeFirstPlayed } from "@vyoh/shared";
import { type ReactNode, createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useHomeFirstPlayed } from "./use-home-first-played";

function makeWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children);
}

const sample: HomeFirstPlayed = { kind: "none", windowDays: 30 };

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useHomeFirstPlayed", () => {
  it("fetches /home/first-played and returns parsed data", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify(sample), { status: 200 })
    );
    const { result } = renderHook(() => useHomeFirstPlayed(), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetch).toHaveBeenCalledWith("http://localhost:2010/home/first-played");
    expect(result.current.data).toEqual(sample);
  });

  it("surfaces the api error message when the response is not ok", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ message: "no first" }), { status: 500 })
    );
    const { result } = renderHook(() => useHomeFirstPlayed(), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("no first");
  });

  it("falls back to HTTP <status> when the response body is not json", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response("nope", { status: 503 }));
    const { result } = renderHook(() => useHomeFirstPlayed(), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toMatch(/HTTP 503/);
  });
});
