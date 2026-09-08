import { describe, expect, it } from "vitest";
import { type ScoreParticipant, gradeOf, scoreOfGame } from "./score-of-game.ts";

function player(
  puuid: string,
  overrides: Partial<ScoreParticipant> = {}
): ScoreParticipant {
  return {
    puuid,
    kills: 5,
    deaths: 4,
    assists: 8,
    totalDamage: 20000,
    visionScore: 25,
    kp: 0.5,
    csTotal: 200,
    ...overrides,
  };
}

describe("scoreOfGame", () => {
  it("grades the player who leads every metric S+ at rank 1 and the trailer D", () => {
    const grades = scoreOfGame([
      player("top", {
        kills: 12,
        deaths: 1,
        assists: 10,
        totalDamage: 40000,
        visionScore: 60,
        kp: 0.9,
        csTotal: 300,
      }),
      player("mid"),
      player("low", {
        kills: 1,
        deaths: 9,
        assists: 2,
        totalDamage: 8000,
        visionScore: 10,
        kp: 0.2,
        csTotal: 100,
      }),
    ]);
    expect(grades.get("top")).toEqual({ score: 1, grade: "S+", rank: 1, outOf: 3 });
    expect(grades.get("low")).toEqual({ score: 0, grade: "D", rank: 3, outOf: 3 });
    expect(grades.get("mid")?.rank).toBe(2);
  });

  it("puts identical players on the same half-credit percentile and shared rank", () => {
    const grades = scoreOfGame([player("a"), player("b"), player("c")]);
    for (const id of ["a", "b", "c"]) {
      expect(grades.get(id)).toEqual({ score: 0.5, grade: "B", rank: 1, outOf: 3 });
    }
  });

  it("treats fewer deaths as better", () => {
    const grades = scoreOfGame([
      player("safe", { deaths: 0 }),
      player("feeder", { deaths: 8 }),
    ]);
    expect(grades.get("safe")?.score ?? 0).toBeGreaterThan(
      grades.get("feeder")?.score ?? 1
    );
  });

  it("returns no grades for a game with fewer than two participants", () => {
    expect(scoreOfGame([player("solo")]).size).toBe(0);
    expect(scoreOfGame([]).size).toBe(0);
  });
});

describe("gradeOf", () => {
  it("maps the floors inclusively", () => {
    expect(gradeOf(1)).toBe("S+");
    expect(gradeOf(0.85)).toBe("S+");
    expect(gradeOf(0.849)).toBe("S");
    expect(gradeOf(0.72)).toBe("S");
    expect(gradeOf(0.58)).toBe("A");
    expect(gradeOf(0.42)).toBe("B");
    expect(gradeOf(0.28)).toBe("C");
    expect(gradeOf(0.279)).toBe("D");
    expect(gradeOf(0)).toBe("D");
  });
});
