import type { MatchSummary, ParsedMatchQuery } from "@vyoh/shared";
import { describe, expect, it } from "vitest";
import { matchesQuery } from "./command-palette-matcher";

function buildMatch(overrides: Partial<MatchSummary>): MatchSummary {
  return {
    matchId: overrides.matchId ?? "M_1",
    queueType: overrides.queueType ?? "Ranked Solo",
    champion: overrides.champion ?? "Ahri",
    kills: overrides.kills ?? 5,
    deaths: overrides.deaths ?? 3,
    assists: overrides.assists ?? 7,
    win: overrides.win ?? true,
    durationSec: overrides.durationSec ?? 1800,
    playedAt: overrides.playedAt ?? "2026-05-19T12:00:00.000Z",
    remake: overrides.remake ?? false,
    teamPosition: overrides.teamPosition ?? "MIDDLE",
    gameVersion: overrides.gameVersion ?? "16.9.1.1",
    visionScore: overrides.visionScore ?? 0,
    damageShare: overrides.damageShare ?? 0,
    firstBloodKill: overrides.firstBloodKill ?? false,
    csAt10: overrides.csAt10 ?? 0,
    csAt15: overrides.csAt15 ?? 0,
    goldAt10: overrides.goldAt10 ?? 0,
    goldAt15: overrides.goldAt15 ?? 0,
    teamGoldDiffAt15: overrides.teamGoldDiffAt15 ?? 0,
    deathTimings: overrides.deathTimings ?? [],
    deathXs: overrides.deathXs ?? [],
    deathYs: overrides.deathYs ?? [],
    killTimings: overrides.killTimings ?? [],
    killXs: overrides.killXs ?? [],
    killYs: overrides.killYs ?? [],
    laneOpponent: overrides.laneOpponent ?? null,
    ...overrides,
  };
}

const EMPTY: ParsedMatchQuery = {
  withChampions: [],
  vsChampions: [],
  outcome: null,
  queues: [],
  roles: [],
  patches: [],
  duos: [],
  since: null,
  until: null,
  kdaGt: null,
  kdaLt: null,
  freeText: "",
};

function query(overrides: Partial<ParsedMatchQuery>): ParsedMatchQuery {
  return { ...EMPTY, ...overrides };
}

describe("matchesQuery", () => {
  it("matches any match against an empty query", () => {
    expect(matchesQuery(buildMatch({}), EMPTY)).toBe(true);
  });

  it("filters by outcome (win)", () => {
    expect(matchesQuery(buildMatch({ win: true }), query({ outcome: "win" }))).toBe(true);
    expect(matchesQuery(buildMatch({ win: false }), query({ outcome: "win" }))).toBe(
      false
    );
  });

  it("filters by outcome (loss)", () => {
    expect(matchesQuery(buildMatch({ win: false }), query({ outcome: "loss" }))).toBe(
      true
    );
    expect(matchesQuery(buildMatch({ win: true }), query({ outcome: "loss" }))).toBe(
      false
    );
  });

  it("requires every withChampion substring to appear in the alias (case-insensitive)", () => {
    const m = buildMatch({ champion: "Ahri" });
    expect(matchesQuery(m, query({ withChampions: ["ahr"] }))).toBe(true);
    expect(matchesQuery(m, query({ withChampions: ["ahr", "yas"] }))).toBe(false);
  });

  it("requires every vsChampion substring to appear in the lane opponent's championName", () => {
    const m = buildMatch({
      laneOpponent: {
        puuid: "p",
        championName: "Yasuo",
        gameName: "Foe",
        tagLine: "EUW",
      },
    });
    expect(matchesQuery(m, query({ vsChampions: ["yas"] }))).toBe(true);
    expect(matchesQuery(m, query({ vsChampions: ["zed"] }))).toBe(false);
  });

  it("vsChampions filter excludes matches with no lane opponent", () => {
    const m = buildMatch({ laneOpponent: null });
    expect(matchesQuery(m, query({ vsChampions: ["yas"] }))).toBe(false);
  });

  it("filters by queue type (substring, case-insensitive)", () => {
    const m = buildMatch({ queueType: "Ranked Solo" });
    expect(matchesQuery(m, query({ queues: ["ranked"] }))).toBe(true);
    expect(matchesQuery(m, query({ queues: ["aram"] }))).toBe(false);
  });

  it("filters by role (substring, case-insensitive on teamPosition)", () => {
    const m = buildMatch({ teamPosition: "MIDDLE" });
    expect(matchesQuery(m, query({ roles: ["mid"] }))).toBe(true);
    expect(matchesQuery(m, query({ roles: ["top"] }))).toBe(false);
  });

  it("filters by truncated (year-shaped) patch label", () => {
    // gameVersion "16.9.1.1" truncates to "26.9".
    const m = buildMatch({ gameVersion: "16.9.1.1" });
    expect(matchesQuery(m, query({ patches: ["26.9"] }))).toBe(true);
    expect(matchesQuery(m, query({ patches: ["26.8"] }))).toBe(false);
  });

  it("filters by since (inclusive) and until (exclusive)", () => {
    const m = buildMatch({ playedAt: "2026-05-19T12:00:00.000Z" });
    expect(matchesQuery(m, query({ since: new Date("2026-05-19T11:00:00.000Z") }))).toBe(
      true
    );
    expect(matchesQuery(m, query({ since: new Date("2026-05-19T13:00:00.000Z") }))).toBe(
      false
    );
    expect(matchesQuery(m, query({ until: new Date("2026-05-19T13:00:00.000Z") }))).toBe(
      true
    );
    // until is exclusive: exactly equal to playedAt is excluded.
    expect(matchesQuery(m, query({ until: new Date("2026-05-19T12:00:00.000Z") }))).toBe(
      false
    );
  });

  it("filters by KDA strict greater-than", () => {
    // kda = (kills + assists) / max(1, deaths) = (5 + 7) / 3 = 4
    const m = buildMatch({ kills: 5, assists: 7, deaths: 3 });
    expect(matchesQuery(m, query({ kdaGt: 3.9 }))).toBe(true);
    expect(matchesQuery(m, query({ kdaGt: 4 }))).toBe(false); // strict, not >=
  });

  it("filters by KDA strict less-than", () => {
    const m = buildMatch({ kills: 5, assists: 7, deaths: 3 }); // 4
    expect(matchesQuery(m, query({ kdaLt: 4.1 }))).toBe(true);
    expect(matchesQuery(m, query({ kdaLt: 4 }))).toBe(false);
  });

  it("treats 0 deaths as 1 for KDA (no infinity)", () => {
    const m = buildMatch({ kills: 5, assists: 7, deaths: 0 }); // (5+7)/1 = 12
    expect(matchesQuery(m, query({ kdaGt: 11 }))).toBe(true);
    expect(matchesQuery(m, query({ kdaLt: 13 }))).toBe(true);
  });

  it("filters by free-text against champion + queue + role + opponent + matchId", () => {
    const m = buildMatch({
      matchId: "EUW1_123",
      champion: "Ahri",
      queueType: "ARAM",
      teamPosition: "MIDDLE",
      laneOpponent: {
        puuid: "p",
        championName: "Yasuo",
        gameName: "Foe",
        tagLine: "EUW",
      },
    });
    expect(matchesQuery(m, query({ freeText: "ahri" }))).toBe(true);
    expect(matchesQuery(m, query({ freeText: "yasuo" }))).toBe(true);
    expect(matchesQuery(m, query({ freeText: "euw1" }))).toBe(true);
    expect(matchesQuery(m, query({ freeText: "garen" }))).toBe(false);
  });
});
