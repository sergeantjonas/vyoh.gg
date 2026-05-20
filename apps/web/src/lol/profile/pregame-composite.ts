import type { RitualSignal } from "@/lol/profile/ritual-tile";
import { type CalibrationStats, MIN_CALIBRATION_SAMPLE } from "@vyoh/shared";

export interface CompositeRead {
  band: string;
  confidence: string;
  tone: RitualSignal["tone"];
  empty: boolean;
  firing: number;
  bandSource: "calibration" | "heuristic";
}

export function toneToScore(tone: RitualSignal["tone"]): number {
  if (tone === "positive") return 1;
  if (tone === "warning") return -1;
  return 0;
}

function formatSigned(n: number): string {
  return n > 0 ? `+${n}` : `${n}`;
}

function formatBand(center: number, halfWidth: number): string {
  const low = Math.round(center - halfWidth);
  const high = Math.round(center + halfWidth);
  return `${formatSigned(low)} to ${formatSigned(high)} LP`;
}

// Picks the bucket-mean LP delta for the given composite score, mirroring
// computeCalibration's score-band cutoffs. Returns null when the matching
// bucket has no observations yet — caller falls back to the heuristic.
function calibratedCenter(mean: number, calibration: CalibrationStats): number | null {
  if (mean >= 0.25) return calibration.meanLpForPositive;
  if (mean <= -0.25) return calibration.meanLpForNegative;
  return calibration.meanLpForNeutral;
}

export function buildComposite(
  signals: RitualSignal[],
  calibration?: CalibrationStats
): CompositeRead {
  const scores = signals.map((s) => toneToScore(s.tone));
  const firing = scores.filter((s) => s !== 0).length;

  if (firing === 0) {
    return {
      band: "Play a few games and we'll have a read.",
      confidence: "",
      tone: "neutral",
      empty: true,
      firing: 0,
      bandSource: "heuristic",
    };
  }

  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  // Heuristic center: 0.3 → +5..+15, -0.5 → -15..-5, etc. Center scales with
  // score; band stays ±5. Calibrated center: the queue's own meanLpFor*
  // replaces the heuristic once we have ≥ MIN_CALIBRATION_SAMPLE backtest
  // games for that queue and that score bucket has observations.
  const calibratedC =
    calibration && calibration.n >= MIN_CALIBRATION_SAMPLE
      ? calibratedCenter(mean, calibration)
      : null;
  const center = calibratedC ?? mean * 20;
  const bandSource: CompositeRead["bandSource"] =
    calibratedC !== null ? "calibration" : "heuristic";
  const band = formatBand(center, 5);

  // Confidence reflects how many signals had a non-neutral read.
  // Phase LP1 is intentionally naive — we don't yet weight by sample-size
  // inside each signal, only by how many signals fired at all.
  let confidence: string;
  if (firing >= 3) confidence = "";
  else if (firing === 2) confidence = "directional only";
  else confidence = "low confidence — small sample";

  let tone: RitualSignal["tone"] = "neutral";
  if (mean >= 0.25) tone = "positive";
  else if (mean <= -0.25) tone = "warning";

  return { band, confidence, tone, empty: false, firing, bandSource };
}
