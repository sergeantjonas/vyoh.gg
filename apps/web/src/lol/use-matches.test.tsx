import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { MatchSummary } from "@vyoh/shared";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useMatches } from "./use-matches";

const sample: MatchSummary = {
  matchId: "EUW1_1",
  queueType: "Ranked Solo",
  champion: "Ahri",
  kills: 8,
  deaths: 3,
  assists: 12,
  win: true,
  durationSec: 1834,
  playedAt: new Date().toISOString(),
};

function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
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

describe("useMatches", () => {
  it("does not fetch while the name is empty", () => {
    renderHook(() => useMatches("euw1", ""), { wrapper: makeWrapper() });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("returns matches when the request succeeds", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify([sample]), { status: 200 })
    );

    const { result } = renderHook(() => useMatches("euw1", "Vyoh"), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([sample]);
    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:2010/lol/summoners/euw1/Vyoh/matches"
    );
  });

  it("surfaces an error when the request fails", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 500 }));

    const { result } = renderHook(() => useMatches("euw1", "Vyoh"), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toMatch(/HTTP 500/);
  });
});
