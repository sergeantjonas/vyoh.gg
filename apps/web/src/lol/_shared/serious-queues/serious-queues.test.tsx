import { act, renderHook } from "@testing-library/react";
import type { MatchSummary } from "@vyoh/shared";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_SERIOUS_QUEUE_IDS,
  SeriousQueuesProvider,
  filterToSerious,
  useSeriousQueues,
} from "./serious-queues";

const STORAGE_KEY = "vyoh:serious-queues";

beforeEach(() => {
  window.localStorage.clear();
});
afterEach(() => {
  window.localStorage.clear();
});

function summary(queueType: string, idx = 0): MatchSummary {
  return {
    matchId: `M_${idx}`,
    queueType,
    champion: "Ahri",
    kills: 0,
    deaths: 0,
    assists: 0,
    win: true,
    durationSec: 1800,
    playedAt: new Date(Date.UTC(2026, 0, idx + 1)).toISOString(),
    remake: false,
    teamPosition: "MIDDLE",
    gameVersion: "16.9.1.1",
    visionScore: 0,
    damageShare: 0,
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
}

describe("filterToSerious", () => {
  it("keeps only matches whose queueType matches one of the selected ids' labels", () => {
    const matches = [
      summary("Ranked Solo", 0),
      summary("Ranked Flex", 1),
      summary("ARAM", 2),
      summary("Normal Draft", 3),
    ];
    const ids = new Set([420, 440]);
    const filtered = filterToSerious(matches, ids);
    expect(filtered.map((m) => m.queueType)).toEqual(["Ranked Solo", "Ranked Flex"]);
  });

  it("returns an empty list when no ids match", () => {
    const matches = [summary("ARAM", 0)];
    expect(filterToSerious(matches, new Set([420]))).toEqual([]);
  });
});

describe("SeriousQueuesProvider + useSeriousQueues", () => {
  function wrapper({ children }: { children: React.ReactNode }) {
    return <SeriousQueuesProvider>{children}</SeriousQueuesProvider>;
  }

  it("defaults to ranked solo + flex when localStorage is empty", () => {
    const { result } = renderHook(() => useSeriousQueues(), { wrapper });
    expect([...result.current.ids].sort()).toEqual([...DEFAULT_SERIOUS_QUEUE_IDS].sort());
  });

  it("reads persisted ids from localStorage on mount", () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([420]));
    const { result } = renderHook(() => useSeriousQueues(), { wrapper });
    expect([...result.current.ids]).toEqual([420]);
  });

  it("ignores corrupt JSON and falls back to defaults", () => {
    window.localStorage.setItem(STORAGE_KEY, "{not-json}");
    const { result } = renderHook(() => useSeriousQueues(), { wrapper });
    expect([...result.current.ids].sort()).toEqual([...DEFAULT_SERIOUS_QUEUE_IDS].sort());
  });

  it("set() filters out unknown queue ids and writes the survivors to localStorage", () => {
    const { result } = renderHook(() => useSeriousQueues(), { wrapper });
    act(() => result.current.set([420, 999, 400]));
    expect([...result.current.ids].sort()).toEqual([400, 420]);
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe(JSON.stringify([420, 400]));
  });

  it("throws when useSeriousQueues is called outside a provider", () => {
    expect(() => renderHook(() => useSeriousQueues())).toThrow(/SeriousQueuesProvider/);
  });
});
