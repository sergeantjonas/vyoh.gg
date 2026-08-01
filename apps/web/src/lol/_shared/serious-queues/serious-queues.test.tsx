import { act, renderHook } from "@testing-library/react";
import { type MatchSummary, queueLabel } from "@vyoh/shared";
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

function summary(queueId: number, idx = 0): MatchSummary {
  return {
    matchId: `M_${idx}`,
    queueId,
    queueType: queueLabel(queueId),
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
    teamGoldDiffSeries: [],
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
  it("keeps only matches whose queue id is selected", () => {
    const matches = [summary(420, 0), summary(440, 1), summary(450, 2), summary(400, 3)];
    const ids = new Set([420, 440]);
    const filtered = filterToSerious(matches, ids);
    expect(filtered.map((m) => m.queueId)).toEqual([420, 440]);
  });

  it("returns an empty list when no ids match", () => {
    const matches = [summary(450, 0)];
    expect(filterToSerious(matches, new Set([420]))).toEqual([]);
  });

  // This used to intersect the selected ids' labels against `m.queueType`, so
  // every statistic in the app depended on two independently-written label
  // spellings agreeing. A canonical rename would have emptied the intersection
  // and silently dropped that queue from every analysis surface, with nothing
  // throwing. Feeding a label that matches nothing proves the label is no
  // longer part of the decision.
  it("ignores queueType entirely", () => {
    const stale = { ...summary(420, 0), queueType: "Whatever The Map Used To Say" };
    expect(filterToSerious([stale], new Set([420]))).toHaveLength(1);
  });

  // Customs (0, 3100, 3130) and every non-configurable queue are excluded by
  // construction: the allowlist can only ever contain 420/440/400, so a new
  // Riot queue can never leak into statistics by default.
  it("excludes custom and unmapped queues no matter what is selected", () => {
    const matches = [summary(0, 0), summary(3100, 1), summary(3130, 2)];
    const everything = new Set([420, 440, 400, 0, 3100, 3130]);
    expect(filterToSerious(matches, new Set([420, 440, 400]))).toEqual([]);
    // Even a hand-forced set only passes what it literally names — there is no
    // wildcard, which is what makes the allowlist the safe default.
    expect(filterToSerious(matches, everything)).toHaveLength(3);
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
