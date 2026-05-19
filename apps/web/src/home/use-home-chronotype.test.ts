import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { HomeChronotype } from "@vyoh/shared";
import { type ReactNode, createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useHomeChronotype } from "./use-home-chronotype";

function makeWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children);
}

const sample: HomeChronotype = {
  hours: Array.from({ length: 24 }, (_, i) => ({ hour: i, total: 0, lol: 0, steam: 0 })),
  totalLolCount: 0,
  totalSteamCount: 0,
  timeZone: "Europe/Brussels",
};

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useHomeChronotype", () => {
  it("fetches /home/chronotype with the default count and returns parsed data", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify(sample), { status: 200 })
    );
    const { result } = renderHook(() => useHomeChronotype(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetch).toHaveBeenCalledWith("http://localhost:2010/home/chronotype?count=500");
    expect(result.current.data).toEqual(sample);
  });

  it("forwards a custom count into the query string", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify(sample), { status: 200 })
    );
    renderHook(() => useHomeChronotype(42), { wrapper: makeWrapper() });
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith("http://localhost:2010/home/chronotype?count=42")
    );
  });

  it("surfaces the api error message when the response is not ok", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ message: "boom" }), { status: 500 })
    );
    const { result } = renderHook(() => useHomeChronotype(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("boom");
  });

  it("falls back to HTTP <status> when the response body is not json", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response("not json", { status: 503 }));
    const { result } = renderHook(() => useHomeChronotype(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toMatch(/HTTP 503/);
  });
});
