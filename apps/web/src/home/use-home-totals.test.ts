import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { HomeLifetimeTotals, HomeToday } from "@vyoh/shared";
import { type ReactNode, createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useHomeLifetimeTotals } from "./use-home-lifetime-totals";
import { useHomeToday } from "./use-home-today";

function makeWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children);
}

const today: HomeToday = {
  lolMatches: 4,
  lolWins: 3,
  lolLosses: 1,
  kills: 21,
  deaths: 12,
  assists: 30,
  steamMinutes: 45,
  achievementUnlocks: 2,
  asOf: "2026-05-19T18:00:00.000Z",
  timeZone: "Europe/Brussels",
};

const lifetime: HomeLifetimeTotals = {
  lolMatchCount: 1200,
  lolMinutes: 36_000,
  steamMinutes: 90_000,
  oldestMatchAt: "2021-03-04T12:00:00.000Z",
  oldestUnlockAt: "2014-06-01T09:00:00.000Z",
  steamGamesOwned: 88,
  steamGamesUnplayed: 31,
};

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useHomeToday", () => {
  it("fetches /home/today and returns parsed data", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify(today), { status: 200 })
    );
    const { result } = renderHook(() => useHomeToday(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetch).toHaveBeenCalledWith("http://localhost:2010/home/today");
    expect(result.current.data).toEqual(today);
  });

  it("surfaces the api error message when the response is not ok", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ message: "no day" }), { status: 500 })
    );
    const { result } = renderHook(() => useHomeToday(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("no day");
  });

  it("falls back to HTTP <status> when the response body is not json", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response("nope", { status: 404 }));
    const { result } = renderHook(() => useHomeToday(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toMatch(/HTTP 404/);
  });
});

describe("useHomeLifetimeTotals", () => {
  it("fetches /home/lifetime-totals and returns parsed data", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify(lifetime), { status: 200 })
    );
    const { result } = renderHook(() => useHomeLifetimeTotals(), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetch).toHaveBeenCalledWith("http://localhost:2010/home/lifetime-totals");
    expect(result.current.data).toEqual(lifetime);
  });

  // The nullable oldest-* fields are the ones a fresh install returns.
  it("passes through null oldest-* timestamps", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({ ...lifetime, oldestMatchAt: null, oldestUnlockAt: null }),
        { status: 200 }
      )
    );
    const { result } = renderHook(() => useHomeLifetimeTotals(), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.oldestMatchAt).toBeNull();
    expect(result.current.data?.oldestUnlockAt).toBeNull();
  });

  it("surfaces the api error message when the response is not ok", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ message: "no totals" }), { status: 500 })
    );
    const { result } = renderHook(() => useHomeLifetimeTotals(), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("no totals");
  });

  it("falls back to HTTP <status> when the response body is not json", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response("nope", { status: 503 }));
    const { result } = renderHook(() => useHomeLifetimeTotals(), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toMatch(/HTTP 503/);
  });
});
