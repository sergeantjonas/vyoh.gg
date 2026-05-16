import { describe, expect, it } from "vitest";
import type {
  RiotMatchTimeline,
  RiotParticipantFrame,
  RiotTimelineEvent,
} from "../riot/types";
import { riotTimelineToSummaryMetrics } from "./timeline-summary-mapper";

function pf(participantId: number, overrides: Partial<RiotParticipantFrame> = {}) {
  return {
    participantId,
    totalGold: 0,
    level: 1,
    minionsKilled: 0,
    jungleMinionsKilled: 0,
    position: { x: 0, y: 0 },
    ...overrides,
  };
}

function buildTimeline(args: {
  participants?: string[];
  infoParticipants?: { participantId: number; puuid: string }[];
  frames?: {
    timestamp: number;
    participantFrames?: Record<string, RiotParticipantFrame>;
    events?: RiotTimelineEvent[];
  }[];
}): RiotMatchTimeline {
  return {
    metadata: {
      matchId: "EUW1_1",
      participants: args.participants ?? ["p-1", "p-2"],
    },
    info: {
      frameInterval: 60_000,
      participants: args.infoParticipants,
      frames: (args.frames ?? []).map((f) => ({
        timestamp: f.timestamp,
        participantFrames: f.participantFrames ?? {},
        events: f.events ?? [],
      })),
    },
  };
}

describe("riotTimelineToSummaryMetrics", () => {
  it("returns a zeroed result when the puuid isn't in the timeline", () => {
    const result = riotTimelineToSummaryMetrics(
      buildTimeline({ participants: ["other-1", "other-2"] }),
      "missing-puuid"
    );
    expect(result).toEqual({
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
    });
  });

  it("resolves participantId from info.participants when available", () => {
    // Order in info.participants intentionally differs from metadata order — if
    // metadata were used, the test would pick the wrong participantFrame.
    const result = riotTimelineToSummaryMetrics(
      buildTimeline({
        participants: ["x", "puuid-vyoh", "z"],
        infoParticipants: [
          { participantId: 1, puuid: "x" },
          { participantId: 7, puuid: "puuid-vyoh" },
          { participantId: 9, puuid: "z" },
        ],
        frames: [
          {
            timestamp: 600_000,
            participantFrames: {
              "7": pf(7, { minionsKilled: 50, jungleMinionsKilled: 10, totalGold: 5000 }),
            },
          },
        ],
      }),
      "puuid-vyoh"
    );
    expect(result.csAt10).toBe(60);
    expect(result.goldAt10).toBe(5000);
  });

  it("falls back to metadata participants order (1-indexed)", () => {
    const result = riotTimelineToSummaryMetrics(
      buildTimeline({
        participants: ["p-1", "p-2", "p-3"],
        frames: [
          {
            timestamp: 600_000,
            participantFrames: {
              "2": pf(2, { minionsKilled: 30, jungleMinionsKilled: 0, totalGold: 3000 }),
            },
          },
        ],
      }),
      "p-2"
    );
    expect(result.csAt10).toBe(30);
    expect(result.goldAt10).toBe(3000);
  });

  it("picks the first frame at or past minute 10/15 marks", () => {
    const result = riotTimelineToSummaryMetrics(
      buildTimeline({
        participants: ["me"],
        frames: [
          {
            timestamp: 540_000, // 9 min — too early for 10
            participantFrames: { "1": pf(1, { minionsKilled: 999, totalGold: 999 }) },
          },
          {
            timestamp: 600_000, // 10 min exactly
            participantFrames: {
              "1": pf(1, { minionsKilled: 70, jungleMinionsKilled: 5, totalGold: 5500 }),
            },
          },
          {
            timestamp: 900_000, // 15 min exactly
            participantFrames: {
              "1": pf(1, { minionsKilled: 110, jungleMinionsKilled: 8, totalGold: 8200 }),
            },
          },
        ],
      }),
      "me"
    );
    expect(result.csAt10).toBe(75);
    expect(result.goldAt10).toBe(5500);
    expect(result.csAt15).toBe(118);
    expect(result.goldAt15).toBe(8200);
  });

  it("returns goldAt15=0 + teamGoldDiffAt15=0 when no 15-min frame exists (remake)", () => {
    const result = riotTimelineToSummaryMetrics(
      buildTimeline({
        participants: ["me"],
        frames: [
          {
            timestamp: 600_000,
            participantFrames: { "1": pf(1, { totalGold: 4000 }) },
          },
        ],
      }),
      "me"
    );
    expect(result.goldAt15).toBe(0);
    expect(result.teamGoldDiffAt15).toBe(0);
  });

  it("computes teamGoldDiffAt15 as user-team minus enemy-team (positive = ahead)", () => {
    const frames = [
      {
        timestamp: 900_000,
        participantFrames: {
          "1": pf(1, { totalGold: 5000 }),
          "2": pf(2, { totalGold: 5000 }),
          "3": pf(3, { totalGold: 5000 }),
          "4": pf(4, { totalGold: 5000 }),
          "5": pf(5, { totalGold: 5000 }),
          "6": pf(6, { totalGold: 4000 }),
          "7": pf(7, { totalGold: 4000 }),
          "8": pf(8, { totalGold: 4000 }),
          "9": pf(9, { totalGold: 4000 }),
          "10": pf(10, { totalGold: 4000 }),
        },
      },
    ];
    const meOnBlueSide = riotTimelineToSummaryMetrics(
      buildTimeline({
        participants: ["me", "b", "c", "d", "e", "f", "g", "h", "i", "j"],
        frames,
      }),
      "me"
    );
    expect(meOnBlueSide.teamGoldDiffAt15).toBe(5000); // 25000 − 20000

    const meOnRedSide = riotTimelineToSummaryMetrics(
      buildTimeline({
        participants: ["a", "b", "c", "d", "e", "me", "g", "h", "i", "j"],
        frames,
      }),
      "me"
    );
    expect(meOnRedSide.teamGoldDiffAt15).toBe(-5000); // 20000 − 25000 from red POV
  });

  it("collects parallel kill/death timing + x/y arrays, skipping events without position", () => {
    const result = riotTimelineToSummaryMetrics(
      buildTimeline({
        participants: ["me"],
        frames: [
          {
            timestamp: 60_000,
            events: [
              {
                timestamp: 90_000,
                type: "CHAMPION_KILL",
                killerId: 1,
                victimId: 6,
                position: { x: 8000, y: 4000 },
              },
              {
                // position-less event — must be skipped so arrays stay aligned
                timestamp: 120_000,
                type: "CHAMPION_KILL",
                killerId: 1,
                victimId: 7,
              },
              {
                timestamp: 180_000,
                type: "CHAMPION_KILL",
                killerId: 8,
                victimId: 1,
                position: { x: 2000, y: 11_000 },
              },
              {
                // unrelated kill — neither side of this user
                timestamp: 240_000,
                type: "CHAMPION_KILL",
                killerId: 4,
                victimId: 9,
                position: { x: 1, y: 1 },
              },
            ],
          },
        ],
      }),
      "me"
    );
    expect(result.killTimings).toEqual([90]);
    expect(result.killXs).toEqual([8000]);
    expect(result.killYs).toEqual([4000]);
    expect(result.deathTimings).toEqual([180]);
    expect(result.deathXs).toEqual([2000]);
    expect(result.deathYs).toEqual([11_000]);
  });
});
