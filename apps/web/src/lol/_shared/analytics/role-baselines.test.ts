import type { MatchSummary } from "@vyoh/shared";
import { describe, expect, it } from "vitest";
import { aggregateByRole, isRole, primaryRole } from "./role-baselines";

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
    teamPosition: overrides.teamPosition ?? "",
    gameVersion: overrides.gameVersion ?? "",
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

describe("isRole", () => {
  it("accepts the five Rift roles", () => {
    for (const role of ["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"]) {
      expect(isRole(role)).toBe(true);
    }
  });

  it("rejects empty string, lowercase, and unknown role names", () => {
    expect(isRole("")).toBe(false);
    expect(isRole("top")).toBe(false);
    expect(isRole("SUPPORT")).toBe(false);
    expect(isRole("MID")).toBe(false);
  });
});

describe("aggregateByRole", () => {
  it("buckets matches by teamPosition", () => {
    const map = aggregateByRole(
      [
        buildMatch({ matchId: "1", teamPosition: "TOP", kills: 1 }),
        buildMatch({ matchId: "2", teamPosition: "MIDDLE", kills: 2 }),
        buildMatch({ matchId: "3", teamPosition: "MIDDLE", kills: 3 }),
      ],
      (m) => m.kills
    );
    expect(map.get("TOP")).toEqual([1]);
    expect(map.get("MIDDLE")).toEqual([2, 3]);
  });

  it("drops remakes and non-positional matches (empty or non-Rift teamPosition)", () => {
    const map = aggregateByRole(
      [
        buildMatch({ matchId: "remake", teamPosition: "TOP", remake: true }),
        buildMatch({ matchId: "aram", teamPosition: "" }),
        buildMatch({ matchId: "arena", teamPosition: "INVALID" }),
        buildMatch({ matchId: "ok", teamPosition: "TOP" }),
      ],
      (m) => m.matchId
    );
    expect(map.size).toBe(1);
    expect(map.get("TOP")).toEqual(["ok"]);
  });
});

describe("primaryRole", () => {
  it("returns the most-played role", () => {
    const role = primaryRole([
      buildMatch({ teamPosition: "TOP" }),
      buildMatch({ teamPosition: "MIDDLE" }),
      buildMatch({ teamPosition: "MIDDLE" }),
    ]);
    expect(role).toBe("MIDDLE");
  });

  it("returns null when no match has a valid role", () => {
    const role = primaryRole([
      buildMatch({ teamPosition: "" }),
      buildMatch({ teamPosition: "INVALID" }),
    ]);
    expect(role).toBeNull();
  });
});
