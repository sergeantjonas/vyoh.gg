import type { ParticipantDetail } from "./match-detail.ts";

export type ScoreGrade = "S+" | "S" | "A" | "B" | "C" | "D";

export interface ScoreOfGame {
  // Mean percentile across the six metrics, 0–1, relative to the other
  // participants of the same game.
  score: number;
  grade: ScoreGrade;
  // 1-based standing in the game; ties share the better rank.
  rank: number;
  outOf: number;
}

export type ScoreParticipant = Pick<
  ParticipantDetail,
  | "puuid"
  | "kills"
  | "deaths"
  | "assists"
  | "totalDamage"
  | "visionScore"
  | "kp"
  | "csTotal"
>;

export type ScoreMetric = "damage" | "kda" | "vision" | "kp" | "cs" | "deaths";

// The six metrics the recap badges crown a leader for, weighted equally here.
// One definition serves both so a badge and a grade can never disagree on
// what "KDA" means. Percentiles rather than raw values keep a support's
// vision worth as much as a carry's damage without a per-role weighting
// table to maintain.
export const SCORE_METRICS: Record<
  ScoreMetric,
  { value: (p: ScoreParticipant) => number; higherIsBetter: boolean }
> = {
  damage: { value: (p) => p.totalDamage, higherIsBetter: true },
  kda: {
    value: (p) => (p.kills + p.assists) / Math.max(p.deaths, 1),
    higherIsBetter: true,
  },
  vision: { value: (p) => p.visionScore, higherIsBetter: true },
  kp: { value: (p) => p.kp, higherIsBetter: true },
  cs: { value: (p) => p.csTotal, higherIsBetter: true },
  deaths: { value: (p) => p.deaths, higherIsBetter: false },
};

const METRICS = Object.values(SCORE_METRICS);

// Floors are on the mean percentile; a player who beats everyone on every
// metric scores 1, a perfectly average one 0.5.
const GRADE_FLOORS: ReadonlyArray<readonly [ScoreGrade, number]> = [
  ["S+", 0.85],
  ["S", 0.72],
  ["A", 0.58],
  ["B", 0.42],
  ["C", 0.28],
];

// Two players with the same six percentiles sum them in a different order,
// so their means can differ in the last bit; anything closer than this is a
// tie for ranking purposes.
const RANK_EPSILON = 1e-9;

export function gradeOf(score: number): ScoreGrade {
  for (const [grade, floor] of GRADE_FLOORS) {
    if (score >= floor) return grade;
  }
  return "D";
}

// Half credit for a tie, so two players with identical stats land on the
// same percentile instead of both looking better than each other.
function percentile(
  own: number,
  others: readonly number[],
  higherIsBetter: boolean
): number {
  let worse = 0;
  let tied = 0;
  for (const o of others) {
    if (o === own) tied++;
    else if (higherIsBetter ? o < own : o > own) worse++;
  }
  return (worse + tied / 2) / others.length;
}

export function scoreOfGame(
  participants: readonly ScoreParticipant[]
): Map<string, ScoreOfGame> {
  const result = new Map<string, ScoreOfGame>();
  if (participants.length < 2) return result;

  const columns = METRICS.map((m) => participants.map((p) => m.value(p)));
  const scores = participants.map((_, i) => {
    let sum = 0;
    for (let m = 0; m < METRICS.length; m++) {
      const column = columns[m] ?? [];
      const own = column[i] ?? 0;
      const others = column.filter((_, j) => j !== i);
      sum += percentile(own, others, METRICS[m]?.higherIsBetter ?? true);
    }
    return sum / METRICS.length;
  });

  participants.forEach((p, i) => {
    const score = scores[i] ?? 0;
    const rank = 1 + scores.filter((s) => s > score + RANK_EPSILON).length;
    result.set(p.puuid, {
      score,
      grade: gradeOf(score),
      rank,
      outOf: participants.length,
    });
  });
  return result;
}
