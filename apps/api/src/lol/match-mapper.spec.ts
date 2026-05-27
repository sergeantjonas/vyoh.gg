import { assert, describe, expect, it } from "vitest";
import type {
  RiotMatch,
  RiotMatchParticipant,
  RiotMatchParticipantOther,
  RiotMatchParticipantOwner,
  StoredMatch,
} from "../riot/types";
import { riotMatchToDetail, riotMatchToSummary } from "./match-mapper";

function buildParticipant(
  overrides: Partial<RiotMatchParticipant>
): RiotMatchParticipant {
  return {
    puuid: "puuid-vyoh",
    riotIdGameName: "Vyoh",
    riotIdTagline: "Ahri",
    championName: "Ahri",
    teamId: 100,
    teamPosition: "MIDDLE",
    kills: 8,
    deaths: 3,
    assists: 12,
    win: true,
    item0: 0,
    item1: 0,
    item2: 0,
    item3: 0,
    item4: 0,
    item5: 0,
    item6: 0,
    goldEarned: 12000,
    totalDamageDealtToChampions: 25000,
    physicalDamageDealtToChampions: 15000,
    magicDamageDealtToChampions: 8000,
    trueDamageDealtToChampions: 2000,
    totalMinionsKilled: 180,
    neutralMinionsKilled: 20,
    visionScore: 30,
    wardsPlaced: 10,
    wardsKilled: 5,
    detectorWardsPlaced: 3,
    firstBloodKill: false,
    gameEndedInEarlySurrender: false,
    summoner1Id: 4,
    summoner2Id: 14,
    champLevel: 18,
    spell1Casts: 0,
    spell2Casts: 0,
    spell3Casts: 0,
    spell4Casts: 0,
    summoner1Casts: 0,
    summoner2Casts: 0,
    doubleKills: 0,
    tripleKills: 0,
    quadraKills: 0,
    pentaKills: 0,
    killingSprees: 0,
    largestKillingSpree: 0,
    totalDamageTaken: 0,
    damageSelfMitigated: 0,
    totalHeal: 0,
    totalTimeCCDealt: 0,
    totalTimeSpentDead: 0,
    longestTimeSpentLiving: 0,
    perks: { styles: [{ selections: [{ perk: 8214 }] }] },
    ...overrides,
  };
}

function buildOwner(
  overrides: Partial<RiotMatchParticipant> = {}
): RiotMatchParticipantOwner {
  return { ...buildParticipant(overrides), isOwner: true as const };
}

