import { describe, expect, it } from "vitest";
import type { MatchSummary } from "./match.ts";
import {
  buildChampionTone,
  buildFormTone,
  buildTiltTone,
  buildTimeSlotTone,
  computeCalibration,
  computeCalibrationByQueue,
  replayHistory,
  toneToScore,
} from "./pregame-signals.ts";

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

describe("toneToScore", () => {
  it("maps tones to ±1 / 0", () => {
    expect(toneToScore("positive")).toBe(1);
    expect(toneToScore("warning")).toBe(-1);
    expect(toneToScore("neutral")).toBe(0);
  });
});

describe("tone builders", () => {
  it("buildFormTone is neutral with no games", () => {
    expect(buildFormTone([])).toBe("neutral");
  });

  it("buildFormTone reads a 2-game win streak as positive", () => {
    const t0 = new Date(Date.now() - 2 * HOUR_MS).toISOString();
    const t1 = new Date(Date.now() - HOUR_MS).toISOString();
    const ms = [
      fakeMatch({ matchId: "a", playedAt: t0, win: true }),
      fakeMatch({ matchId: "b", playedAt: t1, win: true }),
    ];
    expect(buildFormTone(ms)).toBe("positive");
  });

  it("buildTiltTone is neutral with fewer than 5 games", () => {
    const ms = [
      fakeMatch({ matchId: "a", win: true }),
      fakeMatch({ matchId: "b", win: false }),
    ];
    expect(buildTiltTone(ms)).toBe("neutral");
  });

  it("buildTiltTone is positive when the after-bucket WR beats overall by >= 5pp", () => {
    // L L L L L W W W W W (chronological). last = W → checks afterWin bucket.
    // afterWin: 4 games / 4 wins = 100%. Overall: 5/10 = 50%. Delta +50pp.
    const wins = [false, false, false, false, false, true, true, true, true, true];
    const ms = wins.map((win, i) =>
      fakeMatch({
        matchId: `m${i}`,
        win,
        playedAt: new Date(Date.now() - (10 - i) * HOUR_MS).toISOString(),
      })
    );
    expect(buildTiltTone(ms)).toBe("positive");
  });

  it("buildTiltTone is warning when the after-bucket WR trails overall by >= 5pp", () => {
    // W W W W W L L L L L. last = L → checks afterLoss bucket.
    // afterLoss: 4 games / 0 wins = 0%. Overall: 50%. Delta -50pp.
    const wins = [true, true, true, true, true, false, false, false, false, false];
    const ms = wins.map((win, i) =>
      fakeMatch({
        matchId: `m${i}`,
        win,
        playedAt: new Date(Date.now() - (10 - i) * HOUR_MS).toISOString(),
      })
    );
    expect(buildTiltTone(ms)).toBe("warning");
  });

  it("buildTiltTone is neutral when the bucket sits within ±5pp of overall", () => {
    // Every game a win → overall=100%, afterWin bucket=100%, delta=0.
    // Previously this returned "positive" via the absolute >= 50% rule.
    const ms = Array.from({ length: 10 }, (_, i) =>
      fakeMatch({
        matchId: `m${i}`,
        win: true,
        playedAt: new Date(Date.now() - (10 - i) * HOUR_MS).toISOString(),
      })
    );
    expect(buildTiltTone(ms)).toBe("neutral");
  });

  it("buildTimeSlotTone is neutral with fewer than 10 games", () => {
    expect(buildTimeSlotTone([])).toBe("neutral");
  });

  it("buildTimeSlotTone is neutral even when the slot WR trails overall by 10pp+ (warning suppressed)", () => {
    // 12 games at the current hour, 3 wins → wr 25%. Other 8 games elsewhere
    // (different hour, 7 wins → 87.5%). Overall WR: 10/20 = 50%. Slot WR
    // trails overall by 25pp — old behaviour fired warning; calibration
    // data showed warning polarity is anti-predictive so we fall back to
    // neutral.
    const now = new Date("2026-05-20T14:00:00Z");
    const ms: ReturnType<typeof fakeMatch>[] = [];
    for (let i = 0; i < 12; i++) {
      ms.push(
        fakeMatch({
          matchId: `slot-${i}`,
          win: i < 3,
          playedAt: new Date("2026-05-20T14:30:00Z").toISOString(),
        })
      );
    }
    for (let i = 0; i < 8; i++) {
      ms.push(
        fakeMatch({
          matchId: `other-${i}`,
          win: i < 7,
          playedAt: new Date("2026-05-20T03:30:00Z").toISOString(),
        })
      );
    }
    expect(buildTimeSlotTone(ms, now)).toBe("neutral");
  });

  it("buildTimeSlotTone is neutral when the slot delta is below the 10pp threshold", () => {
    // 12 games at the current hour, 7 wins → wr 58.3%. Other 8 games elsewhere
    // (different hour, 4 wins → 50%). Overall WR: 11/20 = 55%. Slot vs overall
    // delta = +3.3pp, well below the new 10pp threshold.
    const now = new Date("2026-05-20T14:00:00Z");
    const ms: ReturnType<typeof fakeMatch>[] = [];
    for (let i = 0; i < 12; i++) {
      ms.push(
        fakeMatch({
          matchId: `slot-${i}`,
          win: i < 7,
          playedAt: new Date("2026-05-20T14:30:00Z").toISOString(),
        })
      );
    }
    for (let i = 0; i < 8; i++) {
      ms.push(
        fakeMatch({
          matchId: `other-${i}`,
          win: i < 4,
          playedAt: new Date("2026-05-20T03:30:00Z").toISOString(),
        })
      );
    }
    expect(buildTimeSlotTone(ms, now)).toBe("neutral");
  });

  it("buildChampionTone is neutral when no games in the recent window", () => {
    const oldMatch = fakeMatch({
      playedAt: new Date(Date.now() - 60 * DAY_MS).toISOString(),
    });
    expect(buildChampionTone([oldMatch])).toBe("neutral");
  });

  it("buildChampionTone is positive when the top champion beats overall by >= 5pp", () => {
    // 6 games on Ahri (all wins) + 4 games on Lux (all losses) = overall 60%.
    // Top by game count is Ahri at 100%. Delta +40pp → positive.
    const ms = [
      ...Array.from({ length: 6 }, (_, i) =>
        fakeMatch({ matchId: `ahri-${i}`, champion: "Ahri", win: true })
      ),
      ...Array.from({ length: 4 }, (_, i) =>
        fakeMatch({ matchId: `lux-${i}`, champion: "Lux", win: false })
      ),
    ];
    expect(buildChampionTone(ms)).toBe("positive");
  });

  it("buildChampionTone is warning when the top champion trails overall by >= 5pp", () => {
    // 6 games on Ahri (all losses) + 4 games on Lux (all wins). Overall 40%.
    // Top by game count is Ahri at 0%. Delta -40pp → warning. Previously this
    // collapsed to neutral because the absolute rule only fired positive.
    const ms = [
      ...Array.from({ length: 6 }, (_, i) =>
        fakeMatch({ matchId: `ahri-${i}`, champion: "Ahri", win: false })
      ),
      ...Array.from({ length: 4 }, (_, i) =>
        fakeMatch({ matchId: `lux-${i}`, champion: "Lux", win: true })
      ),
    ];
    expect(buildChampionTone(ms)).toBe("warning");
  });

  it("buildChampionTone is neutral when the top champion matches overall WR", () => {
    // Single champion, 5/10 WR. Overall = top WR = 50%. Delta = 0 → neutral.
    const ms = Array.from({ length: 10 }, (_, i) =>
      fakeMatch({ matchId: `m${i}`, champion: "Ahri", win: i < 5 })
    );
    expect(buildChampionTone(ms)).toBe("neutral");
  });
});

