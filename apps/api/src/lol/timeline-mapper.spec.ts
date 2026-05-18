import { describe, expect, it } from "vitest";
import type { RiotMatchTimeline, RiotTimelineEvent } from "../riot/types";
import { riotTimelineToProjection } from "./timeline-mapper";

function pf(
  participantId: number,
  overrides: Partial<{
    totalGold: number;
    level: number;
    minionsKilled: number;
    jungleMinionsKilled: number;
    position: { x: number; y: number };
  }> = {}
) {
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

function buildTimeline(overrides: {
  matchId?: string;
  participants?: string[];
  infoParticipants?: { participantId: number; puuid: string }[];
  frames?: {
    timestamp: number;
    participantFrames?: Record<string, ReturnType<typeof pf>>;
    events?: RiotTimelineEvent[];
  }[];
  frameInterval?: number;
}): RiotMatchTimeline {
  return {
    metadata: {
      matchId: overrides.matchId ?? "EUW1_42",
      participants: overrides.participants ?? ["puuid-1", "puuid-2"],
    },
    info: {
      frameInterval: overrides.frameInterval ?? 60_000,
      ...(overrides.infoParticipants !== undefined
        ? { participants: overrides.infoParticipants }
        : {}),
      frames: (overrides.frames ?? []).map((f) => ({
        timestamp: f.timestamp,
        participantFrames: f.participantFrames ?? {},
        events: f.events ?? [],
      })),
    },
  };
}

describe("riotTimelineToProjection", () => {
  it("maps CHAMPION_KILL events with assistIds default and nullable position", () => {
    const result = riotTimelineToProjection(
      buildTimeline({
        frames: [
          {
            timestamp: 60_000,
            events: [
              {
                timestamp: 30_000,
                type: "CHAMPION_KILL",
                killerId: 3,
                victimId: 7,
                assistingParticipantIds: [1, 2],
                position: { x: 5000, y: 5000 },
              },
              {
                // no position — should still be recorded with position: null
                timestamp: 45_000,
                type: "CHAMPION_KILL",
                killerId: 4,
                victimId: 8,
              },
              {
                // missing killerId — skipped entirely
                timestamp: 50_000,
                type: "CHAMPION_KILL",
                victimId: 9,
              },
            ],
          },
        ],
      })
    );
    expect(result.kills).toEqual([
      {
        ts: 30_000,
        killerId: 3,
        victimId: 7,
        assistIds: [1, 2],
        position: { x: 5000, y: 5000 },
      },
      { ts: 45_000, killerId: 4, victimId: 8, assistIds: [], position: null },
    ]);
  });

  it("groups item events into per-participant build orders", () => {
    const result = riotTimelineToProjection(
      buildTimeline({
        frames: [
          {
            timestamp: 60_000,
            events: [
              {
                timestamp: 12_000,
                type: "ITEM_PURCHASED",
                participantId: 1,
                itemId: 1055,
              },
              {
                timestamp: 13_000,
                type: "ITEM_SOLD",
                participantId: 1,
                itemId: 2003,
              },
              {
                // beforeId > 0 → recorded as UNDO with itemId=beforeId
                timestamp: 14_000,
                type: "ITEM_UNDO",
                participantId: 1,
                beforeId: 1055,
              },
              {
                // beforeId === 0 → skipped (means undo of a non-purchase)
                timestamp: 14_500,
                type: "ITEM_UNDO",
                participantId: 1,
                beforeId: 0,
              },
              {
                timestamp: 20_000,
                type: "ITEM_PURCHASED",
                participantId: 2,
                itemId: 1056,
              },
            ],
          },
        ],
      })
    );
    expect(result.buildOrders).toEqual([
      {
        participantId: 1,
        events: [
          { ts: 12_000, type: "PURCHASED", itemId: 1055 },
          { ts: 13_000, type: "SOLD", itemId: 2003 },
          { ts: 14_000, type: "UNDO", itemId: 1055 },
        ],
      },
      { participantId: 2, events: [{ ts: 20_000, type: "PURCHASED", itemId: 1056 }] },
    ]);
  });

  it("collects SKILL_LEVEL_UP but filters EVOLVE and out-of-range slots", () => {
    const result = riotTimelineToProjection(
      buildTimeline({
        frames: [
          {
            timestamp: 60_000,
            events: [
              {
                timestamp: 60_000,
                type: "SKILL_LEVEL_UP",
                participantId: 1,
                skillSlot: 1,
                levelUpType: "NORMAL",
              },
              {
                // EVOLVE — Kayn/Viktor mutation, not a real level-up
                timestamp: 120_000,
                type: "SKILL_LEVEL_UP",
                participantId: 1,
                skillSlot: 2,
                levelUpType: "EVOLVE",
              },
              {
                // slot 5 (out of range) — skipped
                timestamp: 180_000,
                type: "SKILL_LEVEL_UP",
                participantId: 1,
                skillSlot: 5,
              },
              {
                timestamp: 240_000,
                type: "SKILL_LEVEL_UP",
                participantId: 1,
                skillSlot: 4,
              },
            ],
          },
        ],
      })
    );
    expect(result.skillOrders).toEqual([
      {
        participantId: 1,
        slots: [
          { ts: 60_000, slot: 1 },
          { ts: 240_000, slot: 4 },
        ],
      },
    ]);
  });

  it("maps DRAGON_SUBTYPE_MAP entries and falls back to DRAGON_UNKNOWN", () => {
    const result = riotTimelineToProjection(
      buildTimeline({
        frames: [
          {
            timestamp: 60_000,
            events: [
              {
                timestamp: 360_000,
                type: "ELITE_MONSTER_KILL",
                killerTeamId: 100,
                monsterType: "DRAGON",
                monsterSubType: "FIRE_DRAGON",
                position: { x: 9800, y: 4400 },
              },
              {
                timestamp: 720_000,
                type: "ELITE_MONSTER_KILL",
                killerTeamId: 200,
                monsterType: "DRAGON",
                monsterSubType: "CHEMTECH_DRAGON",
              },
              {
                // unmapped subtype → DRAGON_UNKNOWN
                timestamp: 900_000,
                type: "ELITE_MONSTER_KILL",
                killerTeamId: 100,
                monsterType: "DRAGON",
                monsterSubType: "WEIRD_DRAGON",
              },
            ],
          },
        ],
      })
    );
    expect(result.objectives).toEqual([
      {
        ts: 360_000,
        type: "DRAGON_FIRE",
        teamId: 100,
        position: { x: 9800, y: 4400 },
      },
      { ts: 720_000, type: "DRAGON_CHEMTECH", teamId: 200, position: null },
      { ts: 900_000, type: "DRAGON_UNKNOWN", teamId: 100, position: null },
    ]);
  });

  it("maps BARON_NASHOR and RIFTHERALD monster types", () => {
    const result = riotTimelineToProjection(
      buildTimeline({
        frames: [
          {
            timestamp: 60_000,
            events: [
              {
                timestamp: 1_200_000,
                type: "ELITE_MONSTER_KILL",
                killerTeamId: 100,
                monsterType: "BARON_NASHOR",
              },
              {
                timestamp: 480_000,
                type: "ELITE_MONSTER_KILL",
                killerTeamId: 200,
                monsterType: "RIFTHERALD",
              },
            ],
          },
        ],
      })
    );
    expect(result.objectives.map((o) => o.type)).toEqual(["BARON_NASHOR", "RIFT_HERALD"]);
  });

  it("flips BUILDING_KILL owner team to the killer team and labels INHIBITOR vs TOWER", () => {
    const result = riotTimelineToProjection(
      buildTimeline({
        frames: [
          {
            timestamp: 60_000,
            events: [
              {
                timestamp: 900_000,
                type: "BUILDING_KILL",
                teamId: 100,
                buildingType: "TOWER_BUILDING",
                position: { x: 1000, y: 1000 },
              },
              {
                timestamp: 1_500_000,
                type: "BUILDING_KILL",
                teamId: 200,
                buildingType: "INHIBITOR_BUILDING",
              },
            ],
          },
        ],
      })
    );
    expect(result.objectives).toEqual([
      { ts: 900_000, type: "TOWER", teamId: 200, position: { x: 1000, y: 1000 } },
      { ts: 1_500_000, type: "INHIBITOR", teamId: 100, position: null },
    ]);
  });

  it("projects perParticipant frame stats with cs = minions + jungle", () => {
    const result = riotTimelineToProjection(
      buildTimeline({
        frames: [
          {
            timestamp: 600_000,
            participantFrames: {
              "1": pf(1, {
                totalGold: 5000,
                level: 7,
                minionsKilled: 60,
                jungleMinionsKilled: 5,
                position: { x: 7000, y: 7000 },
              }),
              "2": pf(2, {
                totalGold: 4800,
                level: 7,
                minionsKilled: 0,
                jungleMinionsKilled: 80,
                position: { x: 3000, y: 8000 },
              }),
            },
          },
        ],
      })
    );
    expect(result.frames).toEqual([
      {
        ts: 600_000,
        perParticipant: {
          1: { gold: 5000, level: 7, cs: 65, position: { x: 7000, y: 7000 } },
          2: { gold: 4800, level: 7, cs: 80, position: { x: 3000, y: 8000 } },
        },
      },
    ]);
  });

  it("uses info.participants when present, otherwise falls back to metadata order", () => {
    const withInfoParticipants = riotTimelineToProjection(
      buildTimeline({
        infoParticipants: [
          { participantId: 1, puuid: "p-a" },
          { participantId: 2, puuid: "p-b" },
        ],
        participants: ["IGNORED-A", "IGNORED-B"],
      })
    );
    expect(withInfoParticipants.participants).toEqual([
      { participantId: 1, puuid: "p-a" },
      { participantId: 2, puuid: "p-b" },
    ]);

    const withoutInfoParticipants = riotTimelineToProjection(
      buildTimeline({ participants: ["p-x", "p-y", "p-z"] })
    );
    expect(withoutInfoParticipants.participants).toEqual([
      { participantId: 1, puuid: "p-x" },
      { participantId: 2, puuid: "p-y" },
      { participantId: 3, puuid: "p-z" },
    ]);
  });

  it("threads matchId and frameIntervalMs from the raw timeline", () => {
    const result = riotTimelineToProjection(
      buildTimeline({ matchId: "KR_1234", frameInterval: 30_000 })
    );
    expect(result.matchId).toBe("KR_1234");
    expect(result.frameIntervalMs).toBe(30_000);
  });
});
