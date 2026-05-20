import type { MatchSummary } from "@vyoh/shared";
import { describe, expect, it } from "vitest";
import { buildComposite } from "./pregame-composite";
import {
  MIN_CALIBRATION_SAMPLE,
  calibrateConfidence,
  computeCalibration,
  replayHistory,
} from "./pregame-replay";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

function fakeMatch(overrides: Partial<MatchSummary> = {}): MatchSummary {
  return {
    matchId: `M${Math.random()}`,
    queueType: "Ranked Solo",
    champion: "Ahri",
    kills: 5,
    deaths: 4,
    assists: 8,
    win: true,
    durationSec: 1800,
    playedAt: new Date(Date.now() - DAY_MS).toISOString(),
    remake: false,
    teamPosition: "MIDDLE",
    gameVersion: "14.20.586.5840",
    visionScore: 20,
    damageShare: 0.2,
    firstBloodKill: false,
    csAt10: 70,
    csAt15: 110,
    goldAt10: 4000,
    goldAt15: 6000,
    teamGoldDiffAt15: 0,
    deathTimings: [],
    deathXs: [],
    deathYs: [],
    killTimings: [],
    killXs: [],
    killYs: [],
    laneOpponent: null,
    ...overrides,
  } as MatchSummary;
}

describe("replayHistory", () => {
  it("returns only matches with both LP snapshots", () => {
    const matches = [
      fakeMatch({ matchId: "with-lp", snapshotLpBefore: 50, snapshotLp: 70 }),
      fakeMatch({ matchId: "no-before", snapshotLp: 70 }),
      fakeMatch({ matchId: "no-after", snapshotLpBefore: 50 }),
      fakeMatch({ matchId: "no-lp" }),
    ];
    const points = replayHistory(matches, "ahri");
    expect(points.map((p) => p.matchId)).toEqual(["with-lp"]);
    expect(points[0]?.lpDelta).toBe(20);
  });

  it("excludes remakes from the replay sample", () => {
    const matches = [
      fakeMatch({
        matchId: "live",
        remake: false,
        snapshotLpBefore: 50,
        snapshotLp: 60,
      }),
      fakeMatch({
        matchId: "remake",
        remake: true,
        snapshotLpBefore: 60,
        snapshotLp: 60,
      }),
    ];
    const points = replayHistory(matches, "ahri");
    expect(points.map((p) => p.matchId)).toEqual(["live"]);
  });

  it("replays each match against history strictly before its playedAt", () => {
    const t0 = new Date(Date.now() - 10 * DAY_MS).toISOString();
    const t1 = new Date(Date.now() - 9 * DAY_MS).toISOString();
    const t2 = new Date(Date.now() - 8 * DAY_MS).toISOString();
    const matches = [
      fakeMatch({ matchId: "m0", playedAt: t0, snapshotLpBefore: 0, snapshotLp: 20 }),
      fakeMatch({ matchId: "m1", playedAt: t1, snapshotLpBefore: 20, snapshotLp: 40 }),
      fakeMatch({ matchId: "m2", playedAt: t2, snapshotLpBefore: 40, snapshotLp: 60 }),
    ];
    const points = replayHistory(matches, "ahri");
    expect(points).toHaveLength(3);
    // The earliest match has empty prior history; no signal can fire.
    expect(points[0]?.firing).toBe(0);
  });
});

describe("computeCalibration", () => {
  it("counts directional hits only over matches where the composite fired", () => {
    const points = [
      // firing=0 must be ignored — no direction to evaluate.
      {
        matchId: "a",
        playedAt: "2026-01-01T00:00:00Z",
        score: 0,
        firing: 0,
        signalTones: {
          form: "neutral",
          tilt: "neutral",
          slot: "neutral",
          champ: "neutral",
        },
        lpDelta: 10,
      },
      // firing > 0, positive score, positive LP — hit.
      {
        matchId: "b",
        playedAt: "2026-01-02T00:00:00Z",
        score: 0.5,
        firing: 2,
        signalTones: {
          form: "positive",
          tilt: "positive",
          slot: "neutral",
          champ: "neutral",
        },
        lpDelta: 18,
      },
      // firing > 0, positive score, negative LP — miss.
      {
        matchId: "c",
        playedAt: "2026-01-03T00:00:00Z",
        score: 0.25,
        firing: 1,
        signalTones: {
          form: "positive",
          tilt: "neutral",
          slot: "neutral",
          champ: "neutral",
        },
        lpDelta: -15,
      },
    ] as const;
    const cal = computeCalibration(points as never);
    expect(cal.n).toBe(2);
    expect(cal.directionalHits).toBe(1);
    expect(cal.directionalAccuracy).toBe(0.5);
  });

  it("returns zero metrics when no points fire", () => {
    const cal = computeCalibration([]);
    expect(cal.n).toBe(0);
    expect(cal.directionalAccuracy).toBe(0);
    expect(cal.meanLpForPositive).toBeNull();
  });
});

describe("calibrateConfidence", () => {
  const fired = buildComposite([
    { id: "form", label: "Form", verdict: "x", tone: "positive" },
    { id: "tilt", label: "Tilt", verdict: "x", tone: "positive" },
    { id: "slot", label: "Slot", verdict: "x", tone: "neutral" },
    { id: "champ", label: "Champ", verdict: "x", tone: "neutral" },
  ]);

  it("uses calibration text once the sample crosses MIN_CALIBRATION_SAMPLE", () => {
    const cal = calibrateConfidence(fired, {
      n: MIN_CALIBRATION_SAMPLE,
      directionalHits: 22,
      directionalAccuracy: 22 / MIN_CALIBRATION_SAMPLE,
      meanLpForPositive: 8,
      meanLpForNegative: -6,
      meanLpForNeutral: 0,
    });
    expect(cal.source).toBe("calibration");
    expect(cal.text).toMatch(/Directionally right/);
    expect(cal.text).toMatch(new RegExp(`${MIN_CALIBRATION_SAMPLE}`));
  });

  it("falls back to the heuristic string when the sample is too small", () => {
    const cal = calibrateConfidence(fired, {
      n: 5,
      directionalHits: 3,
      directionalAccuracy: 0.6,
      meanLpForPositive: null,
      meanLpForNegative: null,
      meanLpForNeutral: null,
    });
    expect(cal.source).toBe("heuristic");
    // The composite above is "directional only" (2 firing), so the LP1 string flows through.
    expect(cal.text).toBe(fired.confidence);
  });

  it("returns empty text for the empty-read composite", () => {
    const empty = buildComposite([
      { id: "form", label: "Form", verdict: "x", tone: "neutral" },
    ]);
    const cal = calibrateConfidence(empty, {
      n: 100,
      directionalHits: 80,
      directionalAccuracy: 0.8,
      meanLpForPositive: null,
      meanLpForNegative: null,
      meanLpForNeutral: null,
    });
    expect(cal.text).toBe("");
  });
});