describe("replayHistory", () => {
  it("returns only matches with both LP snapshots", () => {
    const matches = [
      fakeMatch({ matchId: "with-lp", snapshotLpBefore: 50, snapshotLp: 70 }),
      fakeMatch({ matchId: "no-before", snapshotLp: 70 }),
      fakeMatch({ matchId: "no-after", snapshotLpBefore: 50 }),
      fakeMatch({ matchId: "no-lp" }),
    ];
    const points = replayHistory(matches);
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
    const points = replayHistory(matches);
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
    const points = replayHistory(matches);
    expect(points).toHaveLength(3);
    // Earliest match has empty prior history; no signal can fire.
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
    // Empty bySignal still has zeroed entries for every signal so consumers
    // can index without null-checking.
    expect(cal.bySignal.form).toEqual({
      positiveN: 0,
      positiveHits: 0,
      negativeN: 0,
      negativeHits: 0,
    });
    expect(Object.keys(cal.bySignal).sort()).toEqual(["champ", "form", "slot", "tilt"]);
  });

  it("attributes per-signal marginal accuracy across all points (independent of composite firing)", () => {
    // Three points. Per-signal expectations below assume marginal accuracy
    // independent of composite firing — Champion fires positive in all 3.
    const points = [
      // Composite: Form +, Champ +, Tilt 0, Slot 0 → firing=2, score=0.5,
      // actual lpDelta +12 (positive sign).
      {
        matchId: "a",
        playedAt: "2026-01-01T00:00:00Z",
        queueType: "Ranked Solo",
        score: 0.5,
        firing: 2,
        signalTones: {
          form: "positive",
          tilt: "neutral",
          slot: "neutral",
          champ: "positive",
        },
        lpDelta: 12,
      },
      // Form +, Tilt -, Slot 0, Champ + → firing=3, score=0.25,
      // actual lpDelta -10 (Form was wrong here, Champ was wrong, Tilt right).
      {
        matchId: "b",
        playedAt: "2026-01-02T00:00:00Z",
        queueType: "Ranked Solo",
        score: 0.25,
        firing: 3,
        signalTones: {
          form: "positive",
          tilt: "warning",
          slot: "neutral",
          champ: "positive",
        },
        lpDelta: -10,
      },
      // Form 0, Tilt 0, Slot 0, Champ + → firing=1, score=0.25,
      // actual +14 (Champ right, no other signal fired).
      {
        matchId: "c",
        playedAt: "2026-01-03T00:00:00Z",
        queueType: "Ranked Solo",
        score: 0.25,
        firing: 1,
        signalTones: {
          form: "neutral",
          tilt: "neutral",
          slot: "neutral",
          champ: "positive",
        },
        lpDelta: 14,
      },
    ] as const;
    const cal = computeCalibration(points as never);
    // Champion fired positive 3 times, hit 2/3 (matches a + c).
    expect(cal.bySignal.champ.positiveN).toBe(3);
    expect(cal.bySignal.champ.positiveHits).toBe(2);
    // Form fired positive 2 times (a + b), hit 1/2 (a).
    expect(cal.bySignal.form.positiveN).toBe(2);
    expect(cal.bySignal.form.positiveHits).toBe(1);
    // Tilt fired warning once (b), hit 1/1 (lpDelta was negative).
    expect(cal.bySignal.tilt.negativeN).toBe(1);
    expect(cal.bySignal.tilt.negativeHits).toBe(1);
    // Slot never fired with a tone.
    expect(cal.bySignal.slot.positiveN).toBe(0);
    expect(cal.bySignal.slot.negativeN).toBe(0);
  });

  it("buckets lpDelta by score band", () => {
    const cal = computeCalibration([
      {
        matchId: "p",
        playedAt: "2026-01-01T00:00:00Z",
        queueType: "Ranked Solo",
        score: 0.5,
        firing: 2,
        signalTones: {
          form: "positive",
          tilt: "positive",
          slot: "neutral",
          champ: "neutral",
        },
        lpDelta: 10,
      },
      {
        matchId: "n",
        playedAt: "2026-01-02T00:00:00Z",
        queueType: "Ranked Solo",
        score: -0.5,
        firing: 2,
        signalTones: {
          form: "warning",
          tilt: "warning",
          slot: "neutral",
          champ: "neutral",
        },
        lpDelta: -8,
      },
      {
        matchId: "z",
        playedAt: "2026-01-03T00:00:00Z",
        queueType: "Ranked Solo",
        score: 0,
        firing: 2,
        signalTones: {
          form: "positive",
          tilt: "warning",
          slot: "neutral",
          champ: "neutral",
        },
        lpDelta: 4,
      },
    ]);
    expect(cal.meanLpForPositive).toBe(10);
    expect(cal.meanLpForNegative).toBe(-8);
    expect(cal.meanLpForNeutral).toBe(4);
  });
});

