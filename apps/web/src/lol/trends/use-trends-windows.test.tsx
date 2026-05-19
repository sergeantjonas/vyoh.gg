import { useSeriousQueues } from "@/lol/_shared/serious-queues/serious-queues";
import { useCachedMatchesWindow } from "@/lol/matches/use-matches";
import { renderHook } from "@testing-library/react";
import type { LolAccount, MatchSummary } from "@vyoh/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useTrendsWindows } from "./use-trends-windows";

vi.mock("@/lol/matches/use-matches", () => ({
  useCachedMatchesWindow: vi.fn(),
}));

vi.mock("@/lol/_shared/serious-queues/serious-queues", () => ({
  useSeriousQueues: vi.fn(),
  filterToSerious: (matches: MatchSummary[]) => matches,
}));

const account: LolAccount = {
  region: "euw1",
  gameName: "Jonas",
  tagLine: "EUW",
  slug: "jonas-euw",
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function fakeMatch(
  playedAtMs: number,
  overrides: Partial<MatchSummary> = {}
): MatchSummary {
  return {
    matchId: `M${playedAtMs}-${overrides.gameVersion ?? "x"}`,
    playedAt: new Date(playedAtMs).toISOString(),
    gameVersion: "14.20.586.5840",
    queueType: "Ranked Solo",
    ...overrides,
  } as unknown as MatchSummary;
}

function setMatches(matches: MatchSummary[] | undefined, isPending = false) {
  vi.mocked(useCachedMatchesWindow).mockReturnValue({
    data: matches !== undefined ? { matches, total: matches.length } : undefined,
    isPending,
  } as unknown as ReturnType<typeof useCachedMatchesWindow>);
  vi.mocked(useSeriousQueues).mockReturnValue({
    ids: ["Ranked Solo"],
  } as unknown as ReturnType<typeof useSeriousQueues>);
}

afterEach(() => {
  vi.mocked(useCachedMatchesWindow).mockReset();
  vi.mocked(useSeriousQueues).mockReset();
});

describe("useTrendsWindows", () => {
  it("returns empty windows and propagates isPending when data is undefined", () => {
    setMatches(undefined, true);
    const { result } = renderHook(() => useTrendsWindows("7d", account));
    expect(result.current.current).toEqual([]);
    expect(result.current.previous).toEqual([]);
    expect(result.current.isPending).toBe(true);
  });

  it("requests 200 matches for time-based ranges and 800 for the patch range", () => {
    setMatches([]);
    renderHook(() => useTrendsWindows("7d", account));
    expect(vi.mocked(useCachedMatchesWindow)).toHaveBeenLastCalledWith(account, 200);

    vi.mocked(useCachedMatchesWindow).mockClear();
    renderHook(() => useTrendsWindows("patch", account));
    expect(vi.mocked(useCachedMatchesWindow)).toHaveBeenLastCalledWith(account, 800);
  });

  it("splits the 100g range into the most-recent 100 (current) and the previous 100 (previous)", () => {
    const now = Date.now();
    const matches: MatchSummary[] = [];
    for (let i = 0; i < 250; i++) {
      matches.push(fakeMatch(now - i * 1000));
    }
    setMatches(matches);
    const { result } = renderHook(() => useTrendsWindows("100g", account));
    expect(result.current.current).toHaveLength(100);
    expect(result.current.previous).toHaveLength(100);
    // Newest first
    expect(result.current.current[0]?.matchId).toBe(matches[0]?.matchId);
    expect(result.current.previous[0]?.matchId).toBe(matches[100]?.matchId);
  });

  it("buckets matches into 7d current vs the prior 7d window", () => {
    const now = Date.now();
    const matches: MatchSummary[] = [
      fakeMatch(now - 1 * MS_PER_DAY),
      fakeMatch(now - 6 * MS_PER_DAY),
      fakeMatch(now - 10 * MS_PER_DAY),
      fakeMatch(now - 20 * MS_PER_DAY),
    ];
    setMatches(matches);
    const { result } = renderHook(() => useTrendsWindows("7d", account));
    expect(result.current.current).toHaveLength(2);
    expect(result.current.previous).toHaveLength(1);
  });

  it("buckets matches into 30d current vs the prior 30d window", () => {
    const now = Date.now();
    const matches: MatchSummary[] = [
      fakeMatch(now - 5 * MS_PER_DAY),
      fakeMatch(now - 40 * MS_PER_DAY),
      fakeMatch(now - 80 * MS_PER_DAY),
    ];
    setMatches(matches);
    const { result } = renderHook(() => useTrendsWindows("30d", account));
    expect(result.current.current).toHaveLength(1);
    expect(result.current.previous).toHaveLength(1);
  });

  it("returns current+previous patch buckets via groupByPatch for the patch range", () => {
    const now = Date.now();
    const matches: MatchSummary[] = [
      fakeMatch(now - 1 * MS_PER_DAY, { gameVersion: "14.20.586.5840" }),
      fakeMatch(now - 2 * MS_PER_DAY, { gameVersion: "14.20.586.5840" }),
      fakeMatch(now - 30 * MS_PER_DAY, { gameVersion: "14.19.586.5840" }),
    ];
    setMatches(matches);
    const { result } = renderHook(() => useTrendsWindows("patch", account));
    expect(result.current.current.length).toBeGreaterThan(0);
    expect(result.current.previous.length).toBeGreaterThan(0);
  });

  it("returns an empty previous bucket for the patch range when only one patch is in scope", () => {
    const now = Date.now();
    const matches: MatchSummary[] = [
      fakeMatch(now - 1 * MS_PER_DAY, { gameVersion: "14.20.586.5840" }),
      fakeMatch(now - 2 * MS_PER_DAY, { gameVersion: "14.20.586.5840" }),
    ];
    setMatches(matches);
    const { result } = renderHook(() => useTrendsWindows("patch", account));
    expect(result.current.previous).toEqual([]);
  });
});
