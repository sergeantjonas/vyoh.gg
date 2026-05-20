import { type CompositeRead, toneToScore } from "@/lol/profile/pregame-composite";
import {
  buildChampionSignal,
  buildFormSignal,
  buildTiltSignal,
  buildTimeSlotSignal,
} from "@/lol/profile/profile-pregame-ritual";
import type { RitualSignal } from "@/lol/profile/ritual-tile";
import { type MatchSummary, excludeRemakes } from "@vyoh/shared";

export interface ReplayPoint {
  matchId: string;
  playedAt: string;
  score: number;
  firing: number;
  signalTones: Record<RitualSignal["id"], RitualSignal["tone"]>;
  lpDelta: number;
}

export interface CalibrationStats {
  n: number;
  directionalHits: number;
  directionalAccuracy: number;
  meanLpForPositive: number | null;
  meanLpForNegative: number | null;
  meanLpForNeutral: number | null;
}

// Minimum sample before we trust the calibration enough to surface it
// instead of LP1's heuristic confidence string.
export const MIN_CALIBRATION_SAMPLE = 30;

function replayPoint(
  history: MatchSummary[],
  match: MatchSummary,
  accountSlug: string
): ReplayPoint | null {
  const lpBefore = match.snapshotLpBefore;
  const lpAfter = match.snapshotLp;
  if (lpBefore === undefined || lpAfter === undefined) return null;
  const now = new Date(match.playedAt);
  // Replay only sees matches played STRICTLY before the target match.
  const prior = history.filter((m) => m.playedAt < match.playedAt);
  const form = buildFormSignal(prior);
  const tilt = buildTiltSignal(prior);
  const slot = buildTimeSlotSignal(prior, now);
  // Replay doesn't render JSX, so identity nameFor is fine.
  const champ = buildChampionSignal(prior, accountSlug, (s) => s, now);
  const signals: RitualSignal[] = [form, tilt, slot, champ];
  const scores = signals.map((s) => toneToScore(s.tone));
  const score = scores.reduce((a, b) => a + b, 0) / scores.length;
  const firing = scores.filter((s) => s !== 0).length;
  return {
    matchId: match.matchId,
    playedAt: match.playedAt,
    score,
    firing,
    signalTones: {
      form: form.tone,
      tilt: tilt.tone,
      slot: slot.tone,
      champ: champ.tone,
    },
    lpDelta: lpAfter - lpBefore,
  };
}

export function replayHistory(
  matches: MatchSummary[],
  accountSlug: string
): ReplayPoint[] {
  const played = excludeRemakes(matches);
  const points: ReplayPoint[] = [];
  for (const match of played) {
    const point = replayPoint(played, match, accountSlug);
    if (point) points.push(point);
  }
  return points;
}

export function computeCalibration(points: ReplayPoint[]): CalibrationStats {
  // Only matches where the composite actually fired count toward calibration —
  // an empty read (firing === 0) has no direction to be right or wrong about.
  const firing = points.filter((p) => p.firing > 0);
  let hits = 0;
  let posSum = 0;
  let posN = 0;
  let negSum = 0;
  let negN = 0;
  let neuSum = 0;
  let neuN = 0;
  for (const p of firing) {
    const predictedSign = Math.sign(p.score);
    const actualSign = Math.sign(p.lpDelta);
    if (predictedSign === actualSign && predictedSign !== 0) hits += 1;
    if (p.score >= 0.25) {
      posSum += p.lpDelta;
      posN += 1;
    } else if (p.score <= -0.25) {
      negSum += p.lpDelta;
      negN += 1;
    } else {
      neuSum += p.lpDelta;
      neuN += 1;
    }
  }
  const n = firing.length;
  return {
    n,
    directionalHits: hits,
    directionalAccuracy: n > 0 ? hits / n : 0,
    meanLpForPositive: posN > 0 ? posSum / posN : null,
    meanLpForNegative: negN > 0 ? negSum / negN : null,
    meanLpForNeutral: neuN > 0 ? neuSum / neuN : null,
  };
}

export interface CalibratedConfidence {
  text: string;
  source: "calibration" | "heuristic";
}

// Produces the confidence text. When we have enough historical replays to
// trust the calibration, use it. Otherwise fall back to LP1's heuristic
// (the existing string already on `composite.confidence`).
export function calibrateConfidence(
  composite: CompositeRead,
  calibration: CalibrationStats
): CalibratedConfidence {
  if (composite.empty) return { text: "", source: "heuristic" };
  if (calibration.n >= MIN_CALIBRATION_SAMPLE) {
    const pct = Math.round(calibration.directionalAccuracy * 100);
    return {
      text: `Directionally right ${pct}% on your last ${calibration.n} ranked games.`,
      source: "calibration",
    };
  }
  return { text: composite.confidence, source: "heuristic" };
}
