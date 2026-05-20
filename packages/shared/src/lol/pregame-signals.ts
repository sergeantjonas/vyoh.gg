import { excludeRemakes } from "./exclude-remakes.ts";
import { computeHourDayStats, computeStreak, computeTiltStats } from "./match-stats.ts";
import type { MatchSummary } from "./match.ts";

export type SignalTone = "neutral" | "positive" | "warning";
export type SignalId = "form" | "tilt" | "slot" | "champ";

const SUGGEST_DAYS = 14;
const TIME_SLOT_DELTA = 0.05;
const MIN_HOUR_SAMPLE = 3;

function monFirstDay(d: Date): number {
  return (d.getDay() + 6) % 7;
}

export function buildFormTone(matches: MatchSummary[]): SignalTone {
  const played = excludeRemakes(matches);
  if (played.length === 0) return "neutral";
  const streak = computeStreak(played);
  if (streak) return streak.type === "win" ? "positive" : "warning";
  const last = [...played].sort((a, b) => b.playedAt.localeCompare(a.playedAt))[0];
  if (!last) return "neutral";
  return last.win ? "positive" : "warning";
}

export function buildTiltTone(matches: MatchSummary[]): SignalTone {
  const played = excludeRemakes(matches);
  if (played.length < 5) return "neutral";
  const last = [...played].sort((a, b) => b.playedAt.localeCompare(a.playedAt))[0];
  if (!last) return "neutral";
  const tilt = computeTiltStats(played);
  const bucket = last.win ? tilt.afterWin : tilt.afterLoss;
  if (bucket.games < 3) return "neutral";
  const wr = bucket.wins / bucket.games;
  return wr >= 0.5 ? "positive" : "warning";
}

export function buildTimeSlotTone(
  matches: MatchSummary[],
  now: Date = new Date()
): SignalTone {
  const played = excludeRemakes(matches);
  if (played.length < 10) return "neutral";
  const overallWr = played.filter((m) => m.win).length / played.length;
  const hourDay = computeHourDayStats(played);
  const day = monFirstDay(now);
  const hour = now.getHours();
  const slot = hourDay.find((s) => s.day === day && s.hour === hour);
  if (!slot || slot.games < MIN_HOUR_SAMPLE) return "neutral";
  const wr = slot.wins / slot.games;
  const delta = wr - overallWr;
  if (delta >= TIME_SLOT_DELTA) return "positive";
  if (delta <= -TIME_SLOT_DELTA) return "warning";
  return "neutral";
}

export function buildChampionTone(
  matches: MatchSummary[],
  now: Date = new Date()
): SignalTone {
  const cutoff = now.getTime() - SUGGEST_DAYS * 24 * 60 * 60 * 1000;
  const recent = matches.filter(
    (m) => !m.remake && new Date(m.playedAt).getTime() >= cutoff
  );
  if (recent.length === 0) return "neutral";
  const counts = new Map<string, { games: number; wins: number }>();
  for (const m of recent) {
    const prev = counts.get(m.champion) ?? { games: 0, wins: 0 };
    counts.set(m.champion, {
      games: prev.games + 1,
      wins: prev.wins + (m.win ? 1 : 0),
    });
  }
  const top = [...counts.entries()].sort((a, b) => b[1].games - a[1].games)[0];
  if (!top) return "neutral";
  const [, stat] = top;
  const wr = Math.round((stat.wins / stat.games) * 100);
  return wr >= 50 ? "positive" : "neutral";
}

export function toneToScore(tone: SignalTone): number {
  if (tone === "positive") return 1;
  if (tone === "warning") return -1;
  return 0;
}

export interface ReplayPoint {
  matchId: string;
  playedAt: string;
  queueType: string;
  score: number;
  firing: number;
  signalTones: Record<SignalId, SignalTone>;
  lpDelta: number;
}

export interface SignalAccuracy {
  positiveN: number;
  positiveHits: number;
  negativeN: number;
  negativeHits: number;
}

