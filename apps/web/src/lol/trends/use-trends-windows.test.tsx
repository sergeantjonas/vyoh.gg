import { useSeriousQueues } from "@/lol/_shared/serious-queues/serious-queues";
import { useCachedMatchesWindow } from "@/lol/matches/use-matches";
import { usePatchList } from "@/lol/patches/use-patch-list";
import { renderHook } from "@testing-library/react";
import type { LolAccount, MatchSummary, PatchListEntry } from "@vyoh/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useTrendsWindows } from "./use-trends-windows";

vi.mock("@/lol/matches/use-matches", () => ({
  useCachedMatchesWindow: vi.fn(),
}));

vi.mock("@/lol/_shared/serious-queues/serious-queues", () => ({
  useSeriousQueues: vi.fn(),
  filterToSerious: (matches: MatchSummary[]) => matches,
}));

vi.mock("@/lol/patches/use-patch-list", () => ({
  usePatchList: vi.fn(),
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
  // Default to an empty patch list so tests that don't care about patch keys
  // don't crash on the destructure. Patch-specific tests override via
  // setPatchList().
  if (vi.mocked(usePatchList).getMockImplementation() === undefined) {
    vi.mocked(usePatchList).mockReturnValue({
      data: [],
    } as unknown as ReturnType<typeof usePatchList>);
  }
}

function setPatchList(versions: string[]) {
  const entries: PatchListEntry[] = versions.map((v) => ({
    version: v,
    patchDate: null,
    fetchedAt: new Date().toISOString(),
  }));
  vi.mocked(usePatchList).mockReturnValue({
    data: entries,
  } as unknown as ReturnType<typeof usePatchList>);
}

afterEach(() => {
  vi.mocked(useCachedMatchesWindow).mockReset();
  vi.mocked(useSeriousQueues).mockReset();
  vi.mocked(usePatchList).mockReset();
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

  it("returns current+previous patch buckets keyed off the live patch list for the patch range", () => {
    const now = Date.now();
    const matches: MatchSummary[] = [
      fakeMatch(now - 1 * MS_PER_DAY, { gameVersion: "14.20.586.5840" }),
      fakeMatch(now - 2 * MS_PER_DAY, { gameVersion: "14.20.586.5840" }),
      fakeMatch(now - 30 * MS_PER_DAY, { gameVersion: "14.19.586.5840" }),
    ];
    // truncatePatch maps the API major (14) onto display major (+10).
    setPatchList(["24.20", "24.19"]);
    setMatches(matches);
    const { result } = renderHook(() => useTrendsWindows("patch", account));
    expect(result.current.current).toHaveLength(2);
    expect(result.current.previous).toHaveLength(1);
    expect(result.current.livePatch).toBe("24.20");
  });

  it("returns an empty previous bucket for the patch range when only one patch is in scope", () => {
    const now = Date.now();
    const matches: MatchSummary[] = [
      fakeMatch(now - 1 * MS_PER_DAY, { gameVersion: "14.20.586.5840" }),
      fakeMatch(now - 2 * MS_PER_DAY, { gameVersion: "14.20.586.5840" }),
    ];
    setPatchList(["24.20", "24.19"]);
    setMatches(matches);
    const { result } = renderHook(() => useTrendsWindows("patch", account));
    expect(result.current.previous).toEqual([]);
  });

  it("returns an empty current bucket when no games have been played on the live patch yet", () => {
    // Live patch is 24.21, but the user has only played 24.20 and 24.19.
    // Old behaviour would have returned the 24.20 bucket as "current" — the
    // fix should surface this honestly as zero current-patch games.
    const now = Date.now();
    const matches: MatchSummary[] = [
      fakeMatch(now - 1 * MS_PER_DAY, { gameVersion: "14.20.586.5840" }),
      fakeMatch(now - 2 * MS_PER_DAY, { gameVersion: "14.20.586.5840" }),
      fakeMatch(now - 30 * MS_PER_DAY, { gameVersion: "14.19.586.5840" }),
    ];
    setPatchList(["24.21", "24.20"]);
    setMatches(matches);
    const { result } = renderHook(() => useTrendsWindows("patch", account));
    expect(result.current.current).toEqual([]);
    expect(result.current.previous).toHaveLength(2);
    expect(result.current.livePatch).toBe("24.21");
  });

  it("returns empty windows for the patch range when the patch list hasn't loaded yet", () => {
    const now = Date.now();
    const matches: MatchSummary[] = [
      fakeMatch(now - 1 * MS_PER_DAY, { gameVersion: "14.20.586.5840" }),
    ];
    setPatchList([]);
    setMatches(matches);
    const { result } = renderHook(() => useTrendsWindows("patch", account));
    expect(result.current.current).toEqual([]);
    expect(result.current.previous).toEqual([]);
    expect(result.current.livePatch).toBeUndefined();
  });
});