function buildOther(
  overrides: Partial<RiotMatchParticipantOther> = {}
): RiotMatchParticipantOther {
  return {
    isOwner: false,
    puuid: "puuid-other",
    riotIdGameName: "Other",
    riotIdTagline: "EUW",
    championName: "Lux",
    teamId: 200,
    teamPosition: "BOTTOM",
    kills: 4,
    deaths: 6,
    assists: 9,
    win: false,
    item0: 0,
    item1: 0,
    item2: 0,
    item3: 0,
    item4: 0,
    item5: 0,
    item6: 0,
    goldEarned: 9000,
    totalDamageDealtToChampions: 18000,
    physicalDamageDealtToChampions: 4000,
    magicDamageDealtToChampions: 12000,
    trueDamageDealtToChampions: 2000,
    totalMinionsKilled: 140,
    neutralMinionsKilled: 0,
    visionScore: 18,
    wardsPlaced: 6,
    wardsKilled: 2,
    detectorWardsPlaced: 1,
    summoner1Id: 4,
    summoner2Id: 7,
    champLevel: 15,
    perks: { styles: [{ selections: [{ perk: 8229 }] }] },
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

const baseMatch: RiotMatch = {
  metadata: {
    matchId: "EUW1_42",
    participants: ["puuid-vyoh", "puuid-other"],
  },
  info: {
    gameStartTimestamp: 1_700_000_000_000,
    gameDuration: 1834,
    gameVersion: "14.20.586.5840",
    queueId: 420,
    teams: [baseTeam, { ...baseTeam, teamId: 200, win: false }],
    participants: [
      buildParticipant({ puuid: "puuid-vyoh" }),
      buildParticipant({
        puuid: "puuid-other",
        championName: "Lux",
        teamId: 200,
        teamPosition: "BOTTOM",
        kills: 4,
        deaths: 6,
        assists: 9,
        win: false,
      }),
    ],
  },
};

describe("riotMatchToSummary", () => {
  it("extracts the requested participant's stats", () => {
    const summary = riotMatchToSummary(baseMatch, "puuid-vyoh");
    expect(summary).toEqual({
      matchId: "EUW1_42",
      queueType: "Ranked Solo",
      champion: "Ahri",
      kills: 8,
      deaths: 3,
      assists: 12,
      win: true,
      durationSec: 1834,
      playedAt: "2023-11-14T22:13:20.000Z",
      remake: false,
      teamPosition: "MIDDLE",
      gameVersion: "14.20.586.5840",
      visionScore: 30,
      damageShare: 1,
      firstBloodKill: false,
      csAt10: 0,
      hasTimeline: false,
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
    });
  });

  it("seeds csAt10 from challenges.laneMinionsFirst10Minutes when present (PN3)", () => {
    const matchWithChallenges: RiotMatch = {
      ...baseMatch,
      info: {
        ...baseMatch.info,
        participants: baseMatch.info.participants.map((p) =>
          p.puuid === "puuid-vyoh"
            ? { ...p, challenges: { laneMinionsFirst10Minutes: 74 } }
            : p
        ),
      },
    };
    const summary = riotMatchToSummary(matchWithChallenges, "puuid-vyoh");
    expect(summary.csAt10).toBe(74);
    // The flag stays false because no timeline overlay has run — only the
    // overlay site in lol.service flips it.
    expect(summary.hasTimeline).toBe(false);
  });

  it("populates laneOpponent when a matching position exists on the enemy team", () => {
    const matchWithOpponent: RiotMatch = {
      ...baseMatch,
      info: {
        ...baseMatch.info,
        participants: [
          buildParticipant({ puuid: "puuid-vyoh", teamPosition: "MIDDLE" }),
          buildParticipant({
            puuid: "puuid-enemy-mid",
            riotIdGameName: "Faker",
            riotIdTagline: "KR1",
            championName: "Syndra",
            teamId: 200,
            teamPosition: "MIDDLE",
          }),
        ],
      },
    };
    const summary = riotMatchToSummary(matchWithOpponent, "puuid-vyoh");
    expect(summary.laneOpponent).toEqual({
      puuid: "puuid-enemy-mid",
      championName: "Syndra",
      gameName: "Faker",
      tagLine: "KR1",
    });
  });

  it("falls back to 'Queue N' for unmapped queue ids", () => {
    const summary = riotMatchToSummary(
      { ...baseMatch, info: { ...baseMatch.info, queueId: 9999 } },
      "puuid-vyoh"
    );
    expect(summary.queueType).toBe("Queue 9999");
  });

  it("flags remake when participant.gameEndedInEarlySurrender and duration < 210s", () => {
    const remakeMatch: RiotMatch = {
      ...baseMatch,
      info: {
        ...baseMatch.info,
        gameDuration: 180,
        participants: [
          buildParticipant({ puuid: "puuid-vyoh", gameEndedInEarlySurrender: true }),
        ],
      },
    };
    const summary = riotMatchToSummary(remakeMatch, "puuid-vyoh");
    expect(summary.remake).toBe(true);
  });

  it("does not flag remake when duration >= 210s even if early-surrender flag set", () => {
    const surrenderMatch: RiotMatch = {
      ...baseMatch,
      info: {
        ...baseMatch.info,
        gameDuration: 900,
        participants: [
          buildParticipant({ puuid: "puuid-vyoh", gameEndedInEarlySurrender: true }),
        ],
      },
    };
    const summary = riotMatchToSummary(surrenderMatch, "puuid-vyoh");
    expect(summary.remake).toBe(false);
  });

  // Exact-boundary case for the load-bearing 210s threshold called out in
  // CLAUDE.md. The predicate is `< 210` (strict), so 210s with the early-
  // surrender flag is a Season 2 2026 inting-surrender, not a remake.
  it("does not flag remake at exactly the 210s boundary (Season 2 inting-surrender)", () => {
    const boundaryMatch: RiotMatch = {
      ...baseMatch,
      info: {
        ...baseMatch.info,
        gameDuration: 210,
        participants: [
          buildParticipant({ puuid: "puuid-vyoh", gameEndedInEarlySurrender: true }),
        ],
      },
    };
    const summary = riotMatchToSummary(boundaryMatch, "puuid-vyoh");
    expect(summary.remake).toBe(false);
  });

  it("throws when the puuid is not in the participants", () => {
    expect(() => riotMatchToSummary(baseMatch, "puuid-not-in-match")).toThrow(
      /puuid-not-in-match/
    );
  });
});

describe("riotMatchToDetail", () => {
  it("returns the full participant list with mapped fields", () => {
    const detail = riotMatchToDetail({
      ...baseMatch,
      info: {
        ...baseMatch.info,
        teams: [baseTeam],
        participants: [
          buildParticipant({
            puuid: "p1",
            championName: "Ahri",
            item0: 100,
            item1: 200,
            item2: 300,
            item3: 0,
            item4: 0,
            item5: 0,
            item6: 0,
          }),
        ],
      },
    });

    expect(detail.matchId).toBe("EUW1_42");
    expect(detail.participants).toHaveLength(1);
    expect(detail.participants[0]?.items).toEqual([100, 200, 300, 0, 0, 0, 0]);
    expect(detail.participants[0]?.championName).toBe("Ahri");
    expect(detail.participants[0]?.teamId).toBe(100);
  });

  it("projects CS, vision, keystone, and champion level", () => {
    const detail = riotMatchToDetail(baseMatch);
    const p = detail.participants[0];
    assert(p !== undefined);
    expect(p.csTotal).toBe(200);
    expect(p.csPerMin).toBeCloseTo(200 / (1834 / 60), 1);
    expect(p.visionScore).toBe(30);
    expect(p.keystone).toBe(8214);
    expect(p.championLevel).toBe(18);
  });

  it("computes damage and gold share relative to team totals", () => {
    const detail = riotMatchToDetail(baseMatch);
    const vyoh = detail.participants.find((p) => p.puuid === "puuid-vyoh");
    const other = detail.participants.find((p) => p.puuid === "puuid-other");
    assert(vyoh !== undefined && other !== undefined);
    // vyoh is the only member of team 100, so damageShare should be 1
    expect(vyoh.damageShare).toBeCloseTo(1);
    // other is the only member of team 200, so damageShare should also be 1
    expect(other.damageShare).toBeCloseTo(1);
  });

  it("projects the teams block with objectives", () => {
    const detail = riotMatchToDetail(baseMatch);
    expect(detail.teams).toHaveLength(2);
    expect(detail.teams[0]?.teamId).toBe(100);
    expect(detail.teams[0]?.objectives.tower.first).toBe(true);
  });

  it("does not populate owner extras when input is raw RiotMatch (no isOwner discriminator)", () => {
    const detail = riotMatchToDetail(baseMatch);
    for (const p of detail.participants) {
      expect(p.owner).toBeUndefined();
    }
  });

  it("populates owner extras for stored owner participants only", () => {
    const stored: StoredMatch = {
      ...baseMatch,
      info: {
        ...baseMatch.info,
        teams: [baseTeam, { ...baseTeam, teamId: 200, win: false }],
        participants: [
          buildOwner({
            puuid: "puuid-vyoh",
            spell1Casts: 320,
            spell2Casts: 87,
            spell3Casts: 124,
            spell4Casts: 12,
            summoner1Casts: 2,
            summoner2Casts: 3,
            doubleKills: 2,
            tripleKills: 1,
            quadraKills: 0,
            pentaKills: 0,
            killingSprees: 3,
            largestKillingSpree: 5,
            totalDamageTaken: 18000,
            damageSelfMitigated: 9000,
            totalHeal: 1500,
            totalTimeCCDealt: 87,
            totalTimeSpentDead: 260,
            longestTimeSpentLiving: 1320,
            challenges: {
              killParticipation: 0.74,
              soloKills: 4,
              timeCCingOthers: 147,
              skillshotsHit: 22,
            },
          }),
          buildOther({ puuid: "puuid-other" }),
        ],
      },
    };

    const detail = riotMatchToDetail(stored);
    const vyoh = detail.participants.find((p) => p.puuid === "puuid-vyoh");
    const other = detail.participants.find((p) => p.puuid === "puuid-other");
    assert(vyoh !== undefined && other !== undefined);

    expect(other.owner).toBeUndefined();
    assert(vyoh.owner !== undefined);

    expect(vyoh.owner.spellCasts).toEqual({
      q: 320,
      w: 87,
      e: 124,
      r: 12,
      summoner1: 2,
      summoner2: 3,
    });
    expect(vyoh.owner.multikills).toEqual({
      double: 2,
      triple: 1,
      quadra: 0,
      penta: 0,
      killingSprees: 3,
      largestKillingSpree: 5,
    });
    expect(vyoh.owner.survival).toEqual({
      totalDamageTaken: 18000,
      damageSelfMitigated: 9000,
      totalHeal: 1500,
      totalTimeCCDealt: 87,
      totalTimeSpentDead: 260,
      longestTimeSpentLiving: 1320,
    });
    expect(vyoh.owner.challenges).toEqual({
      soloKills: 4,
      timeCCingOthers: 147,
      skillshotsHit: 22,
    });
  });

  it("tolerates a stored owner with no challenges block (empty challenges sub-object)", () => {
    const stored: StoredMatch = {
      ...baseMatch,
      info: {
        ...baseMatch.info,
        teams: [baseTeam],
        participants: [buildOwner({ puuid: "puuid-vyoh" })],
      },
    };

    const detail = riotMatchToDetail(stored);
    const vyoh = detail.participants[0];
    assert(vyoh !== undefined && vyoh.owner !== undefined);
    expect(vyoh.owner.challenges).toEqual({});
    expect(vyoh.owner.spellCasts).toBeDefined();
  });
});
