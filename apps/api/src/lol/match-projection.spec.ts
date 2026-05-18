import { describe, expect, it } from "vitest";
import type { RiotMatch, RiotMatchParticipant } from "../riot/types";
import { projectMatchForStorage } from "./match-projection";

function buildParticipant(
  overrides: Partial<RiotMatchParticipant>
): RiotMatchParticipant {
  return {
    puuid: "puuid-default",
    riotIdGameName: "Player",
    riotIdTagline: "EUW",
    championName: "Ahri",
    teamId: 100,
    teamPosition: "MIDDLE",
    kills: 5,
    deaths: 3,
    assists: 8,
    win: true,
    item0: 3157,
    item1: 0,
    item2: 0,
    item3: 0,
    item4: 0,
    item5: 0,
    item6: 0,
    goldEarned: 12000,
    totalDamageDealtToChampions: 22000,
    physicalDamageDealtToChampions: 5000,
    magicDamageDealtToChampions: 14000,
    trueDamageDealtToChampions: 3000,
    totalMinionsKilled: 180,
    neutralMinionsKilled: 20,
    visionScore: 30,
    wardsPlaced: 10,
    wardsKilled: 4,
    detectorWardsPlaced: 3,
    firstBloodKill: false,
    gameEndedInEarlySurrender: false,
    summoner1Id: 4,
    summoner2Id: 14,
    champLevel: 18,
    perks: {
      styles: [
        {
          selections: [{ perk: 8214 }, { perk: 8226 }, { perk: 8210 }],
        },
        {
          selections: [{ perk: 8345 }],
        },
      ],
    },
    ...overrides,
  };
}

const baseTeam = {
  teamId: 100,
  win: true,
  objectives: {
    baron: { first: false, kills: 0 },
    champion: { first: true, kills: 8 },
    dragon: { first: true, kills: 2 },
    inhibitor: { first: false, kills: 0 },
    riftHerald: { first: true, kills: 1 },
    tower: { first: true, kills: 5 },
  },
};

function buildMatch(overrides: Partial<RiotMatch["info"]> = {}): RiotMatch {
  return {
    metadata: {
      matchId: "EUW1_42",
      participants: ["puuid-owner", "puuid-other"],
    },
    info: {
      gameStartTimestamp: 1_700_000_000_000,
      gameDuration: 1834,
      gameVersion: "16.9.1.1",
      queueId: 420,
      teams: [baseTeam, { ...baseTeam, teamId: 200, win: false }],
      participants: [
        buildParticipant({ puuid: "puuid-owner" }),
        buildParticipant({ puuid: "puuid-other", championName: "Lux" }),
      ],
      ...overrides,
    },
  };
}