export interface CalibrationStats {
  n: number;
  directionalHits: number;
  directionalAccuracy: number;
  meanLpForPositive: number | null;
  meanLpForNegative: number | null;
  meanLpForNeutral: number | null;
  // Marginal directional accuracy per individual signal — independent of the
  // composite firing. Used to decide whether LP2.5 (per-signal weighting) is
  // worth the complexity: if Champion's marginal accuracy meaningfully beats
  // Form's, equal-weight composition is hiding signal quality.
  bySignal: Record<SignalId, SignalAccuracy>;
}

const SIGNAL_IDS: readonly SignalId[] = ["form", "tilt", "slot", "champ"];

export function emptySignalAccuracy(): SignalAccuracy {
  return { positiveN: 0, positiveHits: 0, negativeN: 0, negativeHits: 0 };
}

export function emptyBySignal(): Record<SignalId, SignalAccuracy> {
  return {
    form: emptySignalAccuracy(),
    tilt: emptySignalAccuracy(),
    slot: emptySignalAccuracy(),
    champ: emptySignalAccuracy(),
  };
}

// Minimum sample before calibration is trusted enough to surface in place of
// the heuristic confidence string. Tuned against Agurin's full match history.
export const MIN_CALIBRATION_SAMPLE = 30;

function replayPoint(history: MatchSummary[], match: MatchSummary): ReplayPoint | null {
  const lpBefore = match.snapshotLpBefore;
  const lpAfter = match.snapshotLp;
  if (lpBefore === undefined || lpAfter === undefined) return null;
  const now = new Date(match.playedAt);
  const prior = history.filter((m) => m.playedAt < match.playedAt);
  const form = buildFormTone(prior);
  const tilt = buildTiltTone(prior);
  const slot = buildTimeSlotTone(prior, now);
  const champ = buildChampionTone(prior, now);
  const tones = [form, tilt, slot, champ];
  const scores = tones.map(toneToScore);
  const score = scores.reduce((a, b) => a + b, 0) / scores.length;
  const firing = scores.filter((s) => s !== 0).length;
  return {
    matchId: match.matchId,
    playedAt: match.playedAt,
    queueType: match.queueType,
    score,
    firing,
    signalTones: { form, tilt, slot, champ },
    lpDelta: lpAfter - lpBefore,
  };
}

export function replayHistory(matches: MatchSummary[]): ReplayPoint[] {
  const played = excludeRemakes(matches);
  const points: ReplayPoint[] = [];
  for (const match of played) {
    const point = replayPoint(played, match);
    if (point) points.push(point);
  }
  return points;
}

export type PregameCalibrationByQueue = Record<string, CalibrationStats>;

// Solo and Flex are independent LP ladders — directional accuracy needs to
// stay queue-scoped or "65% right on Solo" gets diluted by a smaller Flex
// sample (or vice-versa). The signal *inputs* still mix across queues
// because player state (tilt, form, time-of-day) carries between ladders;
// only the LP-delta accuracy is partitioned.
export function computeCalibrationByQueue(
  points: ReplayPoint[]
): PregameCalibrationByQueue {
  const byQueue = new Map<string, ReplayPoint[]>();
  for (const p of points) {
    const bucket = byQueue.get(p.queueType) ?? [];
    bucket.push(p);
    byQueue.set(p.queueType, bucket);
  }
  const result: PregameCalibrationByQueue = {};
  for (const [queueType, queuePoints] of byQueue.entries()) {
    result[queueType] = computeCalibration(queuePoints);
  }
  return result;
}

export function computeCalibration(points: ReplayPoint[]): CalibrationStats {
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
  // Per-signal marginal accuracy. Scans ALL points (not just composite-firing
  // ones) so a signal can be credited even when other signals canceled it
  // out at the composite level.
  const bySignal = emptyBySignal();
  for (const p of points) {
    const actualSign = Math.sign(p.lpDelta);
    for (const signalId of SIGNAL_IDS) {
      const tone = p.signalTones[signalId];
      const bucket = bySignal[signalId];
      if (tone === "positive") {
        bucket.positiveN += 1;
        if (actualSign === 1) bucket.positiveHits += 1;
      } else if (tone === "warning") {
        bucket.negativeN += 1;
        if (actualSign === -1) bucket.negativeHits += 1;
      }
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
    bySignal,
  };
}
