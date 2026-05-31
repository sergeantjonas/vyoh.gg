import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { HomeActivityIntensity } from "@vyoh/shared";
import { type ReactNode, createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useHomeActivityIntensity } from "./use-home-activity-intensity";

function makeWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children);
}

const sample: HomeActivityIntensity = {
  lolMatches24h: 4,
  steamMinutesToday: 60,
  intensity: 0.67,
  asOf: "2026-05-31T12:00:00.000Z",
  timeZone: "Europe/Brussels",
};

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useHomeActivityIntensity", () => {
  it("fetches /home/activity-intensity and returns parsed data", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify(sample), { status: 200 })
    );
    const { result } = renderHook(() => useHomeActivityIntensity(), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetch).toHaveBeenCalledWith("http://localhost:2010/home/activity-intensity");
    expect(result.current.data).toEqual(sample);
  });

  it("surfaces the api error message when the response is not ok", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ message: "no signal" }), { status: 500 })
    );
    const { result } = renderHook(() => useHomeActivityIntensity(), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("no signal");
  });

  it("falls back to HTTP <status> when the response body is not json", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response("nope", { status: 404 }));
    const { result } = renderHook(() => useHomeActivityIntensity(), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toMatch(/HTTP 404/);
  });
});
