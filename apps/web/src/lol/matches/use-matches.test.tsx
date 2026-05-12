import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { LolAccount, MatchSummary } from "@vyoh/shared";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useMatches } from "./use-matches";

const account: LolAccount = {
  slug: "ahri",
  region: "euw1",
  gameName: "Vyoh",
  tagLine: "Ahri",
};

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
  remake: false,
  teamPosition: "MIDDLE",
  gameVersion: "14.20.586.5840",
  visionScore: 30,
  damageShare: 0.25,
  firstBloodKill: false,
  csAt10: 0,
  csAt15: 0,
  goldAt10: 0,
  goldAt15: 0,
  teamGoldDiffAt15: 0,
  deathTimings: [],
  deathXs: [],
  deathYs: [],
  killTimings: [],
  killXs: [],
  killYs: [],
  laneOpponent: null,
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
  it("does not fetch while account is undefined", () => {
    renderHook(() => useMatches(undefined), { wrapper: makeWrapper() });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("returns the first page when the request succeeds", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify([sample]), { status: 200 })
    );

    const { result } = renderHook(() => useMatches(account), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.pages).toEqual([[sample]]);
    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:2010/lol/summoners/euw1/Vyoh/Ahri/matches?start=0&count=20"
    );
  });

  it("surfaces an error when the request fails", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 500 }));

    const { result } = renderHook(() => useMatches(account), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toMatch(/HTTP 500/);
  });

  it("surfaces the api's message when the response body has one", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ statusCode: 404, message: "Summoner not found" }), {
        status: 404,
      })
    );

    const { result } = renderHook(() => useMatches(account), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("Summoner not found");
  });
});
