import { excludeRemakes } from "./exclude-remakes.ts";
import {
  computeHourDayStats,
  computeStreak,
  computeTiltStats,
} from "./match-stats.ts";
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
  score: number;
  firing: number;
  signalTones: Record<SignalId, SignalTone>;
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

// Minimum sample before calibration is trusted enough to surface in place of
// the heuristic confidence string. Tuned against Agurin's full match history.
export const MIN_CALIBRATION_SAMPLE = 30;

function replayPoint(
  history: MatchSummary[],
  match: MatchSummary
): ReplayPoint | null {
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