describe("projectMatchForStorage", () => {
  it("preserves metadata and non-participant info verbatim", () => {
    const raw = buildMatch();
    const stored = projectMatchForStorage(raw, new Set(["puuid-owner"]));
    expect(stored.metadata).toEqual(raw.metadata);
    expect(stored.info.gameStartTimestamp).toBe(raw.info.gameStartTimestamp);
    expect(stored.info.gameDuration).toBe(raw.info.gameDuration);
    expect(stored.info.gameVersion).toBe(raw.info.gameVersion);
    expect(stored.info.queueId).toBe(raw.info.queueId);
    expect(stored.info.teams).toEqual(raw.info.teams);
  });

  it("keeps the full RiotMatchParticipant shape for owner puuids and tags isOwner: true", () => {
    const raw = buildMatch();
    const stored = projectMatchForStorage(raw, new Set(["puuid-owner"]));
    const owner = stored.info.participants.find((p) => p.puuid === "puuid-owner");
    expect(owner?.isOwner).toBe(true);
    // Full perks tree, including secondary style and all selections, survives intact.
    if (owner?.isOwner) {
      expect(owner.perks.styles).toHaveLength(2);
      expect(owner.perks.styles[0]?.selections).toHaveLength(3);
      expect(owner.firstBloodKill).toBe(false);
      expect(owner.gameEndedInEarlySurrender).toBe(false);
    }
  });

  it("strips perks to only the keystone for non-owner participants", () => {
    const raw = buildMatch();
    const stored = projectMatchForStorage(raw, new Set(["puuid-owner"]));
    const other = stored.info.participants.find((p) => p.puuid === "puuid-other");
    expect(other?.isOwner).toBe(false);
    expect(other?.perks.styles).toHaveLength(1);
    expect(other?.perks.styles[0]?.selections).toEqual([{ perk: 8214 }]);
  });

  it("omits firstBloodKill and gameEndedInEarlySurrender from non-owner shape", () => {
    const raw = buildMatch();
    const stored = projectMatchForStorage(raw, new Set(["puuid-owner"]));
    const other = stored.info.participants.find((p) => p.puuid === "puuid-other");
    expect(other && "firstBloodKill" in other).toBe(false);
    expect(other && "gameEndedInEarlySurrender" in other).toBe(false);
  });

  it("preserves killParticipation when challenges are present", () => {
    const raw = buildMatch({
      participants: [
        buildParticipant({ puuid: "puuid-owner" }),
        buildParticipant({
          puuid: "puuid-other",
          challenges: { killParticipation: 0.5 },
        }),
      ],
    });
    const stored = projectMatchForStorage(raw, new Set(["puuid-owner"]));
    const other = stored.info.participants.find((p) => p.puuid === "puuid-other");
    expect(other?.isOwner).toBe(false);
    if (other?.isOwner === false) {
      expect(other.challenges).toEqual({ killParticipation: 0.5 });
    }
  });

  it("drops challenges entirely when the source has no challenges field", () => {
    // Default buildParticipant has no challenges set.
    const raw = buildMatch();
    const stored = projectMatchForStorage(raw, new Set(["puuid-owner"]));
    const other = stored.info.participants.find((p) => p.puuid === "puuid-other");
    expect(other && "challenges" in other).toBe(false);
  });

  it("emits an empty challenges object when challenges exists but killParticipation is undefined", () => {
    const raw = buildMatch({
      participants: [
        buildParticipant({ puuid: "puuid-owner" }),
        buildParticipant({ puuid: "puuid-other", challenges: {} }),
      ],
    });
    const stored = projectMatchForStorage(raw, new Set(["puuid-owner"]));
    const other = stored.info.participants.find((p) => p.puuid === "puuid-other");
    if (other?.isOwner === false) {
      expect(other.challenges).toEqual({});
    }
  });

  it("returns empty styles when the source participant has no perks tree", () => {
    const raw = buildMatch({
      participants: [
        buildParticipant({ puuid: "puuid-owner" }),
        buildParticipant({
          puuid: "puuid-other",
          perks: { styles: [] },
        }),
      ],
    });
    const stored = projectMatchForStorage(raw, new Set(["puuid-owner"]));
    const other = stored.info.participants.find((p) => p.puuid === "puuid-other");
    expect(other?.perks.styles).toEqual([]);
  });

  it("returns a single style with empty selections when the keystone is missing", () => {
    const raw = buildMatch({
      participants: [
        buildParticipant({ puuid: "puuid-owner" }),
        buildParticipant({
          puuid: "puuid-other",
          perks: { styles: [{ selections: [] }] },
        }),
      ],
    });
    const stored = projectMatchForStorage(raw, new Set(["puuid-owner"]));
    const other = stored.info.participants.find((p) => p.puuid === "puuid-other");
    expect(other?.perks.styles).toEqual([{ selections: [] }]);
  });

  it("supports multi-owner matches (e.g. duo on the same account list)", () => {
    const raw = buildMatch();
    const stored = projectMatchForStorage(raw, new Set(["puuid-owner", "puuid-other"]));
    for (const p of stored.info.participants) {
      expect(p.isOwner).toBe(true);
    }
  });
});