describe("computeCalibrationByQueue", () => {
  it("partitions points by queueType and computes calibration per bucket", () => {
    const points = [
      {
        matchId: "s1",
        playedAt: "2026-01-01T00:00:00Z",
        queueType: "Ranked Solo",
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
      {
        matchId: "s2",
        playedAt: "2026-01-02T00:00:00Z",
        queueType: "Ranked Solo",
        score: 0.5,
        firing: 2,
        signalTones: {
          form: "positive",
          tilt: "positive",
          slot: "neutral",
          champ: "neutral",
        },
        lpDelta: 14,
      },
      {
        matchId: "f1",
        playedAt: "2026-01-03T00:00:00Z",
        queueType: "Ranked Flex",
        score: 0.5,
        firing: 2,
        signalTones: {
          form: "positive",
          tilt: "positive",
          slot: "neutral",
          champ: "neutral",
        },
        lpDelta: -12,
      },
    ] as const;
    const by = computeCalibrationByQueue(points as never);
    expect(Object.keys(by).sort()).toEqual(["Ranked Flex", "Ranked Solo"]);
    expect(by["Ranked Solo"]?.n).toBe(2);
    expect(by["Ranked Solo"]?.directionalAccuracy).toBe(1);
    expect(by["Ranked Flex"]?.n).toBe(1);
    expect(by["Ranked Flex"]?.directionalAccuracy).toBe(0);
  });

  it("returns an empty record for an empty points array", () => {
    expect(computeCalibrationByQueue([])).toEqual({});
  });
});
